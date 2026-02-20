import { useState } from 'react';
import NewsfeedImageLightbox from './NewsfeedImageLightbox';

interface Props {
  images: string[];
}

const NewsfeedImageGrid = ({ images }: Props) => {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [startIndex, setStartIndex] = useState(0);

  if (images.length === 0) return null;

  const openLightbox = (index: number) => {
    setStartIndex(index);
    setLightboxOpen(true);
  };

  const display = images.slice(0, 5);
  const moreCount = images.length - 5;

  const imgClass = 'object-cover w-full h-full cursor-pointer hover:opacity-90 transition-opacity';

  const renderGrid = () => {
    if (display.length === 1) {
      return (
        <div className="max-h-96 overflow-hidden">
          <img src={display[0]} alt="" loading="lazy" className={`${imgClass} max-h-96 w-full object-cover`} onClick={() => openLightbox(0)} />
        </div>
      );
    }

    if (display.length === 2) {
      return (
        <div className="grid grid-cols-2 gap-0.5 h-64">
          {display.map((img, i) => (
            <img key={i} src={img} alt="" loading="lazy" className={imgClass} onClick={() => openLightbox(i)} />
          ))}
        </div>
      );
    }

    if (display.length === 3) {
      return (
        <div className="grid grid-cols-2 gap-0.5 h-72">
          <img src={display[0]} alt="" loading="lazy" className={`${imgClass} row-span-2`} onClick={() => openLightbox(0)} />
          <img src={display[1]} alt="" loading="lazy" className={imgClass} onClick={() => openLightbox(1)} />
          <img src={display[2]} alt="" loading="lazy" className={imgClass} onClick={() => openLightbox(2)} />
        </div>
      );
    }

    if (display.length === 4) {
      return (
        <div className="grid grid-cols-2 gap-0.5 h-72">
          {display.map((img, i) => (
            <img key={i} src={img} alt="" loading="lazy" className={imgClass} onClick={() => openLightbox(i)} />
          ))}
        </div>
      );
    }

    // 5+ images
    return (
      <div className="grid grid-cols-6 grid-rows-2 gap-0.5 h-80">
        <img src={display[0]} alt="" loading="lazy" className={`${imgClass} col-span-3`} onClick={() => openLightbox(0)} />
        <img src={display[1]} alt="" loading="lazy" className={`${imgClass} col-span-3`} onClick={() => openLightbox(1)} />
        <img src={display[2]} alt="" loading="lazy" className={`${imgClass} col-span-2`} onClick={() => openLightbox(2)} />
        <img src={display[3]} alt="" loading="lazy" className={`${imgClass} col-span-2`} onClick={() => openLightbox(3)} />
        <div className="relative col-span-2 cursor-pointer" onClick={() => openLightbox(4)}>
          <img src={display[4]} alt="" loading="lazy" className={imgClass} />
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
