import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Sun, Moon, Menu, MessageCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@/hooks/useTheme';
import { useChatContext } from '@/contexts/ChatContext';
import { useEmployeeAuth } from '@/hooks/useEmployeeAuth';
import { isAdmin } from '@/types/database';

const STORAGE_KEY = 'rsec6hub-fab-pos';
const BTN_SIZE = 36;
const EDGE_MARGIN = 6;
const DRAG_THRESHOLD = 6;

function clamp(val: number, min: number, max: number) {
  return Math.max(min, Math.min(max, val));
}

function loadPosition(): { x: number; y: number } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return null;
}

function savePosition(x: number, y: number) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ x, y }));
}

function snapToEdge(x: number, y: number): { x: number; y: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const centerX = x + BTN_SIZE / 2;
  const snapX = centerX < vw / 2 ? EDGE_MARGIN : vw - BTN_SIZE - EDGE_MARGIN;
  const snapY = clamp(y, EDGE_MARGIN, vh - BTN_SIZE - EDGE_MARGIN);
  return { x: snapX, y: snapY };
}

const DarkModeToggle: React.FC = () => {
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const { setIsChatOpen, unreadCount } = useChatContext();
  const { profile } = useEmployeeAuth();
  const userIsAdmin = profile ? isAdmin(profile) : false;

  const btnRef = useRef<HTMLButtonElement>(null);
  const dragging = useRef(false);
  const startPos = useRef({ x: 0, y: 0 });
  const startBtn = useRef({ x: 0, y: 0 });
  const moved = useRef(false);
  const lastTouchEnd = useRef(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isSnapping, setIsSnapping] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const [pos, setPos] = useState<{ x: number; y: number }>(() => {
    const saved = loadPosition();
    if (saved) return snapToEdge(saved.x, saved.y);
    return {
      x: (typeof window !== 'undefined' ? window.innerWidth : 400) - BTN_SIZE - EDGE_MARGIN,
      y: (typeof window !== 'undefined' ? window.innerHeight : 800) - 80 - BTN_SIZE,
    };
  });

  const handleMove = useCallback((clientX: number, clientY: number) => {
    if (!dragging.current) return;
    const dx = clientX - startPos.current.x;
    const dy = clientY - startPos.current.y;
    if (!moved.current && Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) return;
    moved.current = true;
    setIsDragging(true);
    setIsSnapping(false);
    setMenuOpen(false);
    const newX = clamp(startBtn.current.x + dx, 0, window.innerWidth - BTN_SIZE);
    const newY = clamp(startBtn.current.y + dy, 0, window.innerHeight - BTN_SIZE);
    setPos({ x: newX, y: newY });
  }, []);

  const handleEnd = useCallback(() => {
    if (!dragging.current) return;
    dragging.current = false;
    setIsDragging(false);
    if (moved.current) {
      setIsSnapping(true);
      setPos(prev => {
        const snapped = snapToEdge(prev.x, prev.y);
        savePosition(snapped.x, snapped.y);
        return snapped;
      });
    } else {
      // Tap → toggle menu
      setMenuOpen(prev => !prev);
    }
  }, []);

  const handleStart = useCallback((clientX: number, clientY: number) => {
    dragging.current = true;
    moved.current = false;
    setIsSnapping(false);
    startPos.current = { x: clientX, y: clientY };
    startBtn.current = { ...pos };
  }, [pos]);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => handleMove(e.clientX, e.clientY);
    const onMouseUp = () => {
      if (Date.now() - lastTouchEnd.current < 500) return;
      handleEnd();
    };
    const onTouchMove = (e: TouchEvent) => {
      if (dragging.current) e.preventDefault();
      const t = e.touches[0];
      handleMove(t.clientX, t.clientY);
    };
    const onTouchEnd = () => {
      lastTouchEnd.current = Date.now();
      handleEnd();
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [handleMove, handleEnd]);

  useEffect(() => {
    const onResize = () => {
      setPos(prev => {
        const snapped = snapToEdge(prev.x, prev.y);
        savePosition(snapped.x, snapped.y);
        return snapped;
      });
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      if (btnRef.current && !btnRef.current.contains(e.target as Node)) {
        const fanEl = document.getElementById('fab-fan-menu');
        if (fanEl && fanEl.contains(e.target as Node)) return;
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [menuOpen]);

  // Fan-out items
  const fanItems = [
    {
      icon: isDark ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-indigo-500" />,
      label: isDark ? 'สว่าง' : 'กลางคืน',
      onClick: () => { toggleTheme(); setMenuOpen(false); },
    },
    {
      icon: <MessageCircle className="h-4 w-4 text-blue-500" />,
      label: 'แชท',
      onClick: () => {
        setMenuOpen(false);
        if (userIsAdmin) {
          navigate('/admin/chats');
        } else {
          setIsChatOpen(true);
        }
      },
      badge: unreadCount > 0,
    },
  ];

  // Calculate fan positions based on button position
  const isOnLeft = pos.x < window.innerWidth / 2;
  const fanPositions = [
    { tx: isOnLeft ? 44 : -44, ty: -30 },
    { tx: isOnLeft ? 44 : -44, ty: 16 },
  ];

  return (
    <>
      {/* Fan-out menu */}
      <div id="fab-fan-menu">
        {fanItems.map((item, i) => {
          const { tx, ty } = fanPositions[i];
          return (
            <button
              key={i}
              onClick={item.onClick}
              className={`
                fixed flex items-center justify-center
                w-9 h-9 rounded-full
                bg-card/95 backdrop-blur-sm
                border border-border
                shadow-lg
                text-foreground
                transition-all duration-300 ease-out
                hover:scale-110 active:scale-95
                z-50
                ${menuOpen
                  ? 'opacity-100 scale-100'
                  : 'opacity-0 scale-75 pointer-events-none'
                }
              `}
              style={{
                left: pos.x + tx,
                top: pos.y + ty,
                transitionDelay: menuOpen ? `${i * 60}ms` : '0ms',
              }}
            >
              <span className="relative">
                {item.icon}
                {item.badge && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
                )}
              </span>
            </button>
          );
        })}
      </div>

      {/* Main hamburger button */}
      <button
        ref={btnRef}
        onMouseDown={(e) => {
          e.preventDefault();
          if (Date.now() - lastTouchEnd.current < 500) return;
          handleStart(e.clientX, e.clientY);
        }}
        onTouchStart={(e) => { const t = e.touches[0]; handleStart(t.clientX, t.clientY); }}
        onTransitionEnd={() => setIsSnapping(false)}
        aria-label="เมนู"
        style={{
          left: pos.x,
          top: pos.y,
          transition: isSnapping ? 'left 0.35s cubic-bezier(.4,.9,.3,1), top 0.35s cubic-bezier(.4,.9,.3,1), transform 0.2s, opacity 0.2s' : 'transform 0.2s, opacity 0.2s',
        }}
        className={`
          fixed z-50
          w-9 h-9 rounded-full
          flex items-center justify-center
          bg-card/90 backdrop-blur-sm
          border border-border
          shadow-lg
          text-foreground
          select-none touch-none
          ${isDragging ? 'scale-110 opacity-80 cursor-grabbing' : 'cursor-grab hover:scale-110 active:scale-95'}
          ${menuOpen ? 'ring-2 ring-blue-500/50' : ''}
        `}
      >
        <Menu className={`h-4 w-4 pointer-events-none transition-transform duration-200 ${menuOpen ? 'rotate-90' : ''}`} />
        {/* Unread badge on main button */}
        {unreadCount > 0 && !menuOpen && (
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse border-2 border-card" />
        )}
      </button>
    </>
  );
};

export default DarkModeToggle;
