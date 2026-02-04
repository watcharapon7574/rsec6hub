-- Function: clear_phone_from_auth_users
-- ลบ phone number ออกจาก auth.users เมื่อมีการย้ายเบอร์ไปให้ user อื่น
-- ใช้สำหรับกรณีที่ admin ต้องการย้ายคนจากที่หนึ่งไปอีกที่หนึ่ง

CREATE OR REPLACE FUNCTION clear_phone_from_auth_users(phone_to_clear TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  affected_user_id UUID;
  affected_email TEXT;
  result JSONB;
BEGIN
  -- Convert phone format: 0622294936 -> 66622294936
  DECLARE
    formatted_phone TEXT;
  BEGIN
    IF phone_to_clear LIKE '0%' THEN
      formatted_phone := '66' || substring(phone_to_clear FROM 2);
    ELSE
      formatted_phone := phone_to_clear;
    END IF;

    -- Find user with this phone
    SELECT id, email INTO affected_user_id, affected_email
    FROM auth.users
    WHERE phone = formatted_phone;

    IF affected_user_id IS NULL THEN
      -- No user found with this phone
      RETURN jsonb_build_object(
        'success', true,
        'message', 'No user found with phone ' || phone_to_clear,
        'cleared', false
      );
    END IF;

    -- Clear phone from auth.users
    UPDATE auth.users
    SET phone = NULL
    WHERE id = affected_user_id;

    RAISE LOG '✅ Cleared phone % from auth.users for user % (%)', formatted_phone, affected_email, affected_user_id;

    RETURN jsonb_build_object(
      'success', true,
      'message', 'Phone cleared from user ' || affected_email,
      'cleared', true,
      'affected_user_id', affected_user_id,
      'affected_email', affected_email
    );
  END;

EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG '❌ Error clearing phone: %', SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION clear_phone_from_auth_users(TEXT) TO authenticated;

COMMENT ON FUNCTION clear_phone_from_auth_users(TEXT) IS
'Clear phone number from auth.users table. Used when admin moves a person to a different profile.';
