
import { useState, useEffect, useCallback } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { Profile } from '@/types/database';
import { signIn, signOut, getCurrentProfile, isAuthenticated, refreshProfile, sendOTP, getSessionTimeRemaining } from '@/services/authService';
import { getStoredAuthData, clearAuthStorage } from '@/services/auth/storage';
import { validateSession, getCurrentSessionToken } from '@/services/sessionService';
import { getPermissions } from '@/utils/permissionUtils';

// ลบ Supabase session จาก localStorage ตรงๆ โดยไม่ call server
// ใช้แทน signOut() ในกรณี cleanup session เก่า → ป้องกัน 403
const SUPABASE_STORAGE_KEY = 'sb-ikfioqvjrhquiyeylmsv-auth-token';
function clearSupabaseSession() {
  try {
    localStorage.removeItem(SUPABASE_STORAGE_KEY);
    // Supabase อาจเก็บ code-verifier ด้วย
    localStorage.removeItem(`${SUPABASE_STORAGE_KEY}-code-verifier`);
  } catch (e) {
    // ป้องกัน error ถ้า localStorage ไม่พร้อมใช้งาน
  }
}

export const useEmployeeAuth = () => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuth, setIsAuth] = useState(false);

  // Health check (local only): ตรวจแค่ 8-hour session limit
  // ใช้ตอน visibility/focus เพราะไม่ต้องรอ network (มือถือ sleep → กลับมา network อาจยังไม่พร้อม)
  const checkSessionHealth = useCallback(() => {
    const storedAuth = getStoredAuthData();
    if (!storedAuth) return;

    const currentTime = new Date().getTime();
    if (currentTime > storedAuth.expirationTime) {
      console.log('⏰ Health check: session 8 ชม. หมดอายุ');
      clearAuthStorage();
      setUser(null);
      setIsAuth(false);
      setProfile(null);
      clearSupabaseSession();
    }
  }, []);

  // DB session check: ตรวจว่าถูก kill จากเครื่องอื่นหรือไม่
  // ใช้ใน interval เท่านั้น (ไม่ใช้ตอน visibility/focus เพราะต้องใช้ network)
  const checkSessionFromDB = useCallback(() => {
    const storedAuth = getStoredAuthData();
    if (!storedAuth) return;

    const sessionToken = getCurrentSessionToken();
    if (sessionToken) {
      validateSession(sessionToken).then(({ valid, reason }) => {
        if (!valid && (reason === 'invalidated' || reason === 'expired')) {
          console.log('🔒 Session ถูกยกเลิกจากเครื่องอื่น (reason:', reason, ')');
          clearAuthStorage();
          setUser(null);
          setIsAuth(false);
          setProfile(null);
          clearSupabaseSession();
          window.location.reload();
        }
      }).catch(() => {
        // ไม่ kick ออกถ้า network error
      });
    }
  }, []);

  // ⏱️ Loading timeout: ป้องกัน loading ค้างบน Android PWA
  // เกิดจาก Supabase Auth initialization ใช้ navigator.locks + token refresh ผ่าน network
  // ถ้า network ช้าหรือ lock contention → getSession() + onAuthStateChange ถูก block
  // ทำให้ loading ค้าง true → ผู้ใช้เห็น spinner ค้าง ("หมุน")
  useEffect(() => {
    if (!loading) return;

    const timeout = setTimeout(() => {
      console.log('⏱️ Loading timeout (5s) → fallback to cached auth');
      const cachedProfile = getCurrentProfile();
      const authStatus = isAuthenticated();

      if (authStatus && cachedProfile) {
        console.log('✅ Fallback: ใช้ cached profile:', cachedProfile.employee_id);
        setProfile(cachedProfile);
        setIsAuth(true);
      } else {
        console.log('❌ Fallback: ไม่มี cached auth → แสดงหน้า login');
        setIsAuth(false);
        setProfile(null);
      }
      setLoading(false);
    }, 5000);

    return () => clearTimeout(timeout);
  }, [loading]);

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
                // Session 8 ชม. หมดอายุแล้ว → บังคับ sign out (local only เพื่อป้องกัน 403 loop)
                console.log('⏰ Session 8 ชม. หมดอายุแล้ว (เข้าตั้งแต่', new Date(storedAuth.loginTime).toLocaleString(), ')');
                clearAuthStorage();
                setUser(null);
                setIsAuth(false);
                setProfile(null);
                setLoading(false);
                // Defer signOut เพื่อไม่ให้ขัดกับ onAuthStateChange
                clearSupabaseSession();
                return;
              }
            }
          } else if (event !== 'SIGNED_IN') {
            if (isSigningInProgress) {
              console.log('⚠️ ไม่มี auth data แต่กำลังลงนามอยู่ → ข้ามไปก่อน');
            } else {
              // ไม่มี auth data แต่มี Supabase session (อาจถูกเคลียร์ไปแล้วเพราะหมดอายุ)
              // ใช้ scope: 'local' เพื่อเคลียร์ session ใน browser เท่านั้น
              // ไม่ call server (ป้องกัน 403 ถ้า session หมดอายุแล้ว → วนลูป)
              console.log('❌ ไม่มี auth data แต่มี Supabase session → เคลียร์ local session');
              setUser(null);
              setIsAuth(false);
              setProfile(null);
              setLoading(false);
              clearSupabaseSession();
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
  // 1. ตรวจ 8-hour timer ทันที (local, ไม่ใช้ network)
  // 2. ตรวจ DB session หลัง 2 วินาที (รอ network พร้อม → ถ้า fail ก็แค่ skip)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('👁️ Tab became visible, checking session health...');
        checkSessionHealth();
        // ตรวจ DB session หลัง 2 วินาที (รอ network reconnect หลัง sleep)
        setTimeout(() => checkSessionFromDB(), 2000);
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

  // ตรวจ DB session ทุก 60 วินาที เพื่อให้ kill session จากเครื่องอื่นทำงานได้
  // แยกจาก visibility/focus เพราะอันนี้ต้องใช้ network
  useEffect(() => {
    const interval = setInterval(() => {
      checkSessionFromDB();
    }, 60000);

    return () => clearInterval(interval);
  }, [checkSessionFromDB]);

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
