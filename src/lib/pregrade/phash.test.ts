import { describe, expect, it } from 'vitest';
import { generateCard } from './fixtures';
import { aHash, hammingDistance, PHASH_MATCH_THRESHOLD } from './phash';

describe('perceptual hash publish gate', () => {
  it('the same card photographed twice matches', () => {
    const a = aHash(generateCard({ lr: 58, tb: 55, seed: 21 }).image);
    const b = aHash(generateCard({ lr: 58, tb: 55, seed: 99 }).image); // same card, new noise
    expect(hammingDistance(a, b)).toBeLessThanOrEqual(PHASH_MATCH_THRESHOLD);
  });

  it('identical images are distance zero', () => {
    const img = generateCard({ lr: 60, tb: 50, seed: 4 }).image;
    expect(hammingDistance(aHash(img), aHash(img))).toBe(0);
  });

  it('a clearly different image exceeds the threshold', () => {
    const card = aHash(generateCard({ lr: 58, tb: 55, seed: 21 }).image);
    const inverted = aHash(generateCard({ lr: 58, tb: 55, seed: 21, inverted: true, borderless: true }).image);
    expect(hammingDistance(card, inverted)).toBeGreaterThan(PHASH_MATCH_THRESHOLD);
  });

  it('hashes are 16 hex chars', () => {
    expect(aHash(generateCard({ lr: 55, tb: 55, seed: 1 }).image)).toMatch(/^[0-9a-f]{16}$/);
  });
});
