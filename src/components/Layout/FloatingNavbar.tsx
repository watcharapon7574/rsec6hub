
import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useChatContext } from '@/contexts/ChatContext';
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
  ClipboardList,
  Eye,
} from 'lucide-react';

const navItems = [
  { to: '/dashboard', icon: Home, label: 'Home' },
  { to: '/attendance', icon: Calendar, label: 'Men' },
  // News handled as fan-out trigger
  // Sign handled as fan-out trigger
  { to: '/notifications', icon: Bell, label: 'Noti' },
];

const docSubItems = [
  { to: '/create-document', icon: PenLine, label: 'เขียน' },
  { to: '/documents', icon: FileText, label: 'จัดการ' },
  { to: '/ocr-search', icon: Search, label: 'ค้นหา' },
];

const newsSubItems = [
  { to: '/report', icon: ClipboardList, label: 'รายงาน' },
  { to: '/newsfeed', icon: Eye, label: 'ดูฟีด' },
];

type FanKey = 'doc' | 'news' | null;

const FloatingNavbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;
  const [isVisible, setIsVisible] = useState(true);
  const [openFan, setOpenFan] = useState<FanKey>(null);
  const fanContainerRef = useRef<HTMLDivElement>(null);
  const { isChatOpen } = useChatContext();

  const isDocActive = currentPath === '/create-document' || currentPath === '/documents' || currentPath === '/ocr-search';
  const isNewsActive = currentPath === '/newsfeed' || currentPath === '/report';

  // Close fan on outside click
  useEffect(() => {
    if (!openFan) return;
    const handleClick = (e: MouseEvent) => {
      if (fanContainerRef.current && !fanContainerRef.current.contains(e.target as Node)) {
        setOpenFan(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('touchstart', handleClick as any);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('touchstart', handleClick as any);
    };
  }, [openFan]);

  // Close fan on route change
  useEffect(() => {
    setOpenFan(null);
  }, [currentPath]);

  // Page scroll hide
  useEffect(() => {
    let lastScrollY = window.scrollY;

    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      if (currentScrollY > 200 && currentScrollY > lastScrollY) {
        setIsVisible(false);
        setOpenFan(null);
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

  // Helper: render a fan-out trigger (News or Sign) with its sub-items
  const renderFan = (
    fanKey: 'doc' | 'news',
    triggerIcon: React.ComponentType<{ className?: string }>,
    triggerLabel: string,
    isTriggerActive: boolean,
    subItems: { to: string; icon: React.ComponentType<{ className?: string }>; label: string }[],
  ) => {
    const isOpen = openFan === fanKey;
    // Position items in an arc — handle 2 or 3 items
    const arcPositions: { tx: number; ty: number }[] =
      subItems.length === 2
        ? [{ tx: -36, ty: -78 }, { tx: 36, ty: -78 }]
        : [{ tx: -50, ty: -68 }, { tx: 0, ty: -88 }, { tx: 50, ty: -68 }];

    return (
      <div className="relative flex-shrink-0">
        {/* Fan-out items */}
        {subItems.map((sub, i) => {
          const isSubActive = currentPath === sub.to;
          const { tx, ty } = arcPositions[i] || { tx: 0, ty: -88 };

          return (
            <button
              key={sub.to}
              onClick={() => {
                navigate(sub.to);
                setOpenFan(null);
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
                ${isOpen
                  ? 'opacity-100 scale-100'
                  : 'opacity-0 scale-0 pointer-events-none'
                }
              `}
              style={{
                transform: isOpen
                  ? `translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px)) scale(1)`
                  : `translate(-50%, -50%) scale(0)`,
                transitionDelay: isOpen ? `${i * 50}ms` : '0ms',
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
          onClick={() => setOpenFan((prev) => (prev === fanKey ? null : fanKey))}
          className={`
            relative flex flex-col items-center justify-center
            w-14 h-14 rounded-xl flex-shrink-0
            transition-all duration-300 ease-out
            ${isTriggerActive && !isOpen
              ? 'bg-blue-500 text-white shadow-lg transform -translate-y-1 scale-110'
              : isOpen
                ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 transform -translate-y-1 scale-110'
                : 'text-muted-foreground hover:bg-muted hover:text-primary hover:transform hover:-translate-y-0.5'
            }
          `}
        >
          {(() => {
            const Icon = triggerIcon;
            return <Icon className={`h-5 w-5 mb-0.5 transition-transform duration-300 ${isOpen ? 'rotate-12' : ''}`} />;
          })()}
          <span className={`text-[10px] leading-none font-medium whitespace-nowrap ${isTriggerActive || isOpen ? 'opacity-100' : 'opacity-70'}`}>
            {triggerLabel}
          </span>
          {isTriggerActive && !isOpen && (
            <div className="absolute -top-2 w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
          )}
        </button>
      </div>
    );
  };

  // Layout: Home, Men, [News fan], [Sign fan], Noti
  const beforeFans = navItems.slice(0, 2);  // Home, Men
  const afterFans = navItems.slice(2);      // Noti

  return (
    <div
      className={`
        fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50
        transition-transform duration-300 ease-in-out
        ${isVisible && !isChatOpen ? 'translate-y-0' : 'translate-y-full'}
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
        <div ref={fanContainerRef} className="flex items-center space-x-1">
          {beforeFans.map((item) => renderNavItem(item))}
          {renderFan('news', Newspaper, 'News', isNewsActive, newsSubItems)}
          {renderFan('doc', FileText, 'Sign', isDocActive, docSubItems)}
          {afterFans.map((item) => renderNavItem(item))}
        </div>
      </div>
    </div>
  );
};

export default FloatingNavbar;
