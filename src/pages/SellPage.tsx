import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { Condition, Finish, Game, ImageDraft, ListingInput } from '../lib/types';
import {
  CONDITIONS,
  CONDITION_LABELS,
  FINISHES,
  FINISH_LABELS,
  GAMES,
  GAME_LABELS,
} from '../lib/types';
import { useApp } from '../state/AppContext';
import { ImageManager } from '../components/ImageManager';
import './sell.css';

interface FormState {
  title: string;
  game: Game;
  setName: string;
  cardNumber: string;
  language: string;
  condition: Condition;
  finish: Finish;
  graded: boolean;
  gradeCompany: string;
  gradeValue: string;
  price: string;
  quantity: string;
  description: string;
}

const BLANK: FormState = {
  title: '',
  game: 'pokemon',
  setName: '',
  cardNumber: '',
  language: 'English',
  condition: 'NM',
  finish: 'normal',
  graded: false,
  gradeCompany: 'PSA',
  gradeValue: '',
  price: '',
  quantity: '1',
  description: '',
};

type Errors = Partial<Record<keyof FormState | 'images', string>>;

function validate(form: FormState, images: ImageDraft[]): Errors {
  const errors: Errors = {};
  if (!form.title.trim()) errors.title = 'Give the listing a title.';
  else if (form.title.trim().length < 3) errors.title = 'Title is too short.';
  if (!form.setName.trim()) errors.setName = 'Which set is the card from?';
  const price = Number(form.price);
  if (form.price === '' || !Number.isFinite(price)) errors.price = 'Set an asking price.';
  else if (price <= 0) errors.price = 'Price must be above zero.';
  else if (price > 1_000_000) errors.price = 'Price is unrealistically high.';
  const qty = Number(form.quantity);
  if (!Number.isInteger(qty) || qty < 1) errors.quantity = 'Quantity must be at least 1.';
  else if (qty > 999) errors.quantity = 'Quantity is too large.';
  if (form.graded && !form.gradeValue.trim()) {
    errors.gradeValue = 'Enter the grade (e.g. "PSA 9").';
  }
  if (form.description.length > 2000) errors.description = 'Keep notes under 2,000 characters.';
  if (images.length === 0) errors.images = 'Add at least one photo of the actual card.';
  return errors;
}

export function SellPage() {
  const { id } = useParams<{ id: string }>();
  const editing = Boolean(id);
  const { client, user } = useApp();
  const navigate = useNavigate();

  const [form, setForm] = useState<FormState>(BLANK);
  const [images, setImages] = useState<ImageDraft[]>([]);
  const [errors, setErrors] = useState<Errors>({});
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'missing' | 'forbidden'>(
    editing ? 'loading' : 'ready',
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // Load the listing when editing.
  useEffect(() => {
    if (!id || !user) return;
    let cancelled = false;
    setLoadState('loading');
    client.getListing(id).then((listing) => {
      if (cancelled) return;
      if (!listing) {
        setLoadState('missing');
        return;
      }
      if (listing.sellerId !== user.id) {
        setLoadState('forbidden');
        return;
      }
      setForm({
        title: listing.title,
        game: listing.game,
        setName: listing.setName,
        cardNumber: listing.cardNumber,
        language: listing.language,
        condition: listing.condition,
        finish: listing.finish,
        graded: Boolean(listing.gradeValue),
        gradeCompany: listing.gradeCompany ?? 'PSA',
        gradeValue: listing.gradeValue ?? '',
        price: String(listing.price),
        quantity: String(listing.quantity),
        description: listing.description,
      });
      setImages(
        listing.images.map((img) => ({ id: img.id, kind: 'existing' as const, url: img.url })),
      );
      setLoadState('ready');
    });
    return () => {
      cancelled = true;
    };
  }, [client, id, user]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const descRemaining = 2000 - form.description.length;

  const input: ListingInput | null = useMemo(() => {
    if (Object.keys(validate(form, images)).length) return null;
    return {
      title: form.title.trim(),
      game: form.game,
      setName: form.setName.trim(),
      cardNumber: form.cardNumber.trim(),
      language: form.language,
      condition: form.condition,
      finish: form.finish,
      gradeCompany: form.graded ? form.gradeCompany.trim() || null : null,
      gradeValue: form.graded ? form.gradeValue.trim() : null,
      price: Number(form.price),
      currency: 'USD',
      quantity: Number(form.quantity),
      description: form.description.trim(),
    };
  }, [form, images]);

  if (!user) {
    return (
      <div className="empty-state">
        <div className="empty-glyph" aria-hidden="true" />
        <h3 className="display">Sell a card</h3>
        <p>Sign in to list cards for sale.</p>
        <Link to="/signin" className="btn btn-primary">Sign in</Link>
      </div>
    );
  }

  if (loadState === 'loading') {
    return (
      <div className="sell" aria-busy="true">
        <div className="skeleton" style={{ height: 40, width: 280 }} />
        <div className="skeleton" style={{ height: 420 }} />
      </div>
    );
  }

  if (loadState === 'missing' || loadState === 'forbidden') {
    return (
      <div className="empty-state">
        <div className="empty-glyph" aria-hidden="true" />
        <h3 className="display">
          {loadState === 'missing' ? 'Listing not found' : 'Not your listing'}
        </h3>
        <p>
          {loadState === 'missing'
            ? 'This listing no longer exists.'
            : 'Only the seller can edit a listing.'}
        </p>
        <Link to="/my-listings" className="btn btn-primary">My listings</Link>
      </div>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate(form, images);
    setErrors(errs);
    if (Object.keys(errs).length) {
      // Move focus to the first invalid control.
      requestAnimationFrame(() => {
        formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
      });
      return;
    }
    if (!input) return;
    setSaving(true);
    setSaveError(null);
    try {
      const listing = editing
        ? await client.updateListing(id!, input, images)
        : await client.createListing(input, images);
      navigate(`/listing/${listing.id}`);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Saving failed — try again.');
      setSaving(false);
    }
  };

  return (
    <form className="sell" onSubmit={submit} noValidate ref={formRef}>
      <header className="sell-head">
        <h1 className="display">{editing ? 'Edit listing' : 'Sell a card'}</h1>
        <p>
          Describe the exact card in hand — buyers will hold you to it. You&apos;ll arrange
          payment and delivery directly in chat.
        </p>
      </header>

      <section className="sell-section panel">
        <h2 className="microlabel sell-section-title">Card details</h2>
        <div className="sell-grid">
          <label className="field sell-span2">
            <span className="field-label">Title *</span>
            <input
              className="input"
              value={form.title}
              maxLength={120}
              placeholder="e.g. Charizard Base Set Unlimited"
              aria-invalid={Boolean(errors.title)}
              onChange={(e) => set('title', e.target.value)}
            />
            {errors.title && <span className="field-error">{errors.title}</span>}
          </label>

          <label className="field">
            <span className="field-label">Game *</span>
            <select
              className="select"
              value={form.game}
              onChange={(e) => set('game', e.target.value as Game)}
            >
              {GAMES.map((g) => (
                <option key={g} value={g}>{GAME_LABELS[g]}</option>
              ))}
            </select>
          </label>

          <label className="field">
            <span className="field-label">Language</span>
            <select
              className="select"
              value={form.language}
              onChange={(e) => set('language', e.target.value)}
            >
              {['English', 'Japanese', 'French', 'German', 'Italian', 'Spanish', 'Other'].map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
          </label>

          <label className="field">
            <span className="field-label">Set *</span>
            <input
              className="input"
              value={form.setName}
              maxLength={80}
              placeholder="e.g. Evolving Skies"
              aria-invalid={Boolean(errors.setName)}
              onChange={(e) => set('setName', e.target.value)}
            />
            {errors.setName && <span className="field-error">{errors.setName}</span>}
          </label>

          <label className="field">
            <span className="field-label">Card number</span>
            <input
              className="input"
              value={form.cardNumber}
              maxLength={30}
              placeholder="e.g. 215/203"
              onChange={(e) => set('cardNumber', e.target.value)}
            />
          </label>
        </div>
      </section>

      <section className="sell-section panel">
        <h2 className="microlabel sell-section-title">Condition &amp; grade</h2>
        <div className="sell-grid">
          <div className="field">
            <span className="field-label" id="cond-label">Condition *</span>
            <div className="sell-chiprow" role="radiogroup" aria-labelledby="cond-label">
              {CONDITIONS.map((c) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={form.condition === c}
                  className="chip"
                  aria-pressed={form.condition === c}
                  title={CONDITION_LABELS[c]}
                  onClick={() => set('condition', c)}
                >
                  {c}
                </button>
              ))}
            </div>
            <span className="field-hint">{CONDITION_LABELS[form.condition]}</span>
          </div>

          <label className="field">
            <span className="field-label">Finish</span>
            <select
              className="select"
              value={form.finish}
              onChange={(e) => set('finish', e.target.value as Finish)}
            >
              {FINISHES.map((f) => (
                <option key={f} value={f}>{FINISH_LABELS[f]}</option>
              ))}
            </select>
          </label>

          <div className="field sell-span2">
            <label className="sell-graded-toggle">
              <input
                type="checkbox"
                checked={form.graded}
                onChange={(e) => set('graded', e.target.checked)}
              />
              This card is professionally graded
            </label>
            {form.graded && (
              <div className="sell-grade-row">
                <label className="field">
                  <span className="field-label">Company</span>
                  <select
                    className="select"
                    value={form.gradeCompany}
                    onChange={(e) => set('gradeCompany', e.target.value)}
                  >
                    {['PSA', 'BGS', 'CGC', 'SGC', 'Other'].map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span className="field-label">Grade *</span>
                  <input
                    className="input"
                    value={form.gradeValue}
                    maxLength={20}
                    placeholder='e.g. "PSA 9" or "9.5"'
                    aria-invalid={Boolean(errors.gradeValue)}
                    onChange={(e) => set('gradeValue', e.target.value)}
                  />
                  {errors.gradeValue && <span className="field-error">{errors.gradeValue}</span>}
                </label>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="sell-section panel">
        <h2 className="microlabel sell-section-title">Price</h2>
        <div className="sell-grid">
          <label className="field">
            <span className="field-label">Asking price (USD) *</span>
            <input
              className="input"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={form.price}
              placeholder="0"
              aria-invalid={Boolean(errors.price)}
              onChange={(e) => set('price', e.target.value)}
            />
            {errors.price && <span className="field-error">{errors.price}</span>}
          </label>
          <label className="field">
            <span className="field-label">Quantity</span>
            <input
              className="input"
              type="number"
              min="1"
              step="1"
              inputMode="numeric"
              value={form.quantity}
              aria-invalid={Boolean(errors.quantity)}
              onChange={(e) => set('quantity', e.target.value)}
            />
            {errors.quantity && <span className="field-error">{errors.quantity}</span>}
          </label>
        </div>
        <p className="field-hint">
          LebanonTCG takes no cut and handles no payments — settle directly with the buyer.
        </p>
      </section>

      <section className="sell-section panel">
        <h2 className="microlabel sell-section-title">Photos *</h2>
        <p className="field-hint sell-photos-hint">
          1–8 photos of the actual card. First photo is the cover. Front, back, and close-ups of
          any wear sell cards faster.
        </p>
        <ImageManager images={images} onChange={setImages} error={errors.images} />
      </section>

      <section className="sell-section panel">
        <h2 className="microlabel sell-section-title">Description</h2>
        <label className="field">
          <span className="visually-hidden">Description</span>
          <textarea
            className="textarea"
            rows={5}
            value={form.description}
            maxLength={2000}
            placeholder="Print run, edgewear, whitening, sleeve/toploader situation, shipping or meetup preferences…"
            aria-invalid={Boolean(errors.description)}
            onChange={(e) => set('description', e.target.value)}
          />
          <span className={`field-hint ${descRemaining < 100 ? 'sell-count-low' : ''}`}>
            {descRemaining} characters left
          </span>
          {errors.description && <span className="field-error">{errors.description}</span>}
        </label>
      </section>

      {saveError && (
        <p className="field-error" role="alert">{saveError}</p>
      )}

      <div className="sell-actions">
        <button type="button" className="btn btn-ghost" onClick={() => navigate(-1)}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary btn-lg" disabled={saving}>
          {saving ? 'Saving…' : editing ? 'Save changes' : 'Publish listing'}
        </button>
      </div>
    </form>
  );
}
