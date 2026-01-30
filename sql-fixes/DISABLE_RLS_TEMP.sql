-- Temporarily disable RLS to test
ALTER TABLE memos DISABLE ROW LEVEL SECURITY;
ALTER TABLE doc_receive DISABLE ROW LEVEL SECURITY;

SELECT 'RLS has been disabled for testing' as status;
