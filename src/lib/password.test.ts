import { describe, expect, it } from 'vitest';
import {
  checkPassword,
  confirmationError,
  MIN_LENGTH,
  PASSWORD_RULES,
  strengthLabel,
  strengthScore,
} from './password';

describe('checkPassword requirements', () => {
  it('accepts a password meeting every rule', () => {
    const r = checkPassword('CharizardHolo7');
    expect(r.ok).toBe(true);
    expect(r.failed).toEqual([]);
    expect(r.message).toBe('');
  });

  it('rejects anything shorter than the minimum', () => {
    const r = checkPassword('Ab1cdef');
    expect(r.ok).toBe(false);
    expect(r.failed).toContain('length');
    expect(r.message).toMatch(new RegExp(`${MIN_LENGTH} characters`));
  });

  it.each([
    ['no lowercase', 'CHARIZARD123', 'lower'],
    ['no uppercase', 'charizard123', 'upper'],
    ['no digit', 'CharizardHolo', 'digit'],
  ])('rejects %s', (_name, password, ruleId) => {
    const r = checkPassword(password);
    expect(r.ok).toBe(false);
    expect(r.failed).toContain(ruleId);
  });

  it('reports failures in checklist order (length first)', () => {
    expect(checkPassword('ab').failed).toEqual(['length', 'upper', 'digit']);
  });

  it('rejects passwords past the bcrypt 72-byte limit', () => {
    expect(checkPassword(`A1${'a'.repeat(80)}`).ok).toBe(false);
  });

  it('rejects common passwords that pass the character rules', () => {
    const r = checkPassword('Password123');
    expect(PASSWORD_RULES.every((rule) => rule.test('Password123'))).toBe(true);
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/too common/);
  });

  it('rejects a password containing the email local part', () => {
    const r = checkPassword('Youssef12345', 'youssef@example.com');
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/email address/);
  });

  it('ignores short email local parts when matching', () => {
    expect(checkPassword('AbCharizard99', 'ab@example.com').ok).toBe(true);
  });

  it('rejects a single repeated character', () => {
    expect(checkPassword('aaaaaaaaaaaa').ok).toBe(false);
  });
});

describe('password strength', () => {
  it('scores 0 and labels "Too short" below the minimum', () => {
    expect(strengthScore('Ab1')).toBe(0);
    expect(strengthLabel('Ab1')).toBe('Too short');
  });

  it('rises with length and symbol variety', () => {
    const base = strengthScore('Charizard1');
    const longer = strengthScore('CharizardHolo1');
    const symbols = strengthScore('CharizardHolo1!');
    expect(longer).toBeGreaterThan(base);
    expect(symbols).toBeGreaterThan(longer);
  });

  it('penalizes missing character classes', () => {
    expect(strengthScore('charizardholo1')).toBeLessThan(strengthScore('CharizardHolo1'));
  });

  it('caps the score at 4 / "Strong"', () => {
    expect(strengthScore('Charizard!Holo!1st!Edition!Shadowless')).toBe(4);
    expect(strengthLabel('Charizard!Holo!1st!Edition!Shadowless')).toBe('Strong');
  });
});

describe('confirmationError', () => {
  it('asks for a confirmation when empty', () => {
    expect(confirmationError('CharizardHolo7', '')).toMatch(/confirm/i);
  });

  it('flags a mismatch', () => {
    expect(confirmationError('CharizardHolo7', 'CharizardHolo8')).toMatch(/match/i);
  });

  it('passes when the two agree', () => {
    expect(confirmationError('CharizardHolo7', 'CharizardHolo7')).toBe('');
  });
});
