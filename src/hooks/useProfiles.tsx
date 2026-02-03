
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Profile } from '@/types/database';

export const useProfiles = () => {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchProfiles = async () => {
    try {
      setLoading(true);
      
      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .order('first_name', { ascending: true });

      if (fetchError) {
        console.error('Error fetching profiles:', fetchError);
        throw fetchError;
      }

      
      // Cast the data to Profile type with proper type casting
      const castedProfiles = data?.map(profile => ({
        ...profile,
        marital_status: profile.marital_status as Profile['marital_status'],
        position: profile.position as Profile['position']
      })) || [];

      setProfiles(castedProfiles);
      setError(null);
    } catch (err) {
      console.error('Error fetching profiles:', err);
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfiles();
    
    // Real-time subscription disabled to prevent WebSocket errors
    // const subscription = supabase
    //   .channel('profiles_changes')
    //   .on('postgres_changes', 
    //     { 
    //       event: '*', 
    //       schema: 'public', 
    //       table: 'profiles' 
    //     }, 
    //     (payload) => {
    //       console.log('Profile change detected:', payload);
    //       fetchProfiles(); // Refetch all profiles when any change occurs
    //     }
    //   )
    //   .subscribe();

    // return () => {
    //   subscription.unsubscribe();
    // };
  }, []);

  const getProfileByEmployeeId = (employeeId: string): Profile | null => {
    return profiles.find(profile => 
      profile.employee_id.toLowerCase() === employeeId.toLowerCase()
    ) || null;
  };

  const getProfilesByPosition = (position: string): Profile[] => {
    return profiles.filter(profile => profile.position === position);
  };

  const getExecutiveProfiles = (): Profile[] => {
    return profiles.filter(profile => 
      ['director', 'deputy_director', 'assistant_director'].includes(profile.position)
    );
  };

  const getDirectorProfiles = (): Profile[] => {
    // ผอ. ต้องเป็น user_id นี้เท่านั้น
    return profiles.filter(profile => profile.user_id === '28ef1822-628a-4dfd-b7ea-2defa97d755b');
  };

  const getDeputyDirectorProfiles = (): Profile[] => {
    return profiles.filter(profile => profile.position === 'deputy_director');
  };

  const getAssistantDirectorProfiles = (): Profile[] => {
    return profiles.filter(profile => profile.position === 'assistant_director');
  };

  const getClerkProfiles = (): Profile[] => {
    return profiles.filter(profile => profile.position === 'clerk_teacher');
  };

  const updateProfile = async (id: string, updates: Partial<Profile>) => {
    try {
      
      const { data, error: updateError } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating profile:', updateError);
        throw updateError;
      }

      
      // Refresh profiles after update
      await fetchProfiles();
      
      return data;
    } catch (err) {
      console.error('Error updating profile:', err);
      throw err;
    }
  };

  return {
    profiles,
    loading,
    error,
    refetch: fetchProfiles,
    getProfileByEmployeeId,
    getProfilesByPosition,
    getExecutiveProfiles,
    getDirectorProfiles,
    getDeputyDirectorProfiles,
    getAssistantDirectorProfiles,
    getClerkProfiles,
    updateProfile,
  };
};
