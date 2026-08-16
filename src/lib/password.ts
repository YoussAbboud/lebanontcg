// Password policy. Pure functions so the rules are unit-tested and the
// sign-up form, the set-password form and any future flow all agree.

export const MIN_LENGTH = 10;
export const MAX_LENGTH = 72; // bcrypt truncates beyond 72 bytes

export interface PasswordRule {
  id: 'length' | 'lower' | 'upper' | 'digit';
  label: string;
  test(password: string): boolean;
}

/** The hard requirements, in the order the checklist shows them. */
export const PASSWORD_RULES: PasswordRule[] = [
  {
    id: 'length',
    label: `At least ${MIN_LENGTH} characters`,
    test: (p) => p.length >= MIN_LENGTH,
  },
  { id: 'lower', label: 'A lowercase letter', test: (p) => /[a-z]/.test(p) },
  { id: 'upper', label: 'An uppercase letter', test: (p) => /[A-Z]/.test(p) },
  { id: 'digit', label: 'A number', test: (p) => /\d/.test(p) },
];

// Passwords that pass the character rules but are still guessable.
const COMMON = new Set([
  'password1',
  'password12',
  'password123',
  'passw0rd123',
  'qwerty12345',
  'welcome123',
  'iloveyou123',
  'abcd1234efg',
  'letmein1234',
  'admin12345',
  'lebanontcg1',
  'pokemon1234',
]);

export interface PasswordCheck {
  /** True when every requirement passes and nothing else disqualifies it. */
  ok: boolean;
  /** Rule ids that failed (for the live checklist). */
  failed: string[];
  /** First human-readable problem, or '' when ok. */
  message: string;
  /** 0–4, for the strength meter (only meaningful once ok). */
  score: number;
  label: 'Too short' | 'Weak' | 'Fair' | 'Good' | 'Strong';
}

/**
 * Validate a password against the policy.
 * `email` (optional) blocks passwords built from the address itself.
 */
export function checkPassword(password: string, email?: string): PasswordCheck {
  const failed = PASSWORD_RULES.filter((r) => !r.test(password)).map((r) => r.id);
  let message = '';

  if (failed.length > 0) {
    const first = PASSWORD_RULES.find((r) => r.id === failed[0])!;
    message = `Password needs: ${first.label.toLowerCase()}.`;
  } else if (password.length > MAX_LENGTH) {
    message = `Keep it under ${MAX_LENGTH} characters.`;
  } else if (COMMON.has(password.toLowerCase())) {
    message = 'That password is too common — pick something less guessable.';
  } else if (/^(.)\1+$/.test(password)) {
    message = 'That password is a single repeated character.';
  } else {
    const local = (email ?? '').split('@')[0]?.toLowerCase() ?? '';
    if (local.length >= 3 && password.toLowerCase().includes(local)) {
      message = 'Don’t use your email address in your password.';
    }
  }

  const ok = message === '' && failed.length === 0;
  return { ok, failed, message, score: strengthScore(password), label: strengthLabel(password) };
}

/** 0–4 strength: length tiers plus character-class variety. */
export function strengthScore(password: string): number {
  if (password.length < MIN_LENGTH) return 0;
  let score = 1;
  if (password.length >= 14) score++;
  if (password.length >= 20) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  const classes = [/[a-z]/, /[A-Z]/, /\d/].filter((re) => re.test(password)).length;
  if (classes < 3) score--;
  return Math.max(0, Math.min(4, score));
}

export function strengthLabel(password: string): PasswordCheck['label'] {
  if (password.length < MIN_LENGTH) return 'Too short';
  return (['Weak', 'Weak', 'Fair', 'Good', 'Strong'] as const)[strengthScore(password)];
}

/** Confirmation-field check, kept next to the policy it belongs to. */
export function confirmationError(password: string, confirmation: string): string {
  if (!confirmation) return 'Re-enter your password to confirm it.';
  if (password !== confirmation) return 'Passwords don’t match.';
  return '';
}
