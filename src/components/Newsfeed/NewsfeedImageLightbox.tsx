import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X, Play } from 'lucide-react';
import { transformImageUrl, imagePresets } from '@/utils/imageTransform';
import type { MediaItem } from './NewsfeedImageGrid';

interface Props {
  items: MediaItem[];
  startIndex: number;
  onClose: () => void;
}

const NewsfeedImageLightbox = ({ items, startIndex, onClose }: Props) => {
  const [current, setCurrent] = useState(startIndex);
  const [loaded, setLoaded] = useState<Record<number, boolean>>({});
  const backdropRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  const fullImages = useMemo(
    () => items.map(item =>
      item.type === 'image'
        ? (transformImageUrl(item.url, imagePresets.postFull) || item.url)
        : item.thumbnail
    ),
    [items]
  );

  const prev = useCallback(() => {
    setCurrent(c => (c > 0 ? c - 1 : items.length - 1));
  }, [items.length]);

  const next = useCallback(() => {
    setCurrent(c => (c < items.length - 1 ? c + 1 : 0));
  }, [items.length]);

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') prev();
      else if (e.key === 'ArrowRight') next();
      else if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [prev, next, onClose]);

  // Lock body scroll
  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, []);

  // Touch swipe on the backdrop
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const dx = touchStartX.current - e.changedTouches[0].clientX;
    const dy = touchStartY.current - e.changedTouches[0].clientY;
    // Only swipe horizontally if horizontal movement > vertical
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
      if (dx > 0) next();
      else prev();
    }
  };

  // Click backdrop to close
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === backdropRef.current) onClose();
  };

  const currentItem = items[current];

  const content = (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-[100] bg-black flex flex-col"
      onClick={handleBackdropClick}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0">
        <span className="text-white/80 text-sm font-medium">
          {current + 1} / {items.length}
        </span>
        <button
          onClick={onClose}
          className="text-white/80 hover:text-white p-1.5 rounded-full hover:bg-white/10 transition-colors"
        >
          <X className="h-6 w-6" />
        </button>
      </div>

      {/* Media area */}
      <div className="flex-1 min-h-0 flex items-center justify-center relative px-2">
        {currentItem.type === 'youtube' ? (
          /* YouTube iframe player */
          <div className="w-full max-w-4xl aspect-video">
            <iframe
              key={`yt-${currentItem.videoId}`}
              src={`https://www.youtube.com/embed/${currentItem.videoId}?autoplay=1`}
              className="w-full h-full rounded-lg"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              title="YouTube video"
            />
          </div>
        ) : (
          /* Image viewer */
          <>
            {!loaded[current] && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              </div>
            )}
            <img
              key={current}
              src={fullImages[current]}
              alt=""
              className="max-h-full max-w-full object-contain select-none"
              style={{ opacity: loaded[current] ? 1 : 0, transition: 'opacity 0.2s' }}
              draggable={false}
              onLoad={() => setLoaded(prev => ({ ...prev, [current]: true }))}
            />
          </>
        )}

        {/* Nav arrows — desktop only */}
        {items.length > 1 && (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); prev(); }}
              className="hidden sm:flex absolute left-2 top-1/2 -translate-y-1/2 text-white/60 hover:text-white bg-black/40 hover:bg-black/60 rounded-full p-2 transition-colors"
            >
              <ChevronLeft className="h-7 w-7" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); next(); }}
              className="hidden sm:flex absolute right-2 top-1/2 -translate-y-1/2 text-white/60 hover:text-white bg-black/40 hover:bg-black/60 rounded-full p-2 transition-colors"
            >
              <ChevronRight className="h-7 w-7" />
            </button>
          </>
        )}
      </div>

      {/* Thumbnail strip */}
      {items.length > 1 && (
        <div className="flex items-center justify-center gap-1.5 px-4 py-3 shrink-0 overflow-x-auto">
          {items.map((item, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`relative shrink-0 w-12 h-12 rounded-lg overflow-hidden border-2 transition-all ${
                i === current
                  ? 'border-white opacity-100 scale-105'
                  : 'border-transparent opacity-50 hover:opacity-80'
              }`}
            >
              <img
                src={item.type === 'image' ? item.url : item.thumbnail}
                alt=""
                className="w-full h-full object-cover"
                loading="lazy"
              />
              {item.type === 'youtube' && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Play className="h-4 w-4 text-white fill-white drop-shadow" />
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  return createPortal(content, document.body);
};

export default NewsfeedImageLightbox;
