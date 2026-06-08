-- Atomic, race-safe recording of a parallel signer's completion.
-- Replaces the client-side read-modify-write of parallel_signers.completed_user_ids in
-- ApproveDocumentPage.tsx, which both (a) depended on the memos UPDATE RLS policy
-- (see 20260602160000) and (b) overwrote the whole array from a stale in-memory snapshot
-- -> concurrent parallel signers lost each other's completions (FIFO signing_lock
-- serialized the writes but not the stale read).
--
-- SECURITY DEFINER  => bypasses RLS (no dependency on the signer UPDATE policy).
-- SELECT ... FOR UPDATE => serializes concurrent signers; the array is appended from the
-- *current* DB value, and the "group complete?" decision + order advance are atomic under
-- the row lock. The next order on completion is deterministic from the document's fixed
-- signer structure, so the caller passes it in (p_next_order_if_complete / p_next_status).
-- Parallel signing only exists on memos (doc_receive has no parallel_signers column).
create or replace function public.record_parallel_signer_completion(
  p_memo_id uuid,
  p_user_id uuid,
  p_next_order_if_complete int,
  p_next_status text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $func$
declare
  v_parallel       jsonb;
  v_current_order  int;
  v_completed      jsonb;
  v_signers        jsonb;
  v_total          int;
  v_done           int;
  v_all_complete   boolean;
  v_caller         uuid := auth.uid();
begin
  select parallel_signers, current_signer_order
    into v_parallel, v_current_order
    from public.memos
    where id = p_memo_id
    for update;

  if v_parallel is null or not (v_parallel ? 'signers') then
    raise exception 'memo % has no parallel_signers', p_memo_id;
  end if;

  -- authz: the signer themselves, or a clerk/admin signing on behalf
  if v_caller is distinct from p_user_id and not public.is_clerk_or_admin() then
    raise exception 'not authorized to record completion for user %', p_user_id;
  end if;

  -- p_user_id must actually be a member of this parallel group
  if not exists (
    select 1 from jsonb_array_elements(v_parallel->'signers') s
    where (s->>'user_id')::uuid = p_user_id
  ) then
    raise exception 'user % is not a parallel signer of memo %', p_user_id, p_memo_id;
  end if;

  v_completed := coalesce(v_parallel->'completed_user_ids', '[]'::jsonb);
  v_signers   := v_parallel->'signers';
  v_total     := jsonb_array_length(v_signers);

  -- idempotent: already recorded -> no write, just report current state
  if v_completed ? p_user_id::text then
    select count(*) into v_done
      from jsonb_array_elements(v_signers) s
      where v_completed ? (s->>'user_id');
    return jsonb_build_object('all_complete', v_done >= v_total, 'completed', v_done, 'total', v_total, 'already', true);
  end if;

  -- only record while this parallel group is the active turn
  if v_current_order is distinct from (v_parallel->>'order')::int then
    raise exception 'parallel group order % is not the current signer turn (current = %)',
      (v_parallel->>'order')::int, v_current_order;
  end if;

  v_completed := v_completed || to_jsonb(p_user_id::text);

  select count(*) into v_done
    from jsonb_array_elements(v_signers) s
    where v_completed ? (s->>'user_id');
  v_all_complete := v_done >= v_total;

  v_parallel := jsonb_set(v_parallel, '{completed_user_ids}', v_completed);

  if v_all_complete then
    update public.memos
       set parallel_signers     = v_parallel,
           current_signer_order = p_next_order_if_complete,
           status               = p_next_status,
           updated_at           = now()
     where id = p_memo_id;
  else
    update public.memos
       set parallel_signers = v_parallel,
           updated_at       = now()
     where id = p_memo_id;
  end if;

  return jsonb_build_object('all_complete', v_all_complete, 'completed', v_done, 'total', v_total, 'already', false);
end;
$func$;

revoke all on function public.record_parallel_signer_completion(uuid, uuid, int, text) from public;
grant execute on function public.record_parallel_signer_completion(uuid, uuid, int, text) to authenticated;
