import { useState, useMemo } from 'react';
import { transformImageUrl, imagePresets } from '@/utils/imageTransform';
import NewsfeedImageLightbox from './NewsfeedImageLightbox';

interface Props {
  images: string[];
}

const NewsfeedImageGrid = ({ images }: Props) => {
  // Pre-transform thumbnail URLs (memoized so they don't recompute on every render)
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

  const imgClass = 'object-cover w-full h-full min-h-0 cursor-pointer hover:opacity-90 transition-opacity';

  const renderGrid = () => {
    if (thumb.length === 1) {
      return (
        <div className="max-h-96 overflow-hidden">
          <img src={thumb[0]} alt="" loading="lazy" className={`${imgClass} max-h-96 w-full object-cover`} onClick={() => openLightbox(0)} />
        </div>
      );
    }

    if (thumb.length === 2) {
      return (
        <div className="grid grid-cols-2 gap-0.5 h-64 overflow-hidden">
          {thumb.map((img, i) => (
            <img key={i} src={img} alt="" loading="lazy" className={imgClass} onClick={() => openLightbox(i)} />
          ))}
        </div>
      );
    }

    if (thumb.length === 3) {
      return (
        <div className="grid grid-cols-2 grid-rows-2 gap-0.5 h-72 overflow-hidden">
          <img src={thumb[0]} alt="" loading="lazy" className={`${imgClass} row-span-2`} onClick={() => openLightbox(0)} />
          <img src={thumb[1]} alt="" loading="lazy" className={imgClass} onClick={() => openLightbox(1)} />
          <img src={thumb[2]} alt="" loading="lazy" className={imgClass} onClick={() => openLightbox(2)} />
        </div>
      );
    }

    if (thumb.length === 4) {
      return (
        <div className="grid grid-cols-2 grid-rows-2 gap-0.5 h-72 overflow-hidden">
          {thumb.map((img, i) => (
            <img key={i} src={img} alt="" loading="lazy" className={imgClass} onClick={() => openLightbox(i)} />
          ))}
        </div>
      );
    }

    // 5+ images
    return (
      <div className="grid grid-cols-6 grid-rows-2 gap-0.5 h-80 overflow-hidden">
        <img src={thumb[0]} alt="" loading="lazy" className={`${imgClass} col-span-3`} onClick={() => openLightbox(0)} />
        <img src={thumb[1]} alt="" loading="lazy" className={`${imgClass} col-span-3`} onClick={() => openLightbox(1)} />
        <img src={thumb[2]} alt="" loading="lazy" className={`${imgClass} col-span-2`} onClick={() => openLightbox(2)} />
        <img src={thumb[3]} alt="" loading="lazy" className={`${imgClass} col-span-2`} onClick={() => openLightbox(3)} />
        <div className="relative col-span-2 cursor-pointer" onClick={() => openLightbox(4)}>
          <img src={thumb[4]} alt="" loading="lazy" className={imgClass} />
          {moreCount > 0 && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <span className="text-white text-2xl font-bold">+{moreCount}</span>
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
