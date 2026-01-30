-- Check the structure of signer_list_progress
SELECT
  id,
  subject,
  current_signer_order,
  signer_list_progress
FROM memos
WHERE status = 'pending_sign'
  AND signer_list_progress IS NOT NULL
LIMIT 1;
