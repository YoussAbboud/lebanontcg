import { useId, useState } from 'react';
import { PASSWORD_RULES, checkPassword, strengthLabel, strengthScore } from '../lib/password';
import './passwordfield.css';

interface Props {
  label: string;
  value: string;
  onChange(next: string): void;
  /** Show the live requirement checklist + strength meter (sign-up only). */
  showPolicy?: boolean;
  /** Used to reject passwords built from the address. */
  email?: string;
  autoComplete?: 'current-password' | 'new-password';
  autoFocus?: boolean;
  error?: string;
}

/** Password input with reveal toggle and, when creating one, live policy. */
export function PasswordField({
  label,
  value,
  onChange,
  showPolicy = false,
  email,
  autoComplete = 'current-password',
  autoFocus = false,
  error = '',
}: Props) {
  const [reveal, setReveal] = useState(false);
  const id = useId();
  const check = showPolicy ? checkPassword(value, email) : null;
  const score = showPolicy ? strengthScore(value) : 0;

  return (
    <div className="pwf">
      <label className="mono-label pwf-label" htmlFor={id}>
        {label}
      </label>
      <div className="pwf-row">
        <input
          id={id}
          className="input pwf-input"
          type={reveal ? 'text' : 'password'}
          value={value}
          autoFocus={autoFocus}
          autoComplete={autoComplete}
          aria-invalid={Boolean(error)}
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          className="pwf-reveal mono-label"
          aria-label={reveal ? 'Hide password' : 'Show password'}
          aria-pressed={reveal}
          onClick={() => setReveal((v) => !v)}
        >
          {reveal ? 'Hide' : 'Show'}
        </button>
      </div>

      {showPolicy && (
        <>
          <div className="pwf-meter" aria-hidden="true">
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className={`pwf-bar ${value && i < score ? `pwf-bar-${score}` : ''}`} />
            ))}
          </div>
          <div className="pwf-strength mono-label" role="status">
            {value ? `Strength: ${strengthLabel(value)}` : 'Strength: —'}
          </div>
          <ul className="pwf-rules">
            {PASSWORD_RULES.map((rule) => {
              const met = value.length > 0 && rule.test(value);
              return (
                <li key={rule.id} className={`pwf-rule ${met ? 'is-met' : ''}`}>
                  <span className="pwf-rule-mark" aria-hidden="true">
                    {met ? '✓' : '○'}
                  </span>
                  {rule.label}
                </li>
              );
            })}
          </ul>
          {/* Policy failures beyond the checklist (common, reused email…) */}
          {value && check && !check.ok && check.failed.length === 0 && (
            <p className="field-error">{check.message}</p>
          )}
        </>
      )}
      {error && <p className="field-error">{error}</p>}
    </div>
  );
}
