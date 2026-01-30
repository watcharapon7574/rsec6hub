-- Disable all telegram triggers temporarily
ALTER TABLE memos DISABLE TRIGGER telegram_notify_on_memo_status_change;
ALTER TABLE memos DISABLE TRIGGER telegram_notify_on_memo_created;
ALTER TABLE doc_receive DISABLE TRIGGER telegram_notify_on_doc_receive_status_change;
ALTER TABLE doc_receive DISABLE TRIGGER telegram_notify_on_doc_receive_created;

SELECT 'All telegram triggers have been disabled for testing' as status;
