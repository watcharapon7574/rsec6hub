import { useState, useMemo } from 'react';
import { transformImageUrl, imagePresets } from '@/utils/imageTransform';
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

  if (images.length === 0) return null;

  const openLightbox = (index: number) => {
    setStartIndex(index);
    setLightboxOpen(true);
  };

  const count = images.length;
  const thumb = thumbnails.slice(0, 5);
  const moreCount = count - 5;

  const imgClass = 'object-cover w-full h-full min-h-0 cursor-pointer hover:brightness-95 active:brightness-90 transition-all';

  const renderGrid = () => {
    // 1 image — full width, natural ratio, max height
    if (thumb.length === 1) {
      return (
        <div className="overflow-hidden">
          <img
            src={thumb[0]} alt="" loading="lazy"
            className={`${imgClass} max-h-[500px] w-full`}
            onClick={() => openLightbox(0)}
          />
        </div>
      );
    }

    // 2 images — side by side, square-ish
    if (thumb.length === 2) {
      return (
        <div className="grid grid-cols-2 gap-[2px] overflow-hidden" style={{ height: '300px' }}>
          {thumb.map((img, i) => (
            <img key={i} src={img} alt="" loading="lazy" className={imgClass} onClick={() => openLightbox(i)} />
          ))}
        </div>
      );
    }

    // 3 images — 1 tall left (50%) + 2 stacked right
    if (thumb.length === 3) {
      return (
        <div className="grid grid-cols-2 grid-rows-2 gap-[2px] overflow-hidden" style={{ height: '400px' }}>
          <img src={thumb[0]} alt="" loading="lazy" className={`${imgClass} row-span-2`} onClick={() => openLightbox(0)} />
          <img src={thumb[1]} alt="" loading="lazy" className={imgClass} onClick={() => openLightbox(1)} />
          <img src={thumb[2]} alt="" loading="lazy" className={imgClass} onClick={() => openLightbox(2)} />
        </div>
      );
    }

    // 4 images — 1 tall left (50%) + 3 stacked right
    if (thumb.length === 4) {
      return (
        <div className="grid grid-cols-2 grid-rows-3 gap-[2px] overflow-hidden" style={{ height: '400px' }}>
          <img src={thumb[0]} alt="" loading="lazy" className={`${imgClass} row-span-3`} onClick={() => openLightbox(0)} />
          <img src={thumb[1]} alt="" loading="lazy" className={imgClass} onClick={() => openLightbox(1)} />
          <img src={thumb[2]} alt="" loading="lazy" className={imgClass} onClick={() => openLightbox(2)} />
          <img src={thumb[3]} alt="" loading="lazy" className={imgClass} onClick={() => openLightbox(3)} />
        </div>
      );
    }

    // 5+ images — 2 top row + 3 bottom row
    return (
      <div className="grid grid-cols-6 grid-rows-2 gap-[2px] overflow-hidden" style={{ height: '400px' }}>
        {/* Top row: 2 images */}
        <img src={thumb[0]} alt="" loading="lazy" className={`${imgClass} col-span-3`} onClick={() => openLightbox(0)} />
        <img src={thumb[1]} alt="" loading="lazy" className={`${imgClass} col-span-3`} onClick={() => openLightbox(1)} />
        {/* Bottom row: 3 images */}
        <img src={thumb[2]} alt="" loading="lazy" className={`${imgClass} col-span-2`} onClick={() => openLightbox(2)} />
        <img src={thumb[3]} alt="" loading="lazy" className={`${imgClass} col-span-2`} onClick={() => openLightbox(3)} />
        <div className="relative col-span-2 cursor-pointer overflow-hidden" onClick={() => openLightbox(4)}>
          <img src={thumb[4]} alt="" loading="lazy" className={imgClass} />
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
