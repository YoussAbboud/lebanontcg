import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../state/AppContext';
import './signin.css';

/**
 * Live-mode auth: email magic link, then a one-time username claim.
 * In mock mode this page just points at the Dev switcher.
 */
export function SignInPage() {
  const { client, user } = useApp();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'busy' | 'sent' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [username, setUsername] = useState('');
  const [claimState, setClaimState] = useState<'idle' | 'busy' | 'error'>('idle');
  const [claimError, setClaimError] = useState('');

  const needsUsername = Boolean(user && !user.username);

  // Signed in and named — nothing to do here.
  useEffect(() => {
    if (user?.username) navigate('/', { replace: true });
  }, [user, navigate]);

  if (client.isMock && !user) {
    return (
      <div className="signin">
        <div className="signin-card panel">
          <h1 className="display">Mock mode</h1>
          <p>
            You&apos;re running offline. Use the dashed <strong>Dev</strong> switcher in the
            header to sign in instantly as any seeded user — no email needed.
          </p>
        </div>
      </div>
    );
  }

  if (needsUsername) {
    const claim = async (e: React.FormEvent) => {
      e.preventDefault();
      const name = username.trim().toLowerCase();
      if (!/^[a-z0-9_]{3,20}$/.test(name)) {
        setClaimState('error');
        setClaimError('3–20 characters: lowercase letters, numbers, underscores.');
        return;
      }
      setClaimState('busy');
      try {
        await client.claimUsername(name);
        navigate('/', { replace: true });
      } catch (err) {
        setClaimState('error');
        setClaimError(err instanceof Error ? err.message : 'Could not claim that username.');
      }
    };
    return (
      <div className="signin">
        <form className="signin-card panel" onSubmit={claim}>
          <h1 className="display">Claim your handle</h1>
          <p>This is your permanent @username — it can&apos;t be changed later.</p>
          <label className="signin-field">
            <span className="mono-label signin-label">Username</span>
            <div className="signin-handle-row">
              <span className="signin-at" aria-hidden="true">@</span>
              <input
                className="input"
                value={username}
                maxLength={20}
                autoFocus
                placeholder="cardshark"
                aria-invalid={claimState === 'error'}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            {claimState === 'error' && <span className="field-error">{claimError}</span>}
          </label>
          <button className="btn-acid signin-btn" disabled={claimState === 'busy'}>
            {claimState === 'busy' ? 'Claiming…' : 'Claim username'}
          </button>
        </form>
      </div>
    );
  }

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      setState('error');
      setErrorMsg('Enter a valid email address.');
      return;
    }
    setState('busy');
    try {
      await client.signInWithEmail(email);
      setState('sent');
    } catch (err) {
      setState('error');
      setErrorMsg(err instanceof Error ? err.message : 'Could not send the magic link.');
    }
  };

  return (
    <div className="signin">
      {state === 'sent' ? (
        <div className="signin-card panel" role="status">
          <h1 className="display">Check your inbox</h1>
          <p>
            We sent a magic link to <strong>{email}</strong>. Open it on this device to finish
            signing in — no password needed.
          </p>
          <button className="btn-outline" onClick={() => setState('idle')}>
            Use a different email
          </button>
        </div>
      ) : (
        <form className="signin-card panel" onSubmit={send}>
          <h1 className="display">Sign in</h1>
          <p>Enter your email and we&apos;ll send you a one-tap magic link. New here? The same link creates your account.</p>
          <label className="signin-field">
            <span className="mono-label signin-label">Email</span>
            <input
              className="input"
              type="email"
              value={email}
              placeholder="you@example.com"
              autoComplete="email"
              aria-invalid={state === 'error'}
              onChange={(e) => setEmail(e.target.value)}
            />
            {state === 'error' && <span className="field-error">{errorMsg}</span>}
          </label>
          <button className="btn-acid signin-btn" disabled={state === 'busy'}>
            {state === 'busy' ? 'Sending…' : 'Send magic link'}
          </button>
        </form>
      )}
    </div>
  );
}
