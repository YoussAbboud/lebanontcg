import { useRef, useState } from 'react';
import type { ImageDraft } from '../lib/types';
import { MAX_LISTING_IMAGES } from '../lib/types';
import { ImageCropper } from './ImageCropper';
import { CornerPinCropper } from './pregrade/CornerPinCropper';
import './imagemanager.css';
import { looksLikePickedImage } from '../lib/heic';

interface Props {
  images: ImageDraft[];
  onChange(next: ImageDraft[]): void;
  error?: string;
}

/** Listing crops keep their chosen shape; only the long edge is capped. */
const LISTING_OUT_LONG_EDGE = 1600;

let draftCounter = 0;

/**
 * Photo picker for the listing form: every added photo goes through the
 * free crop dialog (resizable selection — any shape), drag-to-reorder
 * with keyboard fallback (← → buttons), first image is the cover.
 */
export function ImageManager({ images, onChange, error }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  // Files waiting for their crop step, front of the array first.
  const [cropQueue, setCropQueue] = useState<File[]>([]);
  // Free rectangle by default; "pin" is the pre-grade corner-pin tool —
  // drop four free pins on the card's corners and the shot flattens to a
  // clean card. Two-way switch inside either dialog.
  const [cropMode, setCropMode] = useState<'rect' | 'pin'>('rect');

  const addFiles = (files: FileList | File[]) => {
    const room = MAX_LISTING_IMAGES - images.length - cropQueue.length;
    const list = [...files].filter(looksLikePickedImage);
    if (list.length === 0 || room <= 0) return;
    setAddError(
      list.length > room
        ? `Only ${MAX_LISTING_IMAGES} photos per listing — dropped ${list.length - room}.`
        : null,
    );
    setCropQueue((q) => [...q, ...list.slice(0, room)]);
  };

  const move = (from: number, to: number) => {
    if (to < 0 || to >= images.length) return;
    const next = [...images];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  };

  const remove = (index: number) => {
    const item = images[index];
    if (item.kind === 'new') URL.revokeObjectURL(item.url);
    onChange(images.filter((_, i) => i !== index));
  };

  return (
    <div className="imgr">
      <div
        className={`imgr-grid ${images.length === 0 ? 'imgr-grid-empty' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
        }}
        onDrop={(e) => {
          e.preventDefault();
          if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
        }}
      >
        {images.map((img, i) => (
          <figure
            key={img.id}
            className={`imgr-thumb card-surface ${overIndex === i && dragIndex !== null && dragIndex !== i ? 'imgr-thumb-over' : ''}`}
            draggable
            onDragStart={() => setDragIndex(i)}
            onDragEnd={() => {
              setDragIndex(null);
              setOverIndex(null);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setOverIndex(i);
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (dragIndex !== null && dragIndex !== i) move(dragIndex, i);
              setDragIndex(null);
              setOverIndex(null);
            }}
          >
            <img src={img.url} alt={`Photo ${i + 1}`} />
            {i === 0 && <figcaption className="imgr-cover microlabel">Cover</figcaption>}
            <div className="imgr-tools glass">
              <button
                type="button"
                aria-label={`Move photo ${i + 1} earlier`}
                disabled={i === 0}
                onClick={() => move(i, i - 1)}
              >
                ‹
              </button>
              <button
                type="button"
                aria-label={`Remove photo ${i + 1}`}
                className="imgr-remove"
                onClick={() => remove(i)}
              >
                ✕
              </button>
              <button
                type="button"
                aria-label={`Move photo ${i + 1} later`}
                disabled={i === images.length - 1}
                onClick={() => move(i, i + 1)}
              >
                ›
              </button>
            </div>
          </figure>
        ))}

        {images.length + cropQueue.length < MAX_LISTING_IMAGES && (
          <button type="button" className="imgr-add" onClick={() => inputRef.current?.click()}>
            <span className="imgr-add-plus" aria-hidden="true">+</span>
            <span>
              Add photos
              <small>
                {images.length}/{MAX_LISTING_IMAGES} · drag to reorder
              </small>
            </span>
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*,.heic,.heif"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files?.length) addFiles(e.target.files);
          e.target.value = '';
        }}
      />

      {(error || addError) && (
        <p className="field-error" role="alert">
          {error ?? addError}
        </p>
      )}

      {cropQueue.length > 0 &&
        (cropMode === 'pin' ? (
          <CornerPinCropper
            file={cropQueue[0]}
            title="Pin the card's corners"
            onCancel={() => setCropQueue((q) => q.slice(1))}
            onUseRectCrop={() => setCropMode('rect')}
            onDone={(out) => {
              onChange([
                ...images,
                { id: `draft-${++draftCounter}`, kind: 'new', url: out.url, file: out.blob },
              ]);
              setCropQueue((q) => q.slice(1));
            }}
          />
        ) : (
          <ImageCropper
            file={cropQueue[0]}
            outLongEdge={LISTING_OUT_LONG_EDGE}
            title="Crop your photo"
            onCancel={() => setCropQueue((q) => q.slice(1))}
            onUsePinCrop={() => setCropMode('pin')}
            onDone={(out) => {
              onChange([
                ...images,
                { id: `draft-${++draftCounter}`, kind: 'new', url: out.url, file: out.blob },
              ]);
              setCropQueue((q) => q.slice(1));
            }}
          />
        ))}
    </div>
  );
}
