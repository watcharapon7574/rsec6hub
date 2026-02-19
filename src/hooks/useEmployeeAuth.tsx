
import { useState, useEffect, useCallback } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { Profile } from '@/types/database';
import { signIn, signOut, getCurrentProfile, isAuthenticated, refreshProfile, sendOTP, getSessionTimeRemaining } from '@/services/authService';
import { getStoredAuthData, clearAuthStorage } from '@/services/auth/storage';
import { getPermissions } from '@/utils/permissionUtils';

export const useEmployeeAuth = () => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuth, setIsAuth] = useState(false);

  // Health check: ตรวจสอบว่า Supabase Auth session ยังใช้งานได้จริง
  // ป้องกัน "zombie state" = localStorage บอกว่า logged in แต่ Supabase Auth ไม่ทำงาน
  const checkSessionHealth = useCallback(async () => {
    const storedAuth = getStoredAuthData();
    if (!storedAuth) return; // ไม่ได้ login

    // ตรวจ 8-hour limit
    const currentTime = new Date().getTime();
    if (currentTime > storedAuth.expirationTime) {
      console.log('⏰ Health check: session 8 ชม. หมดอายุ');
      clearAuthStorage();
      await supabase.auth.signOut();
      window.location.reload();
      return;
    }

    // ตรวจว่า Supabase Auth session ยังอยู่จริง
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      console.log('❌ Health check: Supabase Auth session หายไป → บังคับ sign out');
      clearAuthStorage();
      window.location.reload();
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    // Set up Supabase Auth state listener เป็นหลัก
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔄 Supabase Auth state changed:', event, session?.user?.id);

        if (!isMounted) return;

        if (session?.user) {
          // ตรวจสอบ 8-hour session limit ก่อน
          // ⚠️ ข้าม enforcement ถ้ากำลังลงนามอยู่ เพื่อป้องกัน signOut ระหว่างลงนาม
          const isSigningInProgress = !!(window as any).__signingInProgress;
          const storedAuth = getStoredAuthData();
          if (storedAuth) {
            const currentTime = new Date().getTime();
            if (currentTime > storedAuth.expirationTime) {
              if (isSigningInProgress) {
                // กำลังลงนามอยู่ → ข้ามการบังคับ signOut ไว้ก่อน
                console.log('⏰ Session 8 ชม. หมดอายุ แต่กำลังลงนามอยู่ → ข้ามไปก่อน');
              } else {
                // Session 8 ชม. หมดอายุแล้ว → บังคับ sign out
                console.log('⏰ Session 8 ชม. หมดอายุแล้ว (เข้าตั้งแต่', new Date(storedAuth.loginTime).toLocaleString(), ')');
                clearAuthStorage();
                setUser(null);
                setIsAuth(false);
                setProfile(null);
                setLoading(false);
                // Defer signOut เพื่อไม่ให้ขัดกับ onAuthStateChange
                setTimeout(() => supabase.auth.signOut(), 0);
                return;
              }
            }
          } else if (event !== 'SIGNED_IN') {
            if (isSigningInProgress) {
              console.log('⚠️ ไม่มี auth data แต่กำลังลงนามอยู่ → ข้ามไปก่อน');
            } else {
              // ไม่มี auth data แต่มี Supabase session (อาจถูกเคลียร์ไปแล้วเพราะหมดอายุ)
              console.log('❌ ไม่มี auth data แต่มี Supabase session → บังคับ sign out');
              setUser(null);
              setIsAuth(false);
              setProfile(null);
              setLoading(false);
              setTimeout(() => supabase.auth.signOut(), 0);
              return;
            }
          }

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
            // ผู้ใช้ใหม่ไม่มี phone ใน user_metadata
            // โหลด profile จาก localStorage ก่อน (ทันที) แล้วค่อย refresh จาก DB ทีหลัง
            const cachedProfile = getCurrentProfile();
            if (cachedProfile && isMounted) {
              setProfile(cachedProfile);
              console.log('✅ Profile loaded from localStorage:', cachedProfile.employee_id);
            }

            // Refresh จาก DB แบบ non-blocking (ไม่ await เพราะอาจ deadlock กับ Supabase internal lock)
            supabase
              .from('profiles')
              .select('*')
              .eq('user_id', session.user.id)
              .maybeSingle()
              .then(({ data: profileData }) => {
                if (profileData && isMounted) {
                  const dbProfile = {
                    ...profileData,
                    marital_status: profileData.marital_status as Profile['marital_status'],
                    position: profileData.position as Profile['position']
                  } as Profile;
                  setProfile(dbProfile);
                  console.log('✅ Profile refreshed from DB by user_id:', dbProfile.employee_id);
                }
              })
              .catch(error => {
                console.error('Failed to load profile by user_id:', error);
              });
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

  // Health check เมื่อกลับมาใช้งาน (เปิดจอ, สลับ tab, กลับจาก background)
  // ป้องกันปัญหา: มือถือ sleep แล้ว session หมดอายุแต่ไม่เด้งออก
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('👁️ Tab became visible, checking session health...');
        checkSessionHealth();
      }
    };

    const handleFocus = () => {
      console.log('🔍 Window focused, checking session health...');
      checkSessionHealth();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [checkSessionHealth]);

  const handleSendOTP = async (phone: string, telegramChatId?: string) => {
    try {
      setLoading(true);
      const result = await sendOTP(phone, telegramChatId);
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
