import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Loader2 } from 'lucide-react';

interface PullToRefreshProps {
  children: React.ReactNode;
}

const THRESHOLD = 80; // px to pull before triggering refresh
const MAX_PULL = 120; // max pull distance

const PullToRefresh: React.FC<PullToRefreshProps> = ({ children }) => {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const touchStartY = useRef(0);
  const isPulling = useRef(false);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    setPullDistance(THRESHOLD);

    // Small delay then reload
    await new Promise(resolve => setTimeout(resolve, 500));
    window.location.reload();
  }, []);

  useEffect(() => {
    const onTouchStart = (e: TouchEvent) => {
      // Only activate when scrolled to top
      if (window.scrollY > 0 || isRefreshing) return;
      touchStartY.current = e.touches[0].clientY;
      isPulling.current = true;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!isPulling.current || isRefreshing) return;

      const currentY = e.touches[0].clientY;
      const diff = currentY - touchStartY.current;

      if (diff > 0 && window.scrollY === 0) {
        // Pulling down from top
        const distance = Math.min(diff * 0.5, MAX_PULL);
        setPullDistance(distance);

        if (distance > 10) {
          e.preventDefault();
        }
      } else {
        // Scrolling normally
        isPulling.current = false;
        setPullDistance(0);
      }
    };

    const onTouchEnd = () => {
      if (!isPulling.current || isRefreshing) return;
      isPulling.current = false;

      if (pullDistance >= THRESHOLD) {
        handleRefresh();
      } else {
        setPullDistance(0);
      }
    };

    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', onTouchEnd);

    return () => {
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
    };
  }, [pullDistance, isRefreshing, handleRefresh]);

  const progress = Math.min(pullDistance / THRESHOLD, 1);

  return (
    <>
      {/* Pull indicator */}
      {(pullDistance > 0 || isRefreshing) && (
        <div
          className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-center pointer-events-none"
          style={{ height: `${pullDistance}px`, transition: isRefreshing ? 'none' : 'height 0.1s ease-out' }}
        >
          <div
            className={`
              flex items-center justify-center w-10 h-10 rounded-full
              bg-background border border-border shadow-lg
              transition-transform
            `}
            style={{
              opacity: progress,
              transform: `rotate(${progress * 360}deg)`,
            }}
          >
            <Loader2
              className={`h-5 w-5 text-primary ${isRefreshing ? 'animate-spin' : ''}`}
            />
          </div>
        </div>
      )}

      {/* Content pushed down */}
      <div
        style={{
          transform: pullDistance > 0 ? `translateY(${pullDistance}px)` : 'none',
          transition: isPulling.current ? 'none' : 'transform 0.3s ease-out',
        }}
      >
        {children}
      </div>
    </>
  );
};

export default PullToRefresh;
