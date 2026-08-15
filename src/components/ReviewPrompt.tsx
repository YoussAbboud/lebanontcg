import { useState } from 'react';
import type { Profile } from '../lib/types';
import { useApp } from '../state/AppContext';
import { useToast } from '../state/ToastContext';
import './reviewprompt.css';

interface Props {
  conversationId: string;
  otherParty: Profile;
  onDone(): void;
}

/** Post-sale review card shown in the thread once the listing is sold. */
export function ReviewPrompt({ conversationId, otherParty, onDone }: Props) {
  const { client } = useApp();
  const toast = useToast();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (rating < 1) return;
    setBusy(true);
    try {
      await client.submitReview(conversationId, rating, body.trim());
      toast('Review submitted');
      onDone();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not submit the review');
      setBusy(false);
    }
  };

  return (
    <div className="rvw panel" role="form" aria-label="Rate this trade">
      <div className="mono-label rvw-title">Rate this trade</div>
      <p className="rvw-sub">
        How did the deal with <strong>@{otherParty.username ?? otherParty.displayName}</strong> go?
        Your review shows on their profile.
      </p>
      <div className="rvw-stars" role="radiogroup" aria-label="Star rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={rating === n}
            aria-label={`${n} star${n === 1 ? '' : 's'}`}
            className={`rvw-star ${(hover || rating) >= n ? 'rvw-star-on' : ''}`}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            onClick={() => setRating(n)}
          >
            ★
          </button>
        ))}
      </div>
      <textarea
        className="input"
        rows={2}
        maxLength={500}
        placeholder="A sentence about how it went (optional)…"
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      <button
        type="button"
        className="btn-acid rvw-submit"
        disabled={rating < 1 || busy}
        onClick={() => void submit()}
      >
        {busy ? 'Submitting…' : 'Submit review'}
      </button>
    </div>
  );
}
