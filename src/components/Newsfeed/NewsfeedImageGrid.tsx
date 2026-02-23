import { useState, useMemo, useCallback } from 'react';
import { transformImageUrl, imagePresets } from '@/utils/imageTransform';
import { Skeleton } from '@/components/ui/skeleton';
import NewsfeedImageLightbox from './NewsfeedImageLightbox';

interface Props {
  images: string[];
}

/**
 * Facebook-style image grid for newsfeed posts.
 * 1 image  → full width, adaptive ratio (max ~500px)
 * 2 images → side by side, square-ish
 * 3 images → 1 tall left + 2 stacked right
 * 4 images → 1 tall left + 3 stacked right
 * 5+ images → 2 top + 3 bottom, last has "+N" overlay
 */
const NewsfeedImageGrid = ({ images }: Props) => {
  const thumbnails = useMemo(
    () => images.map(url => transformImageUrl(url, imagePresets.postThumbnail) || url),
    [images]
  );
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [startIndex, setStartIndex] = useState(0);
  const [loaded, setLoaded] = useState<Record<number, boolean>>({});

  const handleLoad = useCallback((index: number) => {
    setLoaded(prev => ({ ...prev, [index]: true }));
  }, []);

  if (images.length === 0) return null;

  const openLightbox = (index: number) => {
    setStartIndex(index);
    setLightboxOpen(true);
  };

  const count = images.length;
  const thumb = thumbnails.slice(0, 5);
  const moreCount = count - 5;

  const imgClass = 'object-cover w-full h-full min-h-0 cursor-pointer hover:brightness-95 active:brightness-90 transition-all';

  // Render function (NOT a component) to avoid remounting on state changes
  const renderImg = (src: string, index: number, className?: string) => (
    <div key={index} className={`relative overflow-hidden ${className || ''}`} onClick={() => openLightbox(index)}>
      {!loaded[index] && <Skeleton className="absolute inset-0 rounded-none" />}
      <img
        src={src} alt="" loading="lazy"
        className={`${imgClass} ${!loaded[index] ? 'opacity-0' : 'opacity-100'}`}
        onLoad={() => handleLoad(index)}
      />
    </div>
  );

  const renderGrid = () => {
    // 1 image — full width, natural ratio, max height
    if (thumb.length === 1) {
      return (
        <div className="overflow-hidden">
          <div className="relative min-h-[200px]" onClick={() => openLightbox(0)}>
            {!loaded[0] && <Skeleton className="absolute inset-0 rounded-none" />}
            <img
              src={thumb[0]} alt="" loading="lazy"
              className={`${imgClass} max-h-[500px] w-full ${!loaded[0] ? 'opacity-0' : 'opacity-100'}`}
              onLoad={() => handleLoad(0)}
            />
          </div>
        </div>
      );
    }

    // 2 images — side by side, square-ish
    if (thumb.length === 2) {
      return (
        <div className="grid grid-cols-2 gap-[2px] overflow-hidden" style={{ height: '300px' }}>
          {thumb.map((img, i) => renderImg(img, i))}
        </div>
      );
    }

    // 3 images — 1 tall left (50%) + 2 stacked right
    if (thumb.length === 3) {
      return (
        <div className="grid grid-cols-2 grid-rows-2 gap-[2px] overflow-hidden" style={{ height: '400px' }}>
          {renderImg(thumb[0], 0, 'row-span-2')}
          {renderImg(thumb[1], 1)}
          {renderImg(thumb[2], 2)}
        </div>
      );
    }

    // 4 images — 1 tall left (50%) + 3 stacked right
    if (thumb.length === 4) {
      return (
        <div className="grid grid-cols-2 grid-rows-3 gap-[2px] overflow-hidden" style={{ height: '400px' }}>
          {renderImg(thumb[0], 0, 'row-span-3')}
          {renderImg(thumb[1], 1)}
          {renderImg(thumb[2], 2)}
          {renderImg(thumb[3], 3)}
        </div>
      );
    }

    // 5+ images — 2 top row + 3 bottom row
    return (
      <div className="grid grid-cols-6 grid-rows-2 gap-[2px] overflow-hidden" style={{ height: '400px' }}>
        {/* Top row: 2 images */}
        {renderImg(thumb[0], 0, 'col-span-3')}
        {renderImg(thumb[1], 1, 'col-span-3')}
        {/* Bottom row: 3 images */}
        {renderImg(thumb[2], 2, 'col-span-2')}
        {renderImg(thumb[3], 3, 'col-span-2')}
        <div className="relative col-span-2 cursor-pointer overflow-hidden" onClick={() => openLightbox(4)}>
          {!loaded[4] && <Skeleton className="absolute inset-0 rounded-none" />}
          <img
            src={thumb[4]} alt="" loading="lazy"
            className={`${imgClass} ${!loaded[4] ? 'opacity-0' : 'opacity-100'}`}
            onLoad={() => handleLoad(4)}
          />
          {moreCount > 0 && (
            <div className="absolute inset-0 bg-black/45 flex items-center justify-center">
              <span className="text-white text-3xl font-semibold">+{moreCount}</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      {renderGrid()}
      {lightboxOpen && (
        <NewsfeedImageLightbox
          images={images}
          startIndex={startIndex}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </>
  );
};

export default NewsfeedImageGrid;
