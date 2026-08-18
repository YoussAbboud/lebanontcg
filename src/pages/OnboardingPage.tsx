import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useApp } from '../state/AppContext';
import { useToast } from '../state/ToastContext';
import { ImageCropper, type CroppedImage } from '../components/ImageCropper';
import './onboarding.css';
import { looksLikePickedImage } from '../lib/heic';

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;
const AVATAR_SIZE = 512;

/**
 * First-run account setup (/welcome). A signed-in user without a username
 * is routed here by the AppShell gate right after the magic-link confirm:
 * claim the permanent @handle, then display name, photo and bio.
 */
export function OnboardingPage() {
  const { client, auth, user } = useApp();
  const navigate = useNavigate();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [avatar, setAvatar] = useState<CroppedImage | null>(null);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  // Once a submit begins we own navigation — the auth profile updates
  // mid-flight (claim sets username) and must not auto-redirect us.
  const [started, setStarted] = useState(false);
  const [usernameError, setUsernameError] = useState('');
  const [formError, setFormError] = useState('');

  // Username already set (e.g. a retry after a partially failed submit).
  const locked = Boolean(user?.username);

  // Prefill from the (possibly self-healed) profile without clobbering typing.
  useEffect(() => {
    if (!user) return;
    setDisplayName((v) => v || user.displayName);
    setBio((v) => v || user.bio);
    if (user.username) setUsername(user.username);
  }, [user]);

  // Revoke the previous preview URL whenever the avatar changes / unmounts.
  useEffect(() => {
    if (!avatar) return;
    return () => URL.revokeObjectURL(avatar.url);
  }, [avatar]);

  if (auth.loading) return null;
  if (!user) return <Navigate to="/signin" replace />;
  if (locked && !started) return <Navigate to="/" replace />;

  // The crop dialog (square frame, round guide) produces the final avatar.
  const pickAvatar = (file: File | undefined) => {
    if (!file) return;
    if (!looksLikePickedImage(file)) {
      toast('Could not read that image — try another photo.');
      return;
    }
    setCropFile(file);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = username.trim().toLowerCase();
    if (!USERNAME_RE.test(name)) {
      setUsernameError('3–20 characters: lowercase letters, numbers, underscores.');
      return;
    }
    setUsernameError('');
    setFormError('');
    setStarted(true);
    setBusy(true);
    try {
      if (!locked) await client.claimUsername(name);
      let avatarUrl: string | undefined;
      if (avatar) {
        try {
          avatarUrl = await client.uploadAvatar(avatar.blob);
        } catch {
          // Non-fatal: the account matters more than the photo.
          toast('Photo upload failed — you can add it later in Settings.');
        }
      }
      await client.updateProfile({
        displayName: displayName.trim() || name,
        bio: bio.trim(),
        ...(avatarUrl ? { avatarUrl } : {}),
      });
      toast('Welcome to LebanonTCG');
      navigate('/', { replace: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong — try again.';
      if (/taken/i.test(msg)) setUsernameError(msg);
      else setFormError(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="onboard">
      <form className="onboard-card panel" onSubmit={submit}>
        <div className="mono-label onboard-eyebrow">Create your account</div>
        <h1 className="display">Welcome, collector</h1>
        <p className="onboard-sub">
          Set up how other traders see you. Your <strong>@username is permanent</strong> — the
          rest you can change any time in Settings.
        </p>

        <div className="onboard-avatar-row">
          <button
            type="button"
            className={`onboard-avatar ${avatar ? 'has-image' : ''}`}
            aria-label={avatar ? 'Change profile photo' : 'Add profile photo'}
            onClick={() => fileRef.current?.click()}
          >
            {avatar ? (
              <img src={avatar.url} alt="Profile photo preview" />
            ) : (
              <span aria-hidden="true">+</span>
            )}
          </button>
          <div className="onboard-avatar-copy">
            <button
              type="button"
              className="btn-outline onboard-avatar-btn"
              onClick={() => fileRef.current?.click()}
            >
              {avatar ? 'Change photo' : 'Upload photo'}
            </button>
            {avatar && (
              <button
                type="button"
                className="btn-ghost-mono onboard-avatar-remove"
                onClick={() => setAvatar(null)}
              >
                Remove
              </button>
            )}
            <div className="mono-label onboard-hint">Optional · JPG/PNG</div>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*,.heic,.heif"
            className="onboard-file"
            onChange={(e) => {
              pickAvatar(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </div>

        {cropFile && (
          <ImageCropper
            file={cropFile}
            aspect={1}
            outWidth={AVATAR_SIZE}
            round
            title="Frame your profile photo"
            onCancel={() => setCropFile(null)}
            onDone={(out) => {
              setAvatar(out);
              setCropFile(null);
            }}
          />
        )}

        <label className="onboard-field">
          <span className="mono-label onboard-label">Username · permanent</span>
          <div className="onboard-handle-row">
            <span className="onboard-at" aria-hidden="true">@</span>
            <input
              className="input"
              value={username}
              maxLength={20}
              autoFocus={!locked}
              disabled={locked}
              placeholder="cardshark"
              autoComplete="off"
              spellCheck={false}
              aria-invalid={Boolean(usernameError)}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          {usernameError ? (
            <span className="field-error">{usernameError}</span>
          ) : (
            <span className="mono-label onboard-hint">
              {locked ? 'Already claimed — finish the rest below.' : 'lowercase letters, numbers, underscores'}
            </span>
          )}
        </label>

        <label className="onboard-field">
          <span className="mono-label onboard-label">Display name</span>
          <input
            className="input"
            value={displayName}
            maxLength={50}
            placeholder="How your name appears on listings"
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </label>

        <label className="onboard-field">
          <span className="mono-label onboard-label">Bio · optional</span>
          <textarea
            className="input"
            rows={3}
            maxLength={400}
            placeholder="What you collect, where you trade, how you ship…"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
          />
        </label>

        {formError && (
          <p className="field-error" role="alert">
            {formError}
          </p>
        )}

        <button className="btn-acid onboard-submit" disabled={busy}>
          {busy ? 'Setting up…' : 'Enter the marketplace'}
        </button>

        <button
          type="button"
          className="btn-ghost-mono onboard-signout"
          onClick={async () => {
            await client.signOut();
            navigate('/signin', { replace: true });
          }}
        >
          Not you? Sign out
        </button>
      </form>
    </div>
  );
}
