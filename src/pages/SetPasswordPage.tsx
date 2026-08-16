import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useApp } from '../state/AppContext';
import { useToast } from '../state/ToastContext';
import { PasswordField } from '../components/PasswordField';
import { checkPassword, confirmationError } from '../lib/password';
import './signin.css';

/**
 * One-time prompt for accounts created by magic link before passwords
 * existed (and the landing page for password-reset links). The AppShell
 * gate routes here whenever auth.needsPassword is true.
 */
export function SetPasswordPage() {
  const { client, auth, user } = useApp();
  const navigate = useNavigate();
  const toast = useToast();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (auth.loading) return null;
  if (!user) return <Navigate to="/signin" replace />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const check = checkPassword(password);
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
    setError('');
    try {
      await client.setPassword(password);
      toast('Password saved');
      // New accounts still need a handle; the gate sorts that out.
      navigate(user.username ? '/' : '/welcome', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the password.');
      setBusy(false);
    }
  };

  return (
    <div className="signin">
      <form className="signin-card panel" onSubmit={submit}>
        <div className="mono-label signin-eyebrow">Secure your account</div>
        <h1 className="display">Set a password</h1>
        <p>
          You signed in with an email link. Choose a password now and next time you can sign
          straight in with <strong>{user.displayName}</strong>&apos;s email and password — no
          inbox trip.
        </p>

        <PasswordField
          label="New password"
          value={password}
          onChange={setPassword}
          showPolicy
          autoComplete="new-password"
          autoFocus
        />
        <PasswordField
          label="Confirm password"
          value={confirmation}
          onChange={setConfirmation}
          autoComplete="new-password"
        />

        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}

        <button className="btn-acid signin-btn" disabled={busy}>
          {busy ? 'Saving…' : 'Save password'}
        </button>

        <button
          type="button"
          className="btn-ghost-mono"
          onClick={async () => {
            await client.signOut();
            navigate('/signin', { replace: true });
          }}
        >
          Sign out instead
        </button>
      </form>
    </div>
  );
}
