import { useEffect, useState } from 'react';
import type { ListingImage } from '../lib/types';
import './gallery.css';

/** Image gallery with arrows, thumbnails, and a glass counter chip (R1). */
export function Gallery({ images, title }: { images: ListingImage[]; title: string }) {
  const [index, setIndex] = useState(0);
  const count = images.length;

  // Clamp when images change (edit flow).
  useEffect(() => {
    if (index >= count) setIndex(0);
  }, [count, index]);

  if (count === 0) {
    return (
      <div className="gallery">
        <div className="gallery-main gallery-empty card-surface">
          <div className="empty-glyph" aria-hidden="true" />
          <p className="microlabel">No photos</p>
        </div>
      </div>
    );
  }

  const prev = () => setIndex((i) => (i - 1 + count) % count);
  const next = () => setIndex((i) => (i + 1) % count);

  return (
    <div className="gallery">
      <div
        className="gallery-main card-surface"
        role="group"
        aria-label={`Photos of ${title}, ${index + 1} of ${count}`}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') prev();
          if (e.key === 'ArrowRight') next();
        }}
      >
        <img src={images[index].url} alt={`${title} — photo ${index + 1}`} />
        {count > 1 && (
          <>
            <button className="gallery-arrow gallery-arrow-left glass" aria-label="Previous photo" onClick={prev}>
              ‹
            </button>
            <button className="gallery-arrow gallery-arrow-right glass" aria-label="Next photo" onClick={next}>
              ›
            </button>
            <span className="gallery-counter glass">{index + 1} / {count}</span>
          </>
        )}
      </div>
      {count > 1 && (
        <div className="gallery-thumbs" role="tablist" aria-label="Photo thumbnails">
          {images.map((img, i) => (
            <button
              key={img.id}
              role="tab"
              aria-selected={i === index}
              aria-label={`Photo ${i + 1}`}
              className={`gallery-thumb ${i === index ? 'gallery-thumb-on' : ''}`}
              onClick={() => setIndex(i)}
            >
              <img src={img.url} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
