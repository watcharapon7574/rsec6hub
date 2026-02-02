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
    
    const { data: profileData, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('phone', phone)
      .maybeSingle(); // Use maybeSingle instead of single

    console.log('📊 Profile query result:', { data: !!profileData, error: error?.message });

    if (error) {
      console.error('❌ Error refreshing profile:', error);
      return null;
    }

    if (!profileData) {
      console.log('⚠️ No profile found for phone:', phone);

      // 🔧 สร้าง profile อัตโนมัติถ้ามี session (ล็อกอินสำเร็จแล้ว)
      if (session?.user?.id) {
        console.log('🔨 Auto-creating profile for user:', session.user.id);

        const newProfile = {
          user_id: session.user.id,
          phone: phone,
          first_name: 'ผู้ใช้งานใหม่',
          last_name: '',
          employee_id: `USER_${Date.now()}`, // Temporary employee ID
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
          gender: createdProfile.gender as Profile['gender'],
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
      gender: profileData.gender as Profile['gender'],
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