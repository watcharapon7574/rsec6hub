
import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Home,
  Calendar,
  Newspaper,
  Bell,
  FileText,
  PenLine,
  Search,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

const navItems = [
  { to: '/dashboard', icon: Home, label: 'หน้าหลัก' },
  { to: '/leave-requests', icon: Calendar, label: 'ขอลา' },
  { to: '/newsfeed', icon: Newspaper, label: 'นิวส์ฟีด' },
  // เอกสาร handled as fan-out trigger
  { to: '/notifications', icon: Bell, label: 'แจ้งเตือน' },
];

const docSubItems = [
  { to: '/create-document', icon: PenLine, label: 'เขียน' },
  { to: '/documents', icon: FileText, label: 'จัดการ' },
  { to: '/ocr-search', icon: Search, label: 'ค้นหา' },
];

const FloatingNavbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;
  const [isVisible, setIsVisible] = useState(true);
  const [fanOpen, setFanOpen] = useState(false);
  const fanRef = useRef<HTMLDivElement>(null);

  const isDocActive = currentPath === '/create-document' || currentPath === '/documents' || currentPath === '/ocr-search';

  // Close fan on outside click
  useEffect(() => {
    if (!fanOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (fanRef.current && !fanRef.current.contains(e.target as Node)) {
        setFanOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('touchstart', handleClick as any);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('touchstart', handleClick as any);
    };
  }, [fanOpen]);

  // Close fan on route change
  useEffect(() => {
    setFanOpen(false);
  }, [currentPath]);

  // Page scroll hide
  useEffect(() => {
    let lastScrollY = window.scrollY;

    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      if (currentScrollY > 200 && currentScrollY > lastScrollY) {
        setIsVisible(false);
        setFanOpen(false);
      } else {
        setIsVisible(true);
      }

      lastScrollY = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const renderNavItem = (item: (typeof navItems)[0]) => {
    const isActive = currentPath === item.to;
    return (
      <Link
        key={item.to}
        to={item.to}
        className={`
          relative flex flex-col items-center justify-center
          w-14 h-14 rounded-xl flex-shrink-0
          transition-all duration-300 ease-out
          ${isActive
            ? 'bg-blue-500 text-white shadow-lg transform -translate-y-1 scale-110'
            : 'text-muted-foreground hover:bg-muted hover:text-primary hover:transform hover:-translate-y-0.5'
          }
        `}
      >
        <item.icon className="h-5 w-5 mb-0.5" />
        <span className={`text-[10px] leading-none font-medium whitespace-nowrap ${isActive ? 'opacity-100' : 'opacity-70'}`}>
          {item.label}
        </span>
        {isActive && (
          <div className="absolute -top-2 w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
        )}
      </Link>
    );
  };

  // Insert เอกสาร fan trigger after นิวส์ฟีด (index 2) and before แจ้งเตือน (index 3)
  const beforeDoc = navItems.slice(0, 3); // หน้าหลัก, ขอลา, นิวส์ฟีด
  const afterDoc = navItems.slice(3);      // แจ้งเตือน

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
          className="bg-background/50 backdrop-blur-sm rounded-full p-2 shadow-lg border border-border/50 hover:bg-background transition-all duration-200 scale-[0.8] hover:scale-110"
        >
          {isVisible ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
      </div>

      <div className="bg-background/80 backdrop-blur-xl rounded-2xl shadow-2xl border border-border/30 px-3 py-3">
        <div className="flex items-center space-x-1">
          {beforeDoc.map((item) => renderNavItem(item))}

          {/* เอกสาร — Fan-out trigger */}
          <div ref={fanRef} className="relative flex-shrink-0">
            {/* Fan-out items */}
            {docSubItems.map((sub, i) => {
              const isSubActive = currentPath === sub.to;
              // 3 items in arc: wider spread + higher
              const positions = [
                { tx: -50, ty: -68 },
                { tx: 0, ty: -88 },
                { tx: 50, ty: -68 },
              ];
              const { tx, ty } = positions[i];

              return (
                <button
                  key={sub.to}
                  onClick={() => {
                    navigate(sub.to);
                    setFanOpen(false);
                  }}
                  className={`
                    absolute left-1/2 top-1/2 z-10
                    flex flex-col items-center justify-center
                    w-12 h-12 rounded-full
                    shadow-lg border border-border/30
                    transition-all duration-300 ease-out
                    ${isSubActive
                      ? 'bg-blue-500 text-white'
                      : 'bg-background/95 backdrop-blur-md text-foreground hover:bg-blue-50 dark:hover:bg-blue-950'
                    }
                    ${fanOpen
                      ? 'opacity-100 scale-100'
                      : 'opacity-0 scale-0 pointer-events-none'
                    }
                  `}
                  style={{
                    transform: fanOpen
                      ? `translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px)) scale(1)`
                      : `translate(-50%, -50%) scale(0)`,
                    transitionDelay: fanOpen ? `${i * 50}ms` : '0ms',
                  }}
                >
                  <sub.icon className="h-5 w-5" />
                  <span className="text-[8px] leading-none mt-0.5 font-bold whitespace-nowrap">
                    {sub.label}
                  </span>
                </button>
              );
            })}

            {/* Trigger button */}
            <button
              onClick={() => setFanOpen((v) => !v)}
              className={`
                relative flex flex-col items-center justify-center
                w-14 h-14 rounded-xl flex-shrink-0
                transition-all duration-300 ease-out
                ${isDocActive && !fanOpen
                  ? 'bg-blue-500 text-white shadow-lg transform -translate-y-1 scale-110'
                  : fanOpen
                    ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 transform -translate-y-1 scale-110'
                    : 'text-muted-foreground hover:bg-muted hover:text-primary hover:transform hover:-translate-y-0.5'
                }
              `}
            >
              <FileText className={`h-5 w-5 mb-0.5 transition-transform duration-300 ${fanOpen ? 'rotate-12' : ''}`} />
              <span className={`text-[10px] leading-none font-medium whitespace-nowrap ${isDocActive || fanOpen ? 'opacity-100' : 'opacity-70'}`}>
                เอกสาร
              </span>
              {isDocActive && !fanOpen && (
                <div className="absolute -top-2 w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
              )}
            </button>
          </div>

          {afterDoc.map((item) => renderNavItem(item))}
        </div>
      </div>
    </div>
  );
};

export default FloatingNavbar;
