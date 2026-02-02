/**
 * Script to set admin permissions for a user
 *
 * Usage:
 * 1. Go to Supabase Dashboard > SQL Editor
 * 2. Run this query (replace with your phone number):
 */

-- Set admin for your account
UPDATE profiles
SET is_admin = true
WHERE phone = '0835595128';  -- เปลี่ยนเป็นเบอร์โทรของคุณ

-- Or if you're the director:
UPDATE profiles
SET position = 'director'
WHERE phone = '0835595128';  -- เปลี่ยนเป็นเบอร์โทรของคุณ

-- Verify the change:
SELECT employee_id, first_name, last_name, phone, position, is_admin
FROM profiles
WHERE phone = '0835595128';
