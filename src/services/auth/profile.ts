import { supabase } from '@/integrations/supabase/client';
import { Profile } from '@/types/database';
import { updateStoredProfile } from './storage';

/**
 * Refresh profile from database
 */
export const refreshProfile = async (phone: string): Promise<Profile | null> => {
  try {
    console.log('🔍 Refreshing profile for phone:', phone);

    // Check current session first
    const { data: { session } } = await supabase.auth.getSession();
    console.log('🔐 Current session user_id:', session?.user?.id);

    // 🔧 Try to find profile by user_id first (more reliable)
    let profileData = null;
    let error = null;

    if (session?.user?.id) {
      const result = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', session.user.id)
        .maybeSingle();

      profileData = result.data;
      error = result.error;
      console.log('📊 Profile query by user_id:', { found: !!profileData, error: error?.message });
    }

    // If not found by user_id, try phone number
    if (!profileData && !error) {
      const result = await supabase
        .from('profiles')
        .select('*')
        .eq('phone', phone)
        .maybeSingle();

      profileData = result.data;
      error = result.error;
      console.log('📊 Profile query by phone:', { found: !!profileData, error: error?.message });
    }

    if (error) {
      console.error('❌ Error refreshing profile:', error);
      return null;
    }

    if (!profileData) {
      console.log('⚠️ No profile found for user_id or phone');

      // 🔧 สร้าง profile อัตโนมัติถ้ามี session (ล็อกอินสำเร็จแล้ว)
      if (session?.user?.id) {
        console.log('🔨 Auto-creating profile for user:', session.user.id);

        const newProfile = {
          user_id: session.user.id,
          phone: phone,
          first_name: 'ผู้ใช้งานใหม่',
          last_name: '',
          employee_id: `USER_${Date.now()}`, // Temporary employee ID
          position: 'government_teacher', // Default position
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        const { data: createdProfile, error: createError } = await supabase
          .from('profiles')
          .insert(newProfile)
          .select()
          .single();

        if (createError) {
          console.error('❌ Failed to create profile:', createError);
          return null;
        }

        console.log('✅ Profile created successfully:', createdProfile.employee_id);

        const profile: Profile = {
          ...createdProfile,
          marital_status: createdProfile.marital_status as Profile['marital_status'],
          position: createdProfile.position as Profile['position']
        };

        updateStoredProfile(profile);
        return profile;
      }

      return null;
    }

    const profile: Profile = {
      ...profileData,
      marital_status: profileData.marital_status as Profile['marital_status'],
      position: profileData.position as Profile['position']
    };

    // Update stored profile
    updateStoredProfile(profile);

    return profile;
  } catch (err) {
    console.error('Error refreshing profile:', err);
    return null;
  }
};