import { useState, useMemo, useCallback } from 'react';
import { Play } from 'lucide-react';
import { transformImageUrl, imagePresets } from '@/utils/imageTransform';
import { Skeleton } from '@/components/ui/skeleton';
import NewsfeedImageLightbox from './NewsfeedImageLightbox';

export type MediaItem =
  | { type: 'image'; url: string }
  | { type: 'youtube'; videoId: string; thumbnail: string };

interface Props {
  images: string[];
  youtubeUrl?: string | null;
}

const getYouTubeId = (url: string): string | null => {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/);
  return match?.[1] ?? null;
};

/**
 * Facebook-style media grid for newsfeed posts.
 * Supports images + YouTube video (shown as thumbnail with play icon).
 * 1 item  → full width, adaptive ratio (max ~500px)
 * 2 items → side by side, square-ish
 * 3 items → 1 tall left + 2 stacked right
 * 4 items → 1 tall left + 3 stacked right
 * 5+ items → 2 top + 3 bottom, last has "+N" overlay
 */
const NewsfeedImageGrid = ({ images, youtubeUrl }: Props) => {
  // Build unified media items list
  const mediaItems = useMemo<MediaItem[]>(() => {
    const items: MediaItem[] = images.map(url => ({ type: 'image', url }));
    if (youtubeUrl) {
      const videoId = getYouTubeId(youtubeUrl);
      if (videoId) {
        items.push({
          type: 'youtube',
          videoId,
          thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
        });
      }
    }
    return items;
  }, [images, youtubeUrl]);

  const thumbnails = useMemo(
    () => mediaItems.map(item =>
      item.type === 'image'
        ? (transformImageUrl(item.url, imagePresets.postThumbnail) || item.url)
        : item.thumbnail
    ),
    [mediaItems]
  );

  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [startIndex, setStartIndex] = useState(0);
  const [loaded, setLoaded] = useState<Record<number, boolean>>({});

  const handleLoad = useCallback((index: number) => {
    setLoaded(prev => ({ ...prev, [index]: true }));
  }, []);

  if (mediaItems.length === 0) return null;

  const openLightbox = (index: number) => {
    setStartIndex(index);
    setLightboxOpen(true);
  };

  const count = mediaItems.length;
  const thumb = thumbnails.slice(0, 5);
  const moreCount = count - 5;

  const imgClass = 'object-cover w-full h-full min-h-0 cursor-pointer hover:brightness-95 active:brightness-90 transition-all';

  // Play icon overlay for YouTube thumbnails
  const playOverlay = (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div className="w-14 h-14 rounded-full bg-black/60 flex items-center justify-center backdrop-blur-sm">
        <Play className="h-7 w-7 text-white fill-white ml-0.5" />
      </div>
    </div>
  );

  const isVideo = (index: number) => mediaItems[index]?.type === 'youtube';

  // Render function (NOT a component) to avoid remounting on state changes
  const renderImg = (src: string, index: number, className?: string) => (
    <div key={index} className={`relative overflow-hidden ${className || ''}`} onClick={() => openLightbox(index)}>
      {!loaded[index] && <Skeleton className="absolute inset-0 rounded-none" />}
      <img
        src={src} alt="" loading="lazy"
        className={`${imgClass} ${!loaded[index] ? 'opacity-0' : 'opacity-100'}`}
        onLoad={() => handleLoad(index)}
      />
      {isVideo(index) && playOverlay}
    </div>
  );

  const renderGrid = () => {
    // 1 item — full width, natural ratio, max height
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
            {isVideo(0) && playOverlay}
          </div>
        </div>
      );
    }

    // 2 items — side by side, square-ish
    if (thumb.length === 2) {
      return (
        <div className="grid grid-cols-2 gap-[2px] overflow-hidden" style={{ height: '300px' }}>
          {thumb.map((img, i) => renderImg(img, i))}
        </div>
      );
    }

    // 3 items — 1 tall left (50%) + 2 stacked right
    if (thumb.length === 3) {
      return (
        <div className="grid grid-cols-2 grid-rows-2 gap-[2px] overflow-hidden" style={{ height: '400px' }}>
          {renderImg(thumb[0], 0, 'row-span-2')}
          {renderImg(thumb[1], 1)}
          {renderImg(thumb[2], 2)}
        </div>
      );
    }

    // 4 items — 1 tall left (50%) + 3 stacked right
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

    // 5+ items — 2 top row + 3 bottom row
    return (
      <div className="grid grid-cols-6 grid-rows-2 gap-[2px] overflow-hidden" style={{ height: '400px' }}>
        {/* Top row: 2 items */}
        {renderImg(thumb[0], 0, 'col-span-3')}
        {renderImg(thumb[1], 1, 'col-span-3')}
        {/* Bottom row: 3 items */}
        {renderImg(thumb[2], 2, 'col-span-2')}
        {renderImg(thumb[3], 3, 'col-span-2')}
        <div className="relative col-span-2 cursor-pointer overflow-hidden" onClick={() => openLightbox(4)}>
          {!loaded[4] && <Skeleton className="absolute inset-0 rounded-none" />}
          <img
            src={thumb[4]} alt="" loading="lazy"
            className={`${imgClass} ${!loaded[4] ? 'opacity-0' : 'opacity-100'}`}
            onLoad={() => handleLoad(4)}
          />
          {isVideo(4) && playOverlay}
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
          items={mediaItems}
          startIndex={startIndex}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </>
  );
};

export default NewsfeedImageGrid;
