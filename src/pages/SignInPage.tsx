import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useApp } from '../state/AppContext';
import { PasswordField } from '../components/PasswordField';
import { checkPassword, confirmationError } from '../lib/password';
import './signin.css';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

type Mode = 'signin' | 'signup';
type Screen = 'form' | 'confirm-sent' | 'link-sent' | 'reset-sent';

/**
 * Email + password auth. Sign-up needs an emailed confirmation once; after
 * that it's email + password every time. The magic link stays available for
 * accounts created before passwords existed and for forgotten passwords.
 */
export function SignInPage() {
  const { client, user } = useApp();
  const [mode, setMode] = useState<Mode>('signin');
  const [screen, setScreen] = useState<Screen>('form');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [emailError, setEmailError] = useState('');
  // Set when a sign-in fails in a way that suggests a pre-password account.
  const [offerLink, setOfferLink] = useState(false);

  // Already signed in: password gate → onboarding → home.
  if (user) return <Navigate to={user.username ? '/' : '/welcome'} replace />;

  const validEmail = () => {
    if (!EMAIL_RE.test(email.trim())) {
      setEmailError('Enter a valid email address.');
      return false;
    }
    setEmailError('');
    return true;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setOfferLink(false);
    if (!validEmail()) return;

    if (mode === 'signup') {
      const check = checkPassword(password, email);
      if (!check.ok) {
        setError(check.message);
        return;
      }
      const mismatch = confirmationError(password, confirmation);
      if (mismatch) {
        setError(mismatch);
        return;
      }
      setBusy(true);
      try {
        const { needsEmailConfirmation } = await client.signUpWithPassword(
          email.trim(),
          password,
        );
        if (needsEmailConfirmation) setScreen('confirm-sent');
        // Otherwise the auth listener signs us in and the redirect above fires.
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not create the account.');
      } finally {
        setBusy(false);
      }
      return;
    }

    if (!password) {
      setError('Enter your password.');
      return;
    }
    setBusy(true);
    try {
      await client.signInWithPassword(email.trim(), password);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not sign in.';
      // Supabase says "Invalid login credentials" both for a wrong password
      // and for an account that has never had one — offer the link either way.
      setError(/invalid/i.test(msg) ? 'Email or password is incorrect.' : msg);
      setOfferLink(true);
    } finally {
      setBusy(false);
    }
  };

  const sendMagicLink = async () => {
    if (!validEmail()) return;
    setBusy(true);
    setError('');
    try {
      await client.signInWithEmail(email.trim());
      setScreen('link-sent');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the sign-in link.');
    } finally {
      setBusy(false);
    }
  };

  const sendReset = async () => {
    if (!validEmail()) return;
    setBusy(true);
    setError('');
    try {
      await client.sendPasswordReset(email.trim());
      setScreen('reset-sent');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the reset email.');
    } finally {
      setBusy(false);
    }
  };

  if (screen !== 'form') {
    const copy = {
      'confirm-sent': {
        title: 'Confirm your email',
        body: (
          <>
            We sent a confirmation link to <strong>{email}</strong>. Open it to activate your
            account — after that you sign in with your email and password.
          </>
        ),
      },
      'link-sent': {
        title: 'Check your inbox',
        body: (
          <>
            We sent a one-tap sign-in link to <strong>{email}</strong>. Open it on this device;
            you&apos;ll be asked to set a password right after.
          </>
        ),
      },
      'reset-sent': {
        title: 'Reset link sent',
        body: (
          <>
            We sent a password reset link to <strong>{email}</strong>. Open it and choose a new
            password.
          </>
        ),
      },
    }[screen];
    return (
      <div className="signin">
        <div className="signin-card panel" role="status">
          <h1 className="display">{copy.title}</h1>
          <p>{copy.body}</p>
          <button className="btn-outline" onClick={() => setScreen('form')}>
            Back to sign in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="signin">
      <form className="signin-card panel" onSubmit={submit}>
        <div className="signin-tabs" role="tablist" aria-label="Sign in or create an account">
          {(['signin', 'signup'] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              className={`signin-tab mono-label ${mode === m ? 'is-on' : ''}`}
              onClick={() => {
                setMode(m);
                setError('');
                setOfferLink(false);
              }}
            >
              {m === 'signin' ? 'Sign in' : 'Create account'}
            </button>
          ))}
        </div>

        <h1 className="display">{mode === 'signin' ? 'Welcome back' : 'Join LebanonTCG'}</h1>
        <p>
          {mode === 'signin'
            ? 'Enter your email and password to pick up where you left off.'
            : 'One confirmation email, then it’s email and password from here on.'}
        </p>

        <label className="signin-field">
          <span className="mono-label signin-label">Email</span>
          <input
            className="input"
            type="email"
            value={email}
            placeholder="you@example.com"
            autoComplete="email"
            aria-invalid={Boolean(emailError)}
            onChange={(e) => setEmail(e.target.value)}
          />
          {emailError && <span className="field-error">{emailError}</span>}
        </label>

        <PasswordField
          label="Password"
          value={password}
          onChange={setPassword}
          showPolicy={mode === 'signup'}
          email={email}
          autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
        />

        {mode === 'signup' && (
          <PasswordField
            label="Confirm password"
            value={confirmation}
            onChange={setConfirmation}
            autoComplete="new-password"
          />
        )}

        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}

        <button className="btn-acid signin-btn" disabled={busy}>
          {busy
            ? mode === 'signin'
              ? 'Signing in…'
              : 'Creating account…'
            : mode === 'signin'
              ? 'Sign in'
              : 'Create account'}
        </button>

        {mode === 'signin' && (
          <div className="signin-alt">
            {offerLink && (
              <p className="signin-alt-note">
                Signed up before passwords existed? Get a sign-in link and set one.
              </p>
            )}
            <button
              type="button"
              className="btn-ghost-mono"
              disabled={busy}
              onClick={() => void sendMagicLink()}
            >
              Email me a sign-in link
            </button>
            <button
              type="button"
              className="btn-ghost-mono"
              disabled={busy}
              onClick={() => void sendReset()}
            >
              Forgot password
            </button>
          </div>
        )}

        {client.isMock && (
          <p className="signin-mocknote mono-label">
            Mock mode — accounts are in-memory, or use the dashed Dev switcher.
          </p>
        )}
      </form>
    </div>
  );
}
