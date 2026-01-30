-- Manually update current_signer_order to test trigger
-- This will change order from 4 to 4 (no change, just to see if trigger fires)
UPDATE memos
SET current_signer_order = current_signer_order
WHERE id = 'c01d67e8-bbd2-4e51-8a0d-edef855d2f94';

-- Check PostgreSQL logs after this
-- Go to: https://supabase.com/dashboard/project/ikfioqvjrhquiyeylmsv/logs/postgres-logs
