import { useState } from 'react';
import type { Profile } from '../lib/types';
import { useApp } from '../state/AppContext';
import './reviewprompt.css';

interface Props {
  conversationId: string;
  otherParty: Profile;
  onDone(): void;
}

/** Post-sale review card shown in the thread once the listing is sold. */
export function ReviewPrompt({ conversationId, otherParty, onDone }: Props) {
  const { client } = useApp();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [body, setBody] = useState('');
  const [state, setState] = useState<'idle' | 'busy' | 'error'>('idle');

  const submit = async () => {
    if (rating < 1) return;
    setState('busy');
    try {
      await client.submitReview(conversationId, rating, body.trim());
      onDone();
    } catch {
      setState('error');
    }
  };

  return (
    <div className="rvw card-surface" role="form" aria-label="Rate this trade">
      <p className="microlabel rvw-title">Rate this trade</p>
      <p className="rvw-sub">
        How did the deal with <strong>{otherParty.displayName}</strong> go? Your review shows on
        their profile.
      </p>
      <div className="rvw-stars" role="radiogroup" aria-label="Star rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
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
        className="textarea"
        rows={2}
        maxLength={500}
        placeholder="A sentence about how it went (optional)…"
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      {state === 'error' && (
        <p className="field-error" role="alert">Couldn&apos;t submit the review — try again.</p>
      )}
      <button
        className="btn btn-primary btn-sm rvw-submit"
        disabled={rating < 1 || state === 'busy'}
        onClick={() => void submit()}
      >
        {state === 'busy' ? 'Submitting…' : 'Submit review'}
      </button>
    </div>
  );
}
