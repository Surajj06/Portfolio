/**
 * Turns the assistant's plain-text reply into a small, SAFE structure the
 * template renders with ordinary bindings (never innerHTML): paragraphs, bullet
 * lists, **bold**, and links. Only http(s), mailto, tel and in-site paths become
 * links; emails and phone numbers are linked automatically.
 */

export type Inline =
  | { kind: 'text'; text: string }
  | { kind: 'bold'; text: string }
  | { kind: 'br' }
  | { kind: 'link'; text: string; href: string; internal: boolean };

export interface Block {
  kind: 'p' | 'ul';
  /** `p`: one entry; `ul`: one entry per bullet. */
  items: Inline[][];
}

const TOKEN = new RegExp(
  [
    '\\*\\*([^*]+?)\\*\\*', // 1  **bold**
    '\\[([^\\]]+)\\]\\(([^)\\s]+)\\)', // 2,3 [label](url)
    '(https?:\\/\\/[^\\s<>()]+[^\\s<>().,;:!?])', // 4  bare URL
    '([A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\\.[A-Za-z0-9-]+)+)', // 5  email
    '(\\+?\\d[\\d\\s-]{8,}\\d)' // 6  phone number
  ].join('|'),
  'g'
);

function safeHref(raw: string): { href: string; internal: boolean } | null {
  const href = raw.trim();
  if (/^\/(?!\/)/.test(href)) return { href, internal: true };
  if (/^(https?:|mailto:|tel:)/i.test(href)) return { href, internal: false };
  return null;
}

function inline(line: string): Inline[] {
  const out: Inline[] = [];
  let last = 0;
  TOKEN.lastIndex = 0;
  for (let m = TOKEN.exec(line); m; m = TOKEN.exec(line)) {
    if (m.index > last) out.push({ kind: 'text', text: line.slice(last, m.index) });
    if (m[1] !== undefined) {
      out.push({ kind: 'bold', text: m[1] });
    } else if (m[2] !== undefined) {
      const link = safeHref(m[3]);
      out.push(link ? { kind: 'link', text: m[2], ...link } : { kind: 'text', text: m[2] });
    } else if (m[4] !== undefined) {
      out.push({ kind: 'link', text: m[4].replace(/^https?:\/\/(www\.)?/, ''), href: m[4], internal: false });
    } else if (m[5] !== undefined) {
      out.push({ kind: 'link', text: m[5], href: `mailto:${m[5]}`, internal: false });
    } else if (m[6] !== undefined) {
      const digits = m[6].replace(/[\s-]/g, '');
      const count = digits.replace(/\D/g, '').length;
      // Only real phone numbers (10–15 digits) — not dates or long figures.
      out.push(count >= 10 && count <= 15 ? { kind: 'link', text: m[6], href: `tel:${digits}`, internal: false } : { kind: 'text', text: m[6] });
    }
    last = m.index + m[0].length;
  }
  if (last < line.length) out.push({ kind: 'text', text: line.slice(last) });
  return out;
}

const BULLET = /^\s*(?:[-*•]|\d+[.)])\s+/;

export function formatReply(text: string): Block[] {
  const blocks: Block[] = [];
  for (const raw of text.replace(/\r/g, '').split(/\n{2,}/)) {
    const lines = raw.split('\n').filter((l) => l.trim());
    if (!lines.length) continue;
    if (lines.every((l) => BULLET.test(l))) {
      blocks.push({ kind: 'ul', items: lines.map((l) => inline(l.replace(BULLET, ''))) });
      continue;
    }
    const merged: Inline[] = [];
    lines.forEach((l, i) => {
      if (i) merged.push({ kind: 'br' });
      merged.push(...inline(l.replace(/^#{1,4}\s+/, '')));
    });
    blocks.push({ kind: 'p', items: [merged] });
  }
  return blocks;
}
