/**
 * Small, dependency-free port of the three string-similarity scorers the
 * matching engine uses (rapidfuzz `ratio`, `token_sort_ratio`, `token_set_ratio`).
 * All return 0–100. Used by the in-browser demos so they score text the same
 * way the real pipeline does, not with a made-up formula.
 */

/** Longest-common-subsequence length (two-row DP). */
function lcs(a: string, b: string): number {
  if (!a.length || !b.length) return 0;
  let prev = new Array<number>(b.length + 1).fill(0);
  let cur = new Array<number>(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      cur[j] = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? prev[j - 1] + 1 : Math.max(prev[j], cur[j - 1]);
    }
    [prev, cur] = [cur, prev];
  }
  return prev[b.length];
}

/** Normalised Indel similarity, identical to rapidfuzz `fuzz.ratio`. */
export function ratio(a: string, b: string): number {
  const total = a.length + b.length;
  if (total === 0) return 100;
  return (2 * lcs(a, b) * 100) / total;
}

const tokens = (s: string): string[] => s.split(/\s+/).filter(Boolean);

/** Sort the words first so word order never matters. */
export function tokenSortRatio(a: string, b: string): number {
  return ratio(tokens(a).sort().join(' '), tokens(b).sort().join(' '));
}

/** Compare the shared words against each side's leftovers — extra tokens don't break a match. */
export function tokenSetRatio(a: string, b: string): number {
  const ta = new Set(tokens(a));
  const tb = new Set(tokens(b));
  if (!ta.size || !tb.size) return 0;
  const inter = [...ta].filter((t) => tb.has(t)).sort();
  const diffA = [...ta].filter((t) => !tb.has(t)).sort();
  const diffB = [...tb].filter((t) => !ta.has(t)).sort();
  if (inter.length && (!diffA.length || !diffB.length)) return 100;
  const sect = inter.join(' ');
  const c1 = `${sect} ${diffA.join(' ')}`.trim();
  const c2 = `${sect} ${diffB.join(' ')}`.trim();
  return Math.max(ratio(sect, c1), ratio(sect, c2), ratio(c1, c2));
}
