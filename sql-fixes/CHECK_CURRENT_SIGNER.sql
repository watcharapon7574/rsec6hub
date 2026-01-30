-- Check current document status
SELECT
  id,
  subject,
  status,
  current_signer_order,
  signer_list_progress
FROM memos
WHERE id = 'c01d67e8-bbd2-4e51-8a0d-edef855d2f94';

-- Check who should be the current signer based on current_signer_order
SELECT
  signer->>'order' as signer_order,
  signer->>'name' as signer_name,
  signer->>'user_id' as signer_user_id,
  signer->>'position' as signer_position
FROM memos,
  jsonb_array_elements(signer_list_progress) AS signer
WHERE id = 'c01d67e8-bbd2-4e51-8a0d-edef855d2f94'
  AND (signer->>'order')::int = current_signer_order;

-- Check if that user has telegram_chat_id
SELECT
  p.user_id,
  p.first_name,
  p.last_name,
  p.telegram_chat_id
FROM memos m
CROSS JOIN jsonb_array_elements(m.signer_list_progress) AS signer
LEFT JOIN profiles p ON p.user_id::text = (signer->>'user_id')::text
WHERE m.id = 'c01d67e8-bbd2-4e51-8a0d-edef855d2f94'
  AND (signer->>'order')::int = m.current_signer_order;
