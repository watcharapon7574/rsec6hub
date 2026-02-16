import { supabase } from '@/integrations/supabase/client';
import { Profile } from '@/types/database';
import { AuthResult } from '@/types/auth';
import { validatePhoneNumber, formatPhoneNumber } from './validation';
import { storeAuthData } from './storage';
import { SUPABASE_CONFIG } from './constants';
import { createSession } from '../sessionService';

/**
 * Sign in user with phone and OTP
 */
export const signIn = async (phone: string, otp: string): Promise<AuthResult> => {
  try {
    console.log('Attempting sign in with phone via Supabase Auth:', phone);
    
    // Validate phone number format
    const validation = validatePhoneNumber(phone);
    if (!validation.isValid) {
      return { error: new Error(validation.error) };
    }

    // Verify OTP via edge function และรับ Supabase Auth session
    const response = await fetch(`${SUPABASE_CONFIG.PROJECT_URL}/functions/v1/verify-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_CONFIG.ANON_KEY}`
      },
      body: JSON.stringify({ phone, otp })
    });
    
    const result = await response.json();
    console.log('📥 API Response received:', result.success ? 'SUCCESS' : 'ERROR');

    if (!response.ok) {
      console.error('OTP verification error:', result);
      return { error: new Error(result.error || 'รหัส OTP ไม่ถูกต้อง') };
    }

    console.log('OTP verified successfully, setting Supabase session...');
    console.log('🔄 Processing response data...');
    
    if (!result.session) {
      console.error('❌ No session in response from verify-otp');
      return { error: new Error('ไม่ได้รับ session จากเซิร์ฟเวอร์') };
    }

    // Get user และ profile data จาก response
    const { session: sessionData, profile: profileData } = result;
    console.log('📊 Retrieved data - session:', !!sessionData, 'profile:', !!profileData);

    if (!sessionData?.user || !profileData) {
      console.error('Missing user or profile data from verification');
      return { error: new Error('เกิดข้อผิดพลาดในการยืนยันตัวตน') };
    }

    // Cast the profile data to Profile type with proper type casting
    const profile: Profile = {
      ...profileData,
      marital_status: profileData.marital_status as Profile['marital_status'],
      position: profileData.position as Profile['position']
    };

    // ⚠️ สำคัญ: store auth data ก่อน setSession
    // เพราะ setSession จะ trigger onAuthStateChange → React re-render → SessionTimer mount
    // ถ้า authData ไม่อยู่ใน localStorage ตอนนั้น SessionTimer จะ sign out ทันที
    storeAuthData(profile);
    console.log('💾 Auth data stored to localStorage');

    // ตั้งค่า Supabase Auth session (ต้อง await เพื่อให้ session พร้อมใช้งาน)
    console.log('🔄 Setting Supabase session with tokens...');
    const { error: setSessionError } = await supabase.auth.setSession({
      access_token: result.session.access_token,
      refresh_token: result.session.refresh_token
    });

    if (setSessionError) {
      console.error('⚠️ setSession error:', setSessionError);
    } else {
      console.log('✅ setSession completed successfully');
    }

    // สร้าง session record หลัง setSession สำเร็จ (non-blocking)
    if (sessionData.user?.id) {
      createSession(sessionData.user.id).then(({ error: sessionError }) => {
        if (sessionError) {
          console.warn('⚠️ Failed to create session record:', sessionError);
        } else {
          console.log('✅ Session record created successfully');
        }
      });
    }

    console.log('✅ Authentication completed successfully with profile:', profile.user_id);

    return {
      user: sessionData.user,
      profile
    };
  } catch (err) {
    console.error('Sign in error:', err);
    return { error: err as Error };
  }
};