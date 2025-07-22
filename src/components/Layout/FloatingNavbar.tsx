
import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  Home, 
  FileText, 
  Calendar, 
  ClipboardList, 
  Bell,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

const FloatingNavbar = () => {
  const location = useLocation();
  const currentPath = location.pathname;
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    let lastScrollY = window.scrollY;

    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      // Simple logic: hide when scrolling down past 200px
      if (currentScrollY > 200 && currentScrollY > lastScrollY) {
        setIsVisible(false);
      } else {
        setIsVisible(true);
      }
      
      lastScrollY = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navItems = [
    { to: '/dashboard', icon: Home, label: 'หน้าหลัก' },
    { to: '/leave-requests', icon: Calendar, label: 'ขอลา' },
    { to: '/daily-reports', icon: ClipboardList, label: 'รายงาน' },
    { to: '/documents', icon: FileText, label: 'เอกสาร' },
    { to: '/notifications', icon: Bell, label: 'แจ้งเตือน' },
  ];

  return (
    <div 
      className={`
        fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50
        transition-transform duration-300 ease-in-out
        ${isVisible ? 'translate-y-0' : 'translate-y-full'}
      `}
    >
      {/* Toggle Button */}
      <div className="flex justify-center mb-2">
        <button
          onClick={() => setIsVisible(!isVisible)}
          className="bg-white/10 backdrop-blur-sm rounded-full p-2 shadow-lg border border-gray-200/50 hover:bg-white transition-all duration-200 scale-[0.8] hover:scale-110"
        >
          {isVisible ? (
            <ChevronDown className="h-4 w-4 text-gray-600" />
          ) : (
            <ChevronUp className="h-4 w-4 text-gray-600" />
          )}
        </button>
      </div>

      <div className="bg-white/20 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-200/30 px-6 py-3">
        <div className="flex items-center justify-center space-x-2">
          {navItems.map((item, index) => {
            const isActive = currentPath === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`
                  relative flex flex-col items-center justify-center
                  w-14 h-14 rounded-xl
                  transition-all duration-300 ease-out
                  ${isActive 
                    ? 'bg-blue-500 text-white shadow-lg transform -translate-y-1 scale-110' 
                    : 'text-gray-500 hover:bg-gray-100 hover:text-blue-500 hover:transform hover:-translate-y-0.5'
                  }
                `}
              >
                <item.icon className={`h-5 w-5 ${isActive ? 'mb-0.5' : 'mb-0.5'}`} />
                <span className={`text-xs font-medium ${isActive ? 'opacity-100' : 'opacity-70'}`}>
                  {item.label}
                </span>
                {isActive && (
                  <div className="absolute -top-2 w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></div>
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default FloatingNavbar;
