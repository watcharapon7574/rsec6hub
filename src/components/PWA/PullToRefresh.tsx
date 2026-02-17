import React, { useRef, useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';

interface PullToRefreshProps {
  children: React.ReactNode;
}

const THRESHOLD = 80;
const MAX_PULL = 120;

const PullToRefresh: React.FC<PullToRefreshProps> = ({ children }) => {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const touchStartY = useRef(0);
  const isPulling = useRef(false);
  const pullDistanceRef = useRef(0);
  const isRefreshingRef = useRef(false);
  const startScrollY = useRef(0);

  // Keep refs in sync with state
  useEffect(() => { pullDistanceRef.current = pullDistance; }, [pullDistance]);
  useEffect(() => { isRefreshingRef.current = isRefreshing; }, [isRefreshing]);

  // Register touch listeners once
  useEffect(() => {
    const getScrollTop = () => Math.max(window.scrollY, document.documentElement.scrollTop, 0);

    const onTouchStart = (e: TouchEvent) => {
      const scrollTop = getScrollTop();
      startScrollY.current = scrollTop;
      // Only allow pull-to-refresh when truly at the top
      if (scrollTop > 5 || isRefreshingRef.current) return;
      touchStartY.current = e.touches[0].clientY;
      isPulling.current = true;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!isPulling.current || isRefreshingRef.current) return;

      // Double-check: if page scrolled since touchstart, cancel pull
      if (startScrollY.current > 5 || getScrollTop() > 5) {
        isPulling.current = false;
        pullDistanceRef.current = 0;
        setPullDistance(0);
        return;
      }

      const currentY = e.touches[0].clientY;
      const diff = currentY - touchStartY.current;

      if (diff > 0 && getScrollTop() <= 5) {
        const distance = Math.min(diff * 0.5, MAX_PULL);
        pullDistanceRef.current = distance;
        setPullDistance(distance);

        if (distance > 10) {
          e.preventDefault();
        }
      } else {
        isPulling.current = false;
        pullDistanceRef.current = 0;
        setPullDistance(0);
      }
    };

    const onTouchEnd = () => {
      if (!isPulling.current || isRefreshingRef.current) return;
      isPulling.current = false;

      if (pullDistanceRef.current >= THRESHOLD) {
        isRefreshingRef.current = true;
        setIsRefreshing(true);
        setPullDistance(THRESHOLD);
        setTimeout(() => window.location.reload(), 500);
      } else {
        pullDistanceRef.current = 0;
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
  }, []); // Empty deps - register once

  const progress = Math.min(pullDistance / THRESHOLD, 1);

  return (
    <>
      {(pullDistance > 0 || isRefreshing) && (
        <div
          className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-center pointer-events-none"
          style={{ height: `${pullDistance}px` }}
        >
          <div
            className="flex items-center justify-center w-10 h-10 rounded-full bg-background border border-border shadow-lg"
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
