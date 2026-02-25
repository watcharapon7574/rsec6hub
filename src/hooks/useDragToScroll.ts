import { useRef, useState, useCallback, useEffect } from 'react';

const DRAG_THRESHOLD = 5;

export function useDragToScroll() {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const startX = useRef(0);
  const scrollLeftStart = useRef(0);
  const hasMovedRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);

  // --- Mouse (desktop) ---
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const container = scrollContainerRef.current;
    if (!container) return;

    isDraggingRef.current = true;
    hasMovedRef.current = false;
    startX.current = e.clientX;
    scrollLeftStart.current = container.scrollLeft;
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const container = scrollContainerRef.current;
      if (!container) return;

      const dx = e.clientX - startX.current;
      if (!hasMovedRef.current && Math.abs(dx) < DRAG_THRESHOLD) return;

      hasMovedRef.current = true;
      setIsDragging(true);
      e.preventDefault();
      container.scrollLeft = scrollLeftStart.current - dx;
    };

    const handleMouseUp = () => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  // --- Touch (mobile) ---
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const container = scrollContainerRef.current;
    if (!container) return;

    isDraggingRef.current = true;
    hasMovedRef.current = false;
    startX.current = e.touches[0].clientX;
    scrollLeftStart.current = container.scrollLeft;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDraggingRef.current) return;
    const container = scrollContainerRef.current;
    if (!container) return;

    const dx = e.touches[0].clientX - startX.current;
    if (!hasMovedRef.current && Math.abs(dx) < DRAG_THRESHOLD) return;

    hasMovedRef.current = true;
    container.scrollLeft = scrollLeftStart.current - dx;
  }, []);

  const handleTouchEnd = useCallback(() => {
    isDraggingRef.current = false;
    hasMovedRef.current = false;
  }, []);

  // Prevent Link navigation when dragging
  const handleClickCapture = useCallback((e: React.MouseEvent) => {
    if (hasMovedRef.current) {
      e.preventDefault();
      e.stopPropagation();
      hasMovedRef.current = false;
    }
  }, []);

  return {
    scrollContainerRef,
    handleMouseDown,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleClickCapture,
    isDragging,
  };
}
