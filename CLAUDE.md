# rsec6hub / FastDoc — Notes for Claude / AI sessions

## Stack
- React + Vite + TypeScript (`src/`)
- Supabase project `ikfioqvjrhquiyeylmsv` — Postgres + Auth + Realtime + Edge Functions + Storage
- Custom auth: phone → Telegram OTP → session (see `supabase/functions/telegram-otp/`)
- Frontend on Vercel (`rsec6hub.vercel.app`)
- PWA with service worker at `public/sw.js`

## Realtime subscriptions — review checklist

This project has been knocked offline by runaway Realtime subscriptions twice already (see `memory/project_incident_20260526.md`). **Treat any change touching `.channel(`, `.on('postgres_changes', ...)`, or a hook that owns one as a high-risk change.**

When reviewing or writing such a change, verify all of the below before merging:

1. **`filter:` present and correct** — every `.on('postgres_changes', ...)` MUST have a `filter:` that scopes to the current user/row (e.g. `assigned_to=eq.${userId}`, `user_id=neq.${profile.user_id}`). Unfiltered `event: '*'` broadcasts every row in the table to every subscriber. Confirm the column referenced in the filter actually exists on the table — wrong column names cause a flood of postgres errors instead of filtering.
2. **`filter:` columns must support Realtime filtering** — `postgres_changes` filters only support `eq`, `neq`, `lt`, `lte`, `gt`, `gte`, `in` on indexed columns. No string functions, no joins.
3. **Channel name unique per session** — use `useRef(crypto.randomUUID())` for the suffix, not `Date.now()` (which changes per render). Pattern: `${tableName}-${userId}-${channelIdRef.current}`.
4. **Subscription is in the right scope** — if the hook that owns the sub is called from many pages, the sub fans out. Either gate it behind an explicit `enableRealtime: true` opt-in, or move the sub into the specific component that needs it. **Do NOT put a default-on realtime sub inside a widely-used hook.**
5. **Callback doesn't refetch the world** — patch state from `payload.new`/`payload.old` when possible. If you must refetch, debounce. Toast/notification side effects must be gated by the filter (don't fire a notification for every event the user doesn't care about).
6. **`useEffect` deps don't include arrays that change every event** — if the callback updates a local state array via `setState`, do NOT put that array in another effect's deps. Derive a stable key (e.g. sorted joined IDs) and depend on the key instead. This was the `MemoList.tsx` bug that fired 2.85M PostgREST calls.
7. **Unsubscribe in cleanup** — the effect returning `() => subscription.unsubscribe()` is non-negotiable. A leaked sub survives navigation and keeps the channel open.

If any of these is unclear or missing, stop and discuss before merging. Realtime regressions don't show up in unit tests — they show up as DB compute exhaustion in production.

## Edge functions — review checklist

1. **Every Supabase DB call must have a timeout.** Use the `withAbort` helper in `supabase/functions/telegram-otp/index.ts` as the reference pattern (AbortController + `.abortSignal(signal)`). `supabase.auth.admin.*` doesn't support abort — use the `withTimeout` fallback with a note.
2. **`service_role` has `statement_timeout = 30s`** (set on the role). Don't rely on it as the only safeguard — short timeouts in code give better errors. If a specific query genuinely needs longer (e.g. heavy reports), `SET LOCAL statement_timeout = '60s'` at the start of that function.
3. **Bail out on the first DB error** in a multi-step flow — don't log-and-continue. Under pool exhaustion, the second query will just time out too and double the wall time before the user sees a failure.
4. **Error responses leak labels** — outer catch maps internal labels like `"DB timeout: rate-limit-check after 6000ms"` to a user-facing Thai message before sending. See the `isTimeout` check in `telegram-otp/index.ts`.

## Useful tools during incidents

- `mcp__supabase__get_logs` (service: `edge-function` / `postgres` / `auth`) — last 24h
- `SELECT * FROM extensions.pg_stat_statements ORDER BY total_exec_time DESC LIMIT 20;` — identifies runaway query patterns
- `SELECT rolname, rolconfig FROM pg_roles;` — current timeout config per role
- Recovery actions, in order: (a) deploy code fix, (b) wait for SW poll cycle (60s) to push to clients, (c) if still stuck, restart project from Supabase Dashboard → Settings → General → Restart (flushes Realtime websockets)

## Useful conventions in this repo

- Service worker registration is in `index.html` (lines ~145-220), not in JS bundle — runs even when the bundle is broken
- `useAllMemos()` defaults to `enableRealtime: false`; only `OfficialDocumentsPage.tsx` opts in
- `taskAssignmentService.subscribeToTaskAssignments(cb, userId, subId)` — `subId` from caller's `useRef`
- Admin phone `036776259` is shared across multiple admins; OTP fans out to all `admin_otp_recipients` rows
