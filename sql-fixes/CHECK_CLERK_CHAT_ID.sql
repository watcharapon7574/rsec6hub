-- Check if there's a clerk with telegram_chat_id
SELECT
  user_id,
  first_name,
  last_name,
  position,
  telegram_chat_id,
  CASE
    WHEN telegram_chat_id IS NULL THEN '❌ ไม่มี chat_id'
    ELSE '✅ มี chat_id'
  END as status
FROM profiles
WHERE position = 'clerk_teacher';

-- If no clerk found, show all positions
SELECT
  position,
  COUNT(*) as count,
  COUNT(telegram_chat_id) as has_chat_id_count
FROM profiles
GROUP BY position
ORDER BY position;
