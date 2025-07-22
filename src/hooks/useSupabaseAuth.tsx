import { useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { Profile } from '@/types/database';

export const useSupabaseAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // Helper function to safely cast Supabase profile data to our Profile type
  const castToProfile = (data: any): Profile | null => {
    if (!data) return null;
    
    return {
      ...data,
      gender: data.gender as Profile['gender'],
      marital_status: data.marital_status as Profile['marital_status'],
      position: data.position as Profile['position']
    } as Profile;
  };

  useEffect(() => {
    let isMounted = true;

    // Set up auth state listener FIRST (before checking existing session)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('Supabase Auth state changed:', event, session?.user?.id);
        
        if (!isMounted) return;
        
        // Only synchronous state updates here to prevent deadlock
        setSession(session);
        setUser(session?.user ?? null);
        
        // Defer async operations using setTimeout to prevent auth deadlock
        if (session?.user) {
          setTimeout(() => {
            if (isMounted) {
              fetchUserProfile(session.user.id);
            }
          }, 0);
        } else {
          setProfile(null);
          setLoading(false);
        }
      }
    );

    // Helper function to fetch profile (moved outside callback)
    const fetchUserProfile = async (userId: string) => {
      if (!isMounted) return;
      
      try {
        const { data: profileData, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();
        
        if (!isMounted) return;
        
        if (error) {
          console.error('Error fetching profile:', error);
        } else {
          setProfile(castToProfile(profileData));
        }
      } catch (err) {
        console.error('Profile fetch error:', err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!isMounted) return;
      
      console.log('Initial Supabase session check:', session?.user?.id);
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        // Use the same deferred pattern for initial profile fetch
        setTimeout(() => {
          if (isMounted) {
            fetchUserProfile(session.user.id);
          }
        }, 0);
      } else {
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signInWithPhoneOtp = async (phone: string) => {
    try {
      const { error } = await supabase.auth.signInWithOtp({
        phone,
      });
      return { error };
    } catch (err) {
      console.error('Phone OTP error:', err);
      return { error: err as Error };
    }
  };

  const verifyOtp = async (phone: string, token: string) => {
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        phone,
        token,
        type: 'sms'
      });
      return { data, error };
    } catch (err) {
      console.error('OTP verification error:', err);
      return { error: err as Error };
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (!error) {
        setUser(null);
        setSession(null);
        setProfile(null);
      }
      return { error };
    } catch (err) {
      console.error('Sign out error:', err);
      return { error: err as Error };
    }
  };

  const refreshProfile = async () => {
    if (!user) return null;
    
    try {
      const { data: profileData, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (error) {
        console.error('Error refreshing profile:', error);
        return null;
      }
      
      const refreshedProfile = castToProfile(profileData);
      setProfile(refreshedProfile);
      return refreshedProfile;
    } catch (err) {
      console.error('Profile refresh error:', err);
      return null;
    }
  };

  return {
    user,
    session,
    profile,
    loading,
    signInWithPhoneOtp,
    verifyOtp,
    signOut,
    refreshProfile,
    isAuthenticated: !!session?.user,
  };
};