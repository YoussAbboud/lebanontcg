import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { Condition, Finish, Game, ImageDraft, ListingInput, ListingWithSeller, SaleType } from '../lib/types';
import { AUCTION_DURATIONS, CONDITIONS, FINISHES, FINISH_LABELS, GAMES, GAME_LABELS } from '../lib/types';
import { useApp } from '../state/AppContext';
import { useToast } from '../state/ToastContext';
import { ImageManager } from '../components/ImageManager';
import { ListingCard } from '../components/ListingCard';
import './sell.css';

const STEPS = ['Photos', 'The card', 'The deal', 'Review'] as const;

const CONDITION_DESCRIPTIONS: Record<Condition, string> = {
  NM: "Looks pack fresh at arm's length.",
  LP: 'Light wear on the edges or back.',
  MP: 'Visible whitening or a soft corner.',
  HP: 'Heavy wear, still playable sleeved.',
  DMG: 'Creased, bent or water marked.',
};

interface FormState {
  saleType: SaleType;
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
  startingPrice: string;
  reservePrice: string;
  durationHours: number;
}

const BLANK: FormState = {
  saleType: 'fixed',
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
  startingPrice: '',
  reservePrice: '',
  durationHours: 24,
};

type Errors = Partial<
  Record<
    | 'images'
    | 'title'
    | 'setName'
    | 'gradeValue'
    | 'price'
    | 'quantity'
    | 'description'
    | 'startingPrice'
    | 'reservePrice',
    string
  >
>;

function validateStep(step: number, form: FormState, images: ImageDraft[]): Errors {
  const errors: Errors = {};
  if (step === 1 && images.length === 0) {
    errors.images = 'Add at least one photo of the actual card.';
  }
  if (step === 2) {
    if (!form.title.trim()) errors.title = 'Name the card.';
    else if (form.title.trim().length < 3) errors.title = 'Name is too short.';
    if (!form.setName.trim()) errors.setName = 'Which set is it from?';
    if (form.graded && !form.gradeValue.trim()) errors.gradeValue = 'Enter the grade (e.g. "PSA 9").';
  }
  if (step === 3) {
    if (form.saleType === 'auction') {
      const start = Number(form.startingPrice);
      if (form.startingPrice === '' || !Number.isFinite(start)) {
        errors.startingPrice = 'Set a starting price.';
      } else if (start <= 0) errors.startingPrice = 'Starting price must be above zero.';
      else if (start > 1_000_000) errors.startingPrice = 'Starting price is unrealistically high.';
      if (form.reservePrice !== '') {
        const reserve = Number(form.reservePrice);
        if (!Number.isFinite(reserve) || reserve <= 0) {
          errors.reservePrice = 'Reserve must be a price.';
        } else if (Number.isFinite(start) && reserve < start) {
          errors.reservePrice = 'The reserve cannot be below the starting price.';
        }
      }
    } else {
      const price = Number(form.price);
      if (form.price === '' || !Number.isFinite(price)) errors.price = 'Set an asking price.';
      else if (price <= 0) errors.price = 'Price must be above zero.';
      else if (price > 1_000_000) errors.price = 'Price is unrealistically high.';
      const qty = Number(form.quantity);
      if (!Number.isInteger(qty) || qty < 1) errors.quantity = 'Quantity must be at least 1.';
      else if (qty > 999) errors.quantity = 'Quantity is too large.';
    }
    if (form.description.length > 2000) errors.description = 'Keep notes under 2,000 characters.';
  }
  return errors;
}

export function SellPage() {
  const { id } = useParams<{ id: string }>();
  const editing = Boolean(id);
  const { client, user } = useApp();
  const toast = useToast();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(BLANK);
  const [images, setImages] = useState<ImageDraft[]>([]);
  const [errors, setErrors] = useState<Errors>({});
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'missing' | 'forbidden'>(
    editing ? 'loading' : 'ready',
  );
  const [saving, setSaving] = useState(false);

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
        saleType: listing.saleType,
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
        startingPrice: '',
        reservePrice: '',
        durationHours: 24,
      });
      setImages(listing.images.map((img) => ({ id: img.id, kind: 'existing' as const, url: img.url })));
      setLoadState('ready');
    });
    return () => {
      cancelled = true;
    };
  }, [client, id, user]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  /** The type is chosen once — switching mid-form clears the other
      type's fields rather than carrying them over. Published listings
      never reach here (the control is hidden while editing). */
  const switchType = (t: SaleType) => {
    setErrors({});
    setForm((f) =>
      f.saleType === t
        ? f
        : t === 'auction'
          ? { ...f, saleType: t, price: '', quantity: '1' }
          : { ...f, saleType: t, startingPrice: '', reservePrice: '', durationHours: 24 },
    );
  };

  const input: ListingInput = useMemo(
    () => ({
      title: form.title.trim(),
      game: form.game,
      setName: form.setName.trim(),
      cardNumber: form.cardNumber.trim(),
      language: form.language,
      condition: form.condition,
      finish: form.finish,
      gradeCompany: form.graded ? form.gradeCompany.trim() || null : null,
      gradeValue: form.graded ? form.gradeValue.trim() : null,
      price:
        form.saleType === 'auction'
          ? Number(form.startingPrice) || 0
          : Number(form.price) || 0,
      currency: 'USD',
      quantity: form.saleType === 'auction' ? 1 : Number(form.quantity) || 1,
      description: form.description.trim(),
    }),
    [form],
  );

  /** Live preview listing for the Review step's real grid card. */
  const preview: ListingWithSeller | null = useMemo(() => {
    if (!user) return null;
    const now = new Date().toISOString();
    return {
      id: id ?? 'preview',
      sellerId: user.id,
      ...input,
      status: 'active',
      saleType: form.saleType,
      auction:
        form.saleType === 'auction'
          ? {
              id: 'preview-auction',
              listingId: id ?? 'preview',
              sellerId: user.id,
              startingPrice: Number(form.startingPrice) || 0,
              reservePrice: form.reservePrice === '' ? null : Number(form.reservePrice),
              currency: 'USD',
              endsAt: new Date(Date.now() + form.durationHours * 3600_000).toISOString(),
              status: 'live' as const,
              winnerId: null,
              winningBid: null,
              cancelReason: null,
              createdAt: now,
            }
          : undefined,
      reservedForConversationId: null,
      createdAt: now,
      updatedAt: now,
      images: images.map((img, i) => ({
        id: img.id,
        listingId: 'preview',
        storagePath: img.url,
        url: img.url,
        sortOrder: i,
      })),
      seller: user,
      sellerActiveListingCount: 0,
      likes: 0,
    };
  }, [user, input, images, id, form.saleType, form.startingPrice, form.reservePrice, form.durationHours]);

  if (!user) {
    return (
      <main className="sell">
        <div className="empty-dashed">
          <h3>List a card</h3>
          <p>Sign in to list cards for sale.</p>
          <Link to="/signin" className="btn-acid">Sign in</Link>
        </div>
      </main>
    );
  }

  if (loadState === 'loading') {
    return (
      <main className="sell" aria-busy="true">
        <div className="skeleton" style={{ height: 420 }} />
      </main>
    );
  }

  if (loadState === 'missing' || loadState === 'forbidden') {
    return (
      <main className="sell">
        <div className="empty-dashed">
          <h3>{loadState === 'missing' ? 'Listing not found' : 'Not your listing'}</h3>
          <p>
            {loadState === 'missing'
              ? 'This listing no longer exists.'
              : 'Only the seller can edit a listing.'}
          </p>
          <Link to="/my-listings" className="btn-acid">My listings</Link>
        </div>
      </main>
    );
  }

  const goToStep = (target: number) => {
    // Moving forward validates every step in between.
    if (target > step) {
      for (let s = step; s < target; s++) {
        const errs = validateStep(s, form, images);
        if (Object.keys(errs).length) {
          setErrors(errs);
          setStep(s);
          return;
        }
      }
    }
    setErrors({});
    setStep(target);
  };

  const publish = async () => {
    for (let s = 1; s <= 3; s++) {
      const errs = validateStep(s, form, images);
      if (Object.keys(errs).length) {
        setErrors(errs);
        setStep(s);
        return;
      }
    }
    setSaving(true);
    try {
      const listing = editing
        ? await client.updateListing(id!, input, images)
        : form.saleType === 'auction'
          ? await client.createAuctionListing(input, images, {
              startingPrice: Number(form.startingPrice),
              reservePrice: form.reservePrice === '' ? null : Number(form.reservePrice),
              durationHours: form.durationHours,
            })
          : await client.createListing(input, images);
      toast(editing ? 'Listing updated' : form.saleType === 'auction' ? 'Auction started' : 'Published');
      navigate(`/listing/${listing.id}`);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Saving failed — try again.');
      setSaving(false);
    }
  };

  return (
    <main className="sell">
      <div className="sell-head">
        <h1 className="display sell-title">{editing ? 'Edit listing' : 'List a card'}</h1>
        <div className="mono-label sell-steplabel">
          {String(step).padStart(2, '0')} / {String(STEPS.length).padStart(2, '0')}
        </div>
      </div>

      <div className="sell-bars">
        {STEPS.map((label, i) => (
          <div key={label} className={`sell-bar ${step > i ? 'sell-bar-done' : ''}`} />
        ))}
      </div>
      <div className="sell-steps">
        {STEPS.map((label, i) => (
          <button
            key={label}
            type="button"
            className={`sell-steplink mono-label ${step === i + 1 ? 'sell-steplink-on' : ''}`}
            onClick={() => goToStep(i + 1)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="panel sell-panel">
        {step === 1 && (
          <div>
            <div className="display sell-panel-title">Photos</div>
            <p className="sell-panel-sub">1–8 photos. The first is the cover. Drag to reorder.</p>
            <ImageManager images={images} onChange={setImages} error={errors.images} />
            <div className="sell-pregrade-cta">
              <span>Raw card? Check its grade potential before you list it.</span>
              <Link to="/pregrade" className="btn-outline sell-pregrade-link">
                Run a Pre-Grade →
              </Link>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <div className="display sell-panel-title">The card</div>
            <div className="sell-chiprow">
              {GAMES.map((g) => (
                <button
                  key={g}
                  type="button"
                  className="pill"
                  aria-pressed={form.game === g}
                  onClick={() => set('game', g)}
                >
                  {GAME_LABELS[g]}
                </button>
              ))}
            </div>
            <div className="sell-fields">
              <label className="sell-field">
                <span className="mono-label">Card name *</span>
                <input
                  className="input"
                  value={form.title}
                  maxLength={120}
                  placeholder="Charizard"
                  aria-invalid={Boolean(errors.title)}
                  onChange={(e) => set('title', e.target.value)}
                />
                {errors.title && <span className="field-error">{errors.title}</span>}
              </label>
              <label className="sell-field">
                <span className="mono-label">Set *</span>
                <input
                  className="input"
                  value={form.setName}
                  maxLength={80}
                  placeholder="Base Set 1999"
                  aria-invalid={Boolean(errors.setName)}
                  onChange={(e) => set('setName', e.target.value)}
                />
                {errors.setName && <span className="field-error">{errors.setName}</span>}
              </label>
              <label className="sell-field">
                <span className="mono-label">Card number</span>
                <input
                  className="input"
                  value={form.cardNumber}
                  maxLength={30}
                  placeholder="4/102"
                  onChange={(e) => set('cardNumber', e.target.value)}
                />
              </label>
              <label className="sell-field">
                <span className="mono-label">Language</span>
                <select
                  className="input"
                  value={form.language}
                  onChange={(e) => set('language', e.target.value)}
                >
                  {['English', 'Japanese', 'French', 'German', 'Italian', 'Spanish', 'Other'].map((l) => (
                    <option key={l}>{l}</option>
                  ))}
                </select>
              </label>
              <label className="sell-field">
                <span className="mono-label">Finish</span>
                <select
                  className="input"
                  value={form.finish}
                  onChange={(e) => set('finish', e.target.value as Finish)}
                >
                  {FINISHES.map((f) => (
                    <option key={f} value={f}>{FINISH_LABELS[f]}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="sell-graderow">
              {(['Ungraded', 'Graded'] as const).map((label) => (
                <button
                  key={label}
                  type="button"
                  className="pill"
                  aria-pressed={form.graded === (label === 'Graded')}
                  onClick={() => set('graded', label === 'Graded')}
                >
                  {label}
                </button>
              ))}
              {form.graded && (
                <>
                  <select
                    className="input sell-grade-company"
                    aria-label="Grading company"
                    value={form.gradeCompany}
                    onChange={(e) => set('gradeCompany', e.target.value)}
                  >
                    {['PSA', 'BGS', 'CGC', 'SGC', 'Other'].map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                  <div className="sell-grade-value">
                    <input
                      className="input input-mono"
                      value={form.gradeValue}
                      maxLength={20}
                      placeholder='"PSA 9" or "9.5"'
                      aria-label="Grade"
                      aria-invalid={Boolean(errors.gradeValue)}
                      onChange={(e) => set('gradeValue', e.target.value)}
                    />
                    {errors.gradeValue && <span className="field-error">{errors.gradeValue}</span>}
                  </div>
                </>
              )}
            </div>

            <div className="sell-condtiles">
              {CONDITIONS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`sell-condtile ${form.condition === c ? 'sell-condtile-on' : ''}`}
                  aria-pressed={form.condition === c}
                  onClick={() => set('condition', c)}
                >
                  <div className="mono-value sell-condtile-code">{c}</div>
                  <div className="sell-condtile-desc">{CONDITION_DESCRIPTIONS[c]}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <div className="display sell-panel-title">The deal</div>
            {!editing ? (
              <div className="sell-typerow" role="radiogroup" aria-label="Sale type">
                {(
                  [
                    ['fixed', 'Fixed price'],
                    ['auction', 'Live auction'],
                  ] as const
                ).map(([t, label]) => (
                  <button
                    key={t}
                    type="button"
                    className="pill sell-typepill"
                    aria-pressed={form.saleType === t}
                    onClick={() => switchType(t)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            ) : (
              <p className="mono-label sell-typelocked">
                {form.saleType === 'auction'
                  ? 'Live auction — the type, starting price and clock were set at creation and cannot change.'
                  : 'Fixed price listing'}
              </p>
            )}
            {form.saleType === 'auction' && !editing && (
              <div className="sell-fields sell-fields-deal">
                <label className="sell-field">
                  <span className="mono-label">Starting price *</span>
                  <input
                    className="input input-mono"
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    placeholder="50.00"
                    value={form.startingPrice}
                    aria-invalid={Boolean(errors.startingPrice)}
                    onChange={(e) => set('startingPrice', e.target.value)}
                  />
                  {errors.startingPrice && (
                    <span className="field-error">{errors.startingPrice}</span>
                  )}
                </label>
                <label className="sell-field">
                  <span className="mono-label">Reserve (optional)</span>
                  <input
                    className="input input-mono"
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    placeholder="—"
                    value={form.reservePrice}
                    aria-invalid={Boolean(errors.reservePrice)}
                    onChange={(e) => set('reservePrice', e.target.value)}
                  />
                  {errors.reservePrice ? (
                    <span className="field-error">{errors.reservePrice}</span>
                  ) : (
                    <span className="mono-label sell-field-hint">
                      If bidding doesn&apos;t reach this, nobody wins and the card stays yours.
                    </span>
                  )}
                </label>
                <label className="sell-field">
                  <span className="mono-label">Duration</span>
                  <select
                    className="input"
                    value={form.durationHours}
                    onChange={(e) => set('durationHours', Number(e.target.value))}
                  >
                    {AUCTION_DURATIONS.map((d) => (
                      <option key={d.hours} value={d.hours}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="sell-field">
                  <span className="mono-label">Currency</span>
                  <input className="input input-mono" value="USD" readOnly aria-label="Currency (USD)" />
                </label>
              </div>
            )}
            {form.saleType === 'auction' && (
              <p className="sell-auction-note">
                Bids are public and non-binding — no payment happens on LebanonTCG. When the
                auction closes, the highest bidder and you are dropped into a chat to sort out
                the deal yourselves.
              </p>
            )}
            {form.saleType === 'fixed' && (
            <div className="sell-fields sell-fields-deal">
              <label className="sell-field">
                <span className="mono-label">Quantity</span>
                <input
                  className="input input-mono"
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
              <label className="sell-field">
                <span className="mono-label">Asking *</span>
                <input
                  className="input input-mono"
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  placeholder="240.00"
                  value={form.price}
                  aria-invalid={Boolean(errors.price)}
                  onChange={(e) => set('price', e.target.value)}
                  readOnly={editing && form.saleType !== 'fixed'}
                />
                {errors.price && <span className="field-error">{errors.price}</span>}
              </label>
              <label className="sell-field">
                <span className="mono-label">Currency</span>
                <input className="input input-mono" value="USD" readOnly aria-label="Currency (USD)" />
              </label>
            </div>
            )}
            <label className="sell-field sell-desc">
              <span className="mono-label">Notes for buyers</span>
              <textarea
                className="input"
                rows={5}
                value={form.description}
                maxLength={2000}
                placeholder="Print run, edgewear, whitening, sleeve situation, shipping or meetup preferences…"
                aria-invalid={Boolean(errors.description)}
                onChange={(e) => set('description', e.target.value)}
              />
              <span className="mono-label sell-desc-count">
                {2000 - form.description.length} characters left
              </span>
              {errors.description && <span className="field-error">{errors.description}</span>}
            </label>
          </div>
        )}

        {step === 4 && preview && (
          <div>
            <div className="display sell-panel-title">Review</div>
            <p className="sell-panel-sub">This is how your card appears in the grid.</p>
            <div className="sell-preview">
              <ListingCard listing={preview} />
            </div>
            <div className="sell-disclaimer">
              {form.saleType === 'auction'
                ? "Bids aren't binding and LebanonTCG handles no payment. When the clock runs out, the highest bidder and you get a chat to sort out the deal yourselves."
                : "LebanonTCG doesn't handle payment or shipping. You'll arrange both directly with the buyer in chat."}
            </div>
            <button
              type="button"
              className="btn-acid sell-publish"
              disabled={saving}
              onClick={() => void publish()}
            >
              {saving
                ? 'Saving…'
                : editing
                  ? 'Save changes'
                  : form.saleType === 'auction'
                    ? 'Start auction'
                    : 'Publish listing'}
            </button>
          </div>
        )}
      </div>

      <div className="sell-nav">
        {step > 1 && (
          <button type="button" className="btn-outline" onClick={() => goToStep(step - 1)}>
            ← Back
          </button>
        )}
        {step < STEPS.length && (
          <button type="button" className="btn-acid sell-next" onClick={() => goToStep(step + 1)}>
            Continue →
          </button>
        )}
      </div>
    </main>
  );
}
