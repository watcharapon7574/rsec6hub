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