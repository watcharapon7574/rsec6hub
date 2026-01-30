-- Change telegram_chat_id from bigint to text
ALTER TABLE profiles
ALTER COLUMN telegram_chat_id TYPE text
USING telegram_chat_id::text;

-- Verify the change
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'profiles'
  AND column_name = 'telegram_chat_id';

SELECT 'telegram_chat_id has been changed to text type!' as status;
