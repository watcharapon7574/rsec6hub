-- ========================================
-- FIX: Detect when current_signer_order changes (not just status)
-- ========================================

-- Drop existing triggers
DROP TRIGGER IF EXISTS telegram_notify_on_memo_status_change ON memos;
DROP TRIGGER IF EXISTS telegram_notify_on_doc_receive_status_change ON doc_receive;

-- Recreate triggers with updated WHEN condition
CREATE TRIGGER telegram_notify_on_memo_status_change
  AFTER UPDATE ON memos
  FOR EACH ROW
  WHEN (
    -- Trigger when status changes OR when current_signer_order changes
    (OLD.status IS DISTINCT FROM NEW.status OR OLD.current_signer_order IS DISTINCT FROM NEW.current_signer_order)
    AND NEW.doc_del IS NULL
  )
  EXECUTE FUNCTION notify_telegram_on_memo_status_change();

CREATE TRIGGER telegram_notify_on_doc_receive_status_change
  AFTER UPDATE ON doc_receive
  FOR EACH ROW
  WHEN (
    -- Trigger when status changes OR when current_signer_order changes
    (OLD.status IS DISTINCT FROM NEW.status OR OLD.current_signer_order IS DISTINCT FROM NEW.current_signer_order)
    AND NEW.doc_del IS NULL
  )
  EXECUTE FUNCTION notify_telegram_on_memo_status_change();

SELECT 'Triggers have been updated to detect current_signer_order changes!' as status;
