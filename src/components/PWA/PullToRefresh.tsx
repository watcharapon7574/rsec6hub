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
  const moveCount = useRef(0);
  const touchStartTime = useRef(0);

  // Keep refs in sync with state
  useEffect(() => { pullDistanceRef.current = pullDistance; }, [pullDistance]);
  useEffect(() => { isRefreshingRef.current = isRefreshing; }, [isRefreshing]);

  // Register touch listeners once
  useEffect(() => {
    // Check ALL possible scroll positions (iOS PWA can have different scroll containers)
    const isAtTop = () => {
      const scrollY = window.scrollY || window.pageYOffset || 0;
      const docScrollTop = document.documentElement.scrollTop || 0;
      const bodyScrollTop = document.body.scrollTop || 0;
      const scrollingEl = document.scrollingElement?.scrollTop || 0;
      return Math.max(scrollY, docScrollTop, bodyScrollTop, scrollingEl) === 0;
    };

    const onTouchStart = (e: TouchEvent) => {
      const atTop = isAtTop();
      startScrollY.current = atTop ? 0 : 1;
      moveCount.current = 0;
      touchStartTime.current = Date.now();
      if (!atTop || isRefreshingRef.current) return;
      touchStartY.current = e.touches[0].clientY;
      isPulling.current = true;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!isPulling.current || isRefreshingRef.current) return;

      moveCount.current++;

      // Cancel if page is no longer at top
      if (!isAtTop()) {
        isPulling.current = false;
        pullDistanceRef.current = 0;
        setPullDistance(0);
        return;
      }

      const currentY = e.touches[0].clientY;
      const diff = currentY - touchStartY.current;

      if (diff > 0) {
        // Require at least 5 touchmove events (slow deliberate pull)
        if (moveCount.current < 5) {
          const distance = Math.min(diff * 0.3, THRESHOLD * 0.5);
          pullDistanceRef.current = distance;
          setPullDistance(distance);
          if (distance > 10) e.preventDefault();
          return;
        }

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

      const elapsed = Date.now() - touchStartTime.current;

      // Require: enough move events AND enough time (>300ms) AND past threshold
      if (pullDistanceRef.current >= THRESHOLD && moveCount.current >= 5 && elapsed > 300) {
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
