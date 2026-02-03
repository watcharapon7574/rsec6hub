-- Fix notification trigger to fire when current_signer_order changes (not just status)
-- This ensures notifications are sent when moving from one signer to the next

-- Drop and recreate trigger for memos table to include current_signer_order change
DROP TRIGGER IF EXISTS telegram_notify_on_memo_status_change ON memos;
CREATE TRIGGER telegram_notify_on_memo_status_change
  AFTER UPDATE ON memos
  FOR EACH ROW
  WHEN (
    -- Trigger when status changes OR current_signer_order changes
    (OLD.status IS DISTINCT FROM NEW.status OR OLD.current_signer_order IS DISTINCT FROM NEW.current_signer_order)
    AND NEW.doc_del IS NULL  -- Skip soft-deleted documents
  )
  EXECUTE FUNCTION notify_telegram_on_memo_status_change();

-- Drop and recreate trigger for doc_receive table
DROP TRIGGER IF EXISTS telegram_notify_on_doc_receive_status_change ON doc_receive;
CREATE TRIGGER telegram_notify_on_doc_receive_status_change
  AFTER UPDATE ON doc_receive
  FOR EACH ROW
  WHEN (
    -- Trigger when status changes OR current_signer_order changes
    (OLD.status IS DISTINCT FROM NEW.status OR OLD.current_signer_order IS DISTINCT FROM NEW.current_signer_order)
    AND NEW.doc_del IS NULL  -- Skip soft-deleted documents
  )
  EXECUTE FUNCTION notify_telegram_on_memo_status_change();

COMMENT ON TRIGGER telegram_notify_on_memo_status_change ON memos IS 'Send Telegram notifications when document status OR current_signer_order changes';
COMMENT ON TRIGGER telegram_notify_on_doc_receive_status_change ON doc_receive IS 'Send Telegram notifications when document status OR current_signer_order changes';
