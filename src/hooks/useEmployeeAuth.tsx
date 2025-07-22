
import { useState, useEffect } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { Profile } from '@/types/database';
import { signIn, signOut, getCurrentProfile, isAuthenticated, refreshProfile, sendOTP, getSessionTimeRemaining } from '@/services/authService';
import { getPermissions } from '@/utils/permissionUtils';

export const useEmployeeAuth = () => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuth, setIsAuth] = useState(false);

  useEffect(() => {
    let isMounted = true;
    
    // Set up Supabase Auth state listener เป็นหลัก
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔄 Supabase Auth state changed:', event, session?.user?.id);
        
        if (!isMounted) return;
        
        if (session?.user) {
          setUser(session.user);
          setIsAuth(true);
          setLoading(false); // Reset loading when authenticated
          console.log('✅ Supabase user authenticated:', session.user.id);
          console.log('📊 Current states - loading:', false, 'isAuth:', true, 'profile:', !!profile);
          
          // Fetch profile using user_metadata phone or user_id (non-blocking)
          if (session.user.user_metadata?.phone) {
            // Don't await - make it non-blocking
            refreshProfile(session.user.user_metadata.phone).then(profileData => {
              if (isMounted && profileData) {
                setProfile(profileData);
                console.log('✅ Profile loaded from Supabase user:', profileData.employee_id);
                console.log('📊 Final states - loading:', false, 'isAuth:', true, 'profile:', !!profileData);
              }
            }).catch(error => {
              console.error('Failed to load profile from Supabase user:', error);
            });
          } else if (session.user.id) {
            // Try to find profile by user_id
            try {
              const { data: profileData } = await supabase
                .from('profiles')
                .select('*')
                .eq('user_id', session.user.id)
                .maybeSingle();
              
              if (profileData) {
                const profile = {
                  ...profileData,
                  gender: profileData.gender as Profile['gender'],
                  marital_status: profileData.marital_status as Profile['marital_status'],
                  position: profileData.position as Profile['position']
                } as Profile;
                
                if (isMounted) {
                  setProfile(profile);
                  console.log('✅ Profile loaded by user_id:', profile.employee_id);
                }
              }
            } catch (error) {
              console.error('Failed to load profile by user_id:', error);
            }
          }
        } else {
          // No Supabase session
          setUser(null);
          console.log('❌ No Supabase session');
          
          // ตรวจสอบระบบเดิมเป็น fallback เท่านั้น (ไม่ใช้ session monitoring)
          const authStatus = isAuthenticated();
          const currentProfile = getCurrentProfile();
          
          if (authStatus && currentProfile) {
            console.log('🔄 Fallback to legacy auth system');
            setIsAuth(true);
            setProfile(currentProfile);
          } else {
            setIsAuth(false);
            setProfile(null);
          }
        }
        
        if (isMounted) {
          setLoading(false);
        }
      }
    );

    // Check existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (isMounted) {
        if (session?.user) {
          console.log('🔍 Found existing Supabase session:', session.user.id);
        } else {
          console.log('🔍 No existing Supabase session found');
        }
        // Always set loading to false after checking session
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleSendOTP = async (phone: string) => {
    try {
      setLoading(true);
      const result = await sendOTP(phone);
      return result;
    } catch (err) {
      console.error('Send OTP error:', err);
      return { error: err as Error };
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async (phone: string, otp: string) => {
    try {
      setLoading(true);
      const result = await signIn(phone, otp);
      
      if (!result.error && result.profile) {
        setProfile(result.profile);
        setIsAuth(true);
        console.log('Sign in successful, profile loaded:', result.profile);
      }
      
      return result;
    } catch (err) {
      console.error('Sign in error:', err);
      return { error: err as Error };
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      console.log('Starting sign out process in hook...');
      
      // Clear states FIRST to prevent race conditions
      setProfile(null);
      setIsAuth(false);
      console.log('Auth states cleared immediately');
      
      // Then call the actual sign out
      const result = await signOut();
      
      return result;
    } catch (err) {
      console.error('Sign out error in hook:', err);
      // States are already cleared above
      return { error: err as Error };
    }
  };

  const handleRefreshProfile = async () => {
    if (!profile || !profile.phone) return null;
    
    try {
      const refreshedProfile = await refreshProfile(profile.phone);
      if (refreshedProfile) {
        setProfile(refreshedProfile);
        return refreshedProfile;
      }
      return null;
    } catch (err) {
      console.error('Error refreshing profile:', err);
      return null;
    }
  };

  return {
    profile,
    user,
    loading,
    isAuthenticated: isAuth || !!user, // ถือว่า authenticated ถ้ามี Supabase user หรือ legacy auth
    signIn: handleSignIn,
    sendOTP: handleSendOTP,
    signOut: handleSignOut,
    refreshProfile: handleRefreshProfile,
    getPermissions: () => getPermissions(profile),
    getSessionTimeRemaining,
  };
};
