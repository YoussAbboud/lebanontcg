import { useRef, useState } from 'react';
import type { ImageDraft } from '../lib/types';
import { MAX_LISTING_IMAGES } from '../lib/types';
import { compressImage } from '../lib/image';
import './imagemanager.css';

interface Props {
  images: ImageDraft[];
  onChange(next: ImageDraft[]): void;
  error?: string;
}

let draftCounter = 0;

/**
 * Photo picker for the listing form: compresses on add, drag-to-reorder
 * with keyboard fallback (← → buttons), first image is the cover.
 */
export function ImageManager({ images, onChange, error }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  const addFiles = async (files: FileList | File[]) => {
    const room = MAX_LISTING_IMAGES - images.length;
    const list = [...files].filter((f) => f.type.startsWith('image/'));
    if (list.length === 0) return;
    setBusy(true);
    setAddError(null);
    try {
      const compressed: ImageDraft[] = [];
      for (const file of list.slice(0, room)) {
        const out = await compressImage(file);
        compressed.push({ id: `draft-${++draftCounter}`, kind: 'new', url: out.url, file: out.blob });
      }
      onChange([...images, ...compressed]);
      if (list.length > room) {
        setAddError(`Only ${MAX_LISTING_IMAGES} photos per listing — dropped ${list.length - room}.`);
      }
    } catch {
      setAddError("Couldn't process that image — try a JPEG or PNG.");
    } finally {
      setBusy(false);
    }
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
          if (e.dataTransfer.files?.length) void addFiles(e.dataTransfer.files);
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

        {images.length < MAX_LISTING_IMAGES && (
          <button
            type="button"
            className="imgr-add"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
          >
            {busy ? (
              <span className="imgr-busy">Compressing…</span>
            ) : (
              <>
                <span className="imgr-add-plus" aria-hidden="true">+</span>
                <span>
                  Add photos
                  <small>
                    {images.length}/{MAX_LISTING_IMAGES} · drag to reorder
                  </small>
                </span>
              </>
            )}
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files?.length) void addFiles(e.target.files);
          e.target.value = '';
        }}
      />

      {(error || addError) && (
        <p className="field-error" role="alert">
          {error ?? addError}
        </p>
      )}
    </div>
  );
}
