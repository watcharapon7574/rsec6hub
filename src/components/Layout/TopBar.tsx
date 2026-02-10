
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useEmployeeAuth } from '@/hooks/useEmployeeAuth';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Power, User } from 'lucide-react';
import SessionTimer from './SessionTimer';

const TopBar = () => {
  const navigate = useNavigate();
  const { profile, signOut } = useEmployeeAuth();
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      // Only apply scroll behavior on mobile (screens smaller than 768px)
      if (window.innerWidth < 768) {
        if (currentScrollY > lastScrollY && currentScrollY > 100) {
          // Scrolling down - hide bar
          setIsVisible(false);
        } else {
          // Scrolling up - show bar
          setIsVisible(true);
        }
      } else {
        // Always visible on desktop
        setIsVisible(true);
      }
      
      setLastScrollY(currentScrollY);
    };

    const handleResize = () => {
      // Reset visibility on resize
      if (window.innerWidth >= 768) {
        setIsVisible(true);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
    };
  }, [lastScrollY]);

  const handleSignOut = async () => {
    try {
      console.log('Starting sign out process...');
      const result = await signOut();
      
      console.log('Sign out result:', result);
      console.log('Redirecting to auth page...');
      
      // Force redirect regardless of result
      navigate('/auth', { replace: true });
      
    } catch (err) {
      console.error('Sign out error:', err);
      // Force redirect even if there's an error
      navigate('/auth', { replace: true });
    }
  };

  const getUserInitials = () => {
    if (!profile) return 'U';
    const firstInitial = profile.first_name?.charAt(0) || '';
    const lastInitial = profile.last_name?.charAt(0) || '';
    return (firstInitial + lastInitial).toUpperCase() || 'U';
  };

  return (
    <div 
      className={`
        w-full glass-nav border-b border-primary/10 shadow-primary
        sticky top-0 z-50 transition-vibrant
        ${isVisible ? 'translate-y-0' : '-translate-y-full'}
      `}
      style={{ width: '100vw', maxWidth: '100%' }}
    >
      <div className="w-full max-w-none px-4 sm:px-6 py-3 sm:py-4">
        <div className="flex items-center justify-between min-h-[48px] w-full">
          {/* Left Section: Logo + Profile Icon + Profile Info */}
          <div className="flex items-center space-x-2 sm:space-x-6 flex-1 min-w-0">
            {/* Logo - Fixed size to prevent compression */}
            <Link to="/dashboard" className="flex-shrink-0">
              <img
                src="/fastdoc.png"
                alt="RSEC6 OfficeHub Logo"
                className="h-10 sm:h-12 w-auto object-contain"
              />
            </Link>
            
            {/* Profile Section - Hidden on very small screens, shown on sm+ */}
            {profile && (
              <div className="hidden sm:flex items-center space-x-3 lg:space-x-4 min-w-0">
                <Link 
                  to="/profile"
                  className="flex items-center space-x-3 group"
                  style={{ textDecoration: "none" }}
                >
                  {/* Profile Info + เงาสีๆ */}
                  <div className="flex items-center rounded-lg px-3 py-2 min-w-0 bg-background/80 backdrop-blur-sm border border-border/50 shadow-sm transition group-hover:bg-accent">
                    <Avatar className="h-8 w-8 lg:h-10 lg:w-10 flex-shrink-0">
                      <AvatarImage src={profile.profile_picture_url || undefined} />
                      <AvatarFallback className="bg-gradient-primary text-white text-xs lg:text-sm font-semibold shadow-primary">
                        {getUserInitials()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 ml-3">
                      <div className="text-sm font-medium text-gray-800 truncate">
                        {profile.first_name} {profile.last_name}
                      </div>
                      <div className="text-xs text-gray-500 truncate">
                        {profile.employee_id}
                      </div>
                    </div>
                  </div>
                </Link>
              </div>
            )}

            {/* Mobile Profile Avatar - Only shown on small screens */}
            {profile && (
              <div className="sm:hidden flex items-center space-x-2 min-w-0">
                <Avatar className="h-8 w-8 flex-shrink-0">
                  <AvatarImage src="" />
                  <AvatarFallback className="bg-gradient-primary text-white text-xs font-semibold shadow-primary">
                    {getUserInitials()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-800 truncate">
                    {profile.first_name}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center flex-shrink-0 ml-2 flex-col">
            {/* ปุ่มออกจากระบบ (Logout Button) */}
            <button
              onClick={handleSignOut}
              className="
                flex items-center justify-center
                w-10 h-10 sm:w-12 sm:h-12 rounded-xl
                text-destructive hover:bg-destructive/10 hover:text-destructive
                transition-vibrant
                border-2 border-transparent hover:border-destructive/20
              "
              title="ออกจากระบบ"
            >
              <Power className="h-5 w-5 sm:h-6 sm:w-6" />
            </button>
            {/* แสดงเวลาการใช้งาน session timer ใต้ปุ่ม logout (Session Timer under Logout button) */}
            <div className="mt-1 text-xs text-gray-400 text-center select-none leading-tight">
              <SessionTimer />
              </div>
            </div>
          </div>
        </div>
      </div>
    

  );
};

export default TopBar;
