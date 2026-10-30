// Usage limit: 3 minutes of Instagram, then a 5-minute block. Only time with a visible tab counts.
export const USE_MS = 3 * 60e3, BLOCK_MS = 5 * 60e3;

// One tick of the clock (about a second). A gap as long as the block counts as a break and resets usage.
export function step(s, now, visible) {
  if (now < s.until || !visible) return s;
  const used = now - s.last > BLOCK_MS ? 0 : s.used + Math.min(now - s.last, 1000);
  return used >= USE_MS ? { used: 0, last: now, until: now + BLOCK_MS } : { used, last: now, until: 0 };
}
