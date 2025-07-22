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
    
    // ตั้งค่า Supabase Auth session จาก Edge Function
    if (result.session) {
      console.log('🔄 Setting Supabase session with tokens...');
      console.log('Access Token length:', result.session.access_token?.length);
      
      try {
        // ใช้ setSession แบบไม่รอ และให้ onAuthStateChange จัดการ
        supabase.auth.setSession({
          access_token: result.session.access_token,
          refresh_token: result.session.refresh_token
        }).then(({ error }) => {
          if (error) {
            console.error('⚠️ setSession error (non-blocking):', error);
          } else {
            console.log('✅ setSession completed successfully');
          }
        });

        console.log('🚀 Session setting initiated, continuing with login...');
        console.log('User ID:', result.session.user.id);
      } catch (error) {
        console.error('💥 Session setup failed:', error);
        // Don't return error here, continue with login
      }
    } else {
      console.error('❌ No session in response from verify-otp');
      return { error: new Error('ไม่ได้รับ session จากเซิร์ฟเวอร์') };
    }

    // Get user และ profile data จาก response
    const { session: sessionData, profile: profileData } = result;
    console.log('📊 Retrieved data - session:', !!sessionData, 'profile:', !!profileData);
    console.log('Session user:', sessionData?.user?.id);
    console.log('Profile employee_id:', profileData?.employee_id);

    if (!sessionData?.user || !profileData) {
      console.error('Missing user or profile data from verification');
      console.error('Session data:', sessionData);
      console.error('Profile data:', profileData);
      return { error: new Error('เกิดข้อผิดพลาดในการยืนยันตัวตน') };
    }

    console.log('🎉 Authentication successful with Supabase Auth:', sessionData.user.id);

    // Cast the profile data to Profile type with proper type casting
    const profile: Profile = {
      ...profileData,
      gender: profileData.gender as Profile['gender'],
      marital_status: profileData.marital_status as Profile['marital_status'],
      position: profileData.position as Profile['position']
    };

    // Store authentication data (for backward compatibility only)
    storeAuthData(profile);

    console.log('✅ Authentication completed successfully with profile:', profile.user_id);
    
    // Return both user (from Supabase Auth) and profile data
    return { 
      user: sessionData.user, 
      profile 
    };
  } catch (err) {
    console.error('Sign in error:', err);
    return { error: err as Error };
  }
};