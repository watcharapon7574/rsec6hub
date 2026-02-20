import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

interface Props {
  images: string[];
  startIndex: number;
  onClose: () => void;
}

const NewsfeedImageLightbox = ({ images, startIndex, onClose }: Props) => {
  const [current, setCurrent] = useState(startIndex);

  const prev = useCallback(() => {
    setCurrent(c => (c > 0 ? c - 1 : images.length - 1));
  }, [images.length]);

  const next = useCallback(() => {
    setCurrent(c => (c < images.length - 1 ? c + 1 : 0));
  }, [images.length]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') prev();
      else if (e.key === 'ArrowRight') next();
      else if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [prev, next, onClose]);

  // Touch swipe
  useEffect(() => {
    let startX = 0;
    const handleTouchStart = (e: TouchEvent) => {
      startX = e.touches[0].clientX;
    };
    const handleTouchEnd = (e: TouchEvent) => {
      const diff = startX - e.changedTouches[0].clientX;
      if (Math.abs(diff) > 50) {
        if (diff > 0) next();
        else prev();
      }
    };
    window.addEventListener('touchstart', handleTouchStart);
    window.addEventListener('touchend', handleTouchEnd);
    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [prev, next]);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-[100vw] w-[100vw] h-[100dvh] p-0 bg-black/95 border-none [&>button]:hidden">
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-50 text-white/80 hover:text-white bg-black/40 rounded-full p-2"
        >
          <X className="h-6 w-6" />
        </button>

        {/* Counter */}
        <div className="absolute top-4 left-4 z-50 text-white/80 text-sm bg-black/40 rounded-full px-3 py-1">
          {current + 1} / {images.length}
        </div>

        {/* Image */}
        <div className="flex items-center justify-center h-full">
          <img
            src={images[current]}
            alt=""
            className="max-h-[90dvh] max-w-[95vw] object-contain"
          />
        </div>

        {/* Nav arrows */}
        {images.length > 1 && (
          <>
            <button
              onClick={prev}
              className="absolute left-2 top-1/2 -translate-y-1/2 z-50 text-white/70 hover:text-white bg-black/30 hover:bg-black/50 rounded-full p-2"
            >
              <ChevronLeft className="h-8 w-8" />
            </button>
            <button
              onClick={next}
              className="absolute right-2 top-1/2 -translate-y-1/2 z-50 text-white/70 hover:text-white bg-black/30 hover:bg-black/50 rounded-full p-2"
            >
              <ChevronRight className="h-8 w-8" />
            </button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default NewsfeedImageLightbox;
