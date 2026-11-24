import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  NgZone,
  afterNextRender,
  computed,
  inject,
  signal,
} from '@angular/core';
import { DeviceService } from '../../services/device.service';
import { DEMO_STYLES } from './demo-styles';

/* ------------------------------------------------------------------ */
/*  Pure maths, ported from the real pipeline                          */
/* ------------------------------------------------------------------ */

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** pandas Series.rolling(n).mean(): first value at index n-1, NaN before. */
function rollingMean(a: number[], n: number): number[] {
  const out: number[] = new Array<number>(a.length).fill(NaN);
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += a[i] as number;
    if (i >= n) sum -= a[i - n] as number;
    if (i >= n - 1) out[i] = sum / n;
  }
  return out;
}

/**
 * MarketDataIngestor._compute_rsi, exactly: gain/loss from diff (the first diff is NaN and
 * becomes 0), a simple mean over the first 14 values seeds the average at index 13, then
 * Wilder smoothing avg = (prev * 13 + current) / 14 from index 14 on.
 */
function computeRsi(close: number[], period = 14): number[] {
  const n = close.length;
  const gain: number[] = [];
  const loss: number[] = [];
  for (let i = 0; i < n; i++) {
    const d = i === 0 ? NaN : (close[i] as number) - (close[i - 1] as number);
    gain.push(d > 0 ? d : 0);
    loss.push(d < 0 ? -d : 0);
  }
  const ag: number[] = new Array<number>(n).fill(NaN);
  const al: number[] = new Array<number>(n).fill(NaN);
  if (n < period) return ag;
  let sg = 0;
  let sl = 0;
  for (let i = 0; i < period; i++) {
    sg += gain[i] as number;
    sl += loss[i] as number;
  }
  ag[period - 1] = sg / period;
  al[period - 1] = sl / period;
  for (let i = period; i < n; i++) {
    ag[i] = ((ag[i - 1] as number) * (period - 1) + (gain[i] as number)) / period;
    al[i] = ((al[i - 1] as number) * (period - 1) + (loss[i] as number)) / period;
  }
  return ag.map((g, i) => {
    if (Number.isNaN(g)) return NaN;
    const l = al[i] as number;
    if (l === 0) return g === 0 ? NaN : 100;
    return 100 - 100 / (1 + g / l);
  });
}

/* ---- SHA-256, so the headline hash matches hashlib.sha256 ---- */

const SHA_K: number[] = [];
const SHA_H0: number[] = [];
(function initSha(): void {
  const isPrime = (n: number): boolean => {
    for (let i = 2; i * i <= n; i++) if (n % i === 0) return false;
    return true;
  };
  let count = 0;
  for (let c = 2; count < 64; c++) {
    if (!isPrime(c)) continue;
    if (count < 8) SHA_H0.push(Math.floor((Math.sqrt(c) % 1) * 4294967296) >>> 0);
    SHA_K.push(Math.floor((Math.cbrt(c) % 1) * 4294967296) >>> 0);
    count++;
  }
})();

function sha256Hex(msg: string): string {
  const data = new TextEncoder().encode(msg);
  const len = data.length;
  const total = ((len + 9 + 63) >> 6) << 6;
  const buf = new Uint8Array(total);
  buf.set(data);
  buf[len] = 0x80;
  const view = new DataView(buf.buffer);
  view.setUint32(total - 8, Math.floor((len * 8) / 4294967296));
  view.setUint32(total - 4, (len * 8) >>> 0);
  const h = SHA_H0.slice();
  const w: number[] = new Array<number>(64).fill(0);
  const rotr = (x: number, n: number): number => (x >>> n) | (x << (32 - n));
  for (let off = 0; off < total; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(off + i * 4);
    for (let i = 16; i < 64; i++) {
      const w15 = w[i - 15] as number;
      const w2 = w[i - 2] as number;
      const s0 = rotr(w15, 7) ^ rotr(w15, 18) ^ (w15 >>> 3);
      const s1 = rotr(w2, 17) ^ rotr(w2, 19) ^ (w2 >>> 10);
      w[i] = ((w[i - 16] as number) + s0 + (w[i - 7] as number) + s1) >>> 0;
    }
    let a = h[0] as number, b = h[1] as number, c = h[2] as number, d = h[3] as number;
    let e = h[4] as number, f = h[5] as number, g = h[6] as number, hh = h[7] as number;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (hh + S1 + ch + (SHA_K[i] as number) + (w[i] as number)) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) >>> 0;
      hh = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    h[0] = ((h[0] as number) + a) >>> 0; h[1] = ((h[1] as number) + b) >>> 0;
    h[2] = ((h[2] as number) + c) >>> 0; h[3] = ((h[3] as number) + d) >>> 0;
    h[4] = ((h[4] as number) + e) >>> 0; h[5] = ((h[5] as number) + f) >>> 0;
    h[6] = ((h[6] as number) + g) >>> 0; h[7] = ((h[7] as number) + hh) >>> 0;
  }
  return h.map((x) => x.toString(16).padStart(8, '0')).join('');
}

/** NewsIngestor._hash_headline: sha256 of headline.lower().strip(), first 16 hex chars. */
function hashHeadline(headline: string): string {
  return sha256Hex(headline.toLowerCase().trim()).slice(0, 16);
}

type DedupeState = 'kept' | 'dup' | 'dropped';
interface DedupeOutcome { state: DedupeState; hash: string; of: number }

/** NewsIngestor._store: skip empty / "[Removed]", skip any hash already seen (first copy wins). */
function dedupe(raws: string[]): DedupeOutcome[] {
  const seen = new Map<string, number>();
  return raws.map((raw, i) => {
    const headline = raw.trim();
    if (!headline || headline === '[Removed]') return { state: 'dropped' as const, hash: '', of: -1 };
    const hash = hashHeadline(headline);
    const first = seen.get(hash);
    if (first !== undefined) return { state: 'dup' as const, hash, of: first };
    seen.set(hash, i);
    return { state: 'kept' as const, hash, of: -1 };
  });
}

/* ---- synthetic prices ---- */

interface Bars {
  dates: string[];
  open: number[];
  high: number[];
  low: number[];
  close: number[];
  sma50: number[];
  sma200: number[];
  rsi: number[];
}

interface SymbolSpec { code: string; name: string; start: number; drift: number; vol: number; cycle: number; seed: number }

const SYMBOLS: SymbolSpec[] = [
  { code: 'SMPA', name: 'Sample Industries A', start: 1420, drift: 0.0022, vol: 0.013, cycle: 150, seed: 16 },
  { code: 'SMPB', name: 'Sample Industries B', start: 610, drift: 0.0026, vol: 0.016, cycle: 120, seed: 124 },
  { code: 'SMPC', name: 'Sample Industries C', start: 238, drift: 0.002, vol: 0.011, cycle: 170, seed: 19 },
];

const N_BARS = 260;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function genBars(spec: SymbolSpec, seed: number): Bars {
  const r = mulberry32(seed);
  const gauss = (): number => {
    let u = 0;
    let v = 0;
    while (u === 0) u = r();
    while (v === 0) v = r();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  const phase = r() * 6.283;
  const dates: string[] = [];
  const day = new Date(Date.UTC(2025, 0, 1));
  while (dates.length < N_BARS) {
    const dow = day.getUTCDay();
    if (dow !== 0 && dow !== 6) dates.push(day.toISOString().slice(0, 10));
    day.setUTCDate(day.getUTCDate() + 1);
  }
  const round2 = (x: number): number => Math.round(x * 100) / 100;
  const open: number[] = [];
  const high: number[] = [];
  const low: number[] = [];
  const close: number[] = [];
  let prev = spec.start;
  for (let i = 0; i < N_BARS; i++) {
    const regime = Math.sin((i / spec.cycle) * 6.283 + phase) * spec.drift;
    const c = round2(prev * (1 + regime + spec.vol * gauss()));
    const o = round2(prev * (1 + 0.002 * gauss()));
    const hi = round2(Math.max(o, c) * (1 + Math.abs(0.004 * gauss())));
    const lo = round2(Math.min(o, c) * (1 - Math.abs(0.004 * gauss())));
    open.push(o); high.push(hi); low.push(lo); close.push(c);
    prev = c;
  }
  return { dates, open, high, low, close, sma50: rollingMean(close, 50), sma200: rollingMean(close, 200), rsi: computeRsi(close, 14) };
}

/* ---- sentiment stand-in ---- */

const POS_WORDS = ['beats', 'rise', 'raise', 'raises', 'gain', 'gains', 'unveils', 'double', 'record', 'upgrade', 'strong', 'profit', 'growth', 'expands'];
const NEG_WORDS = ['cut', 'cuts', 'weak', 'fall', 'falls', 'probe', 'downgrade', 'loss', 'miss', 'decline', 'costs', 'penalty'];

interface Sentiment { label: 'positive' | 'negative' | 'neutral'; score: number }

/** Lexicon counts -> softmax over (pos, neg, neutral) like FinBERT's three scores; score = pos - neg. */
function lexiconSentiment(text: string): Sentiment {
  const tokens = text.toLowerCase().replace(/[^a-z0-9% ]/g, ' ').split(/\s+/);
  let pos = 0;
  let neg = 0;
  for (const t of tokens) {
    if (POS_WORDS.includes(t)) pos++;
    if (NEG_WORDS.includes(t)) neg++;
  }
  const lp = Math.exp(1.6 * pos);
  const ln = Math.exp(1.6 * neg);
  const lu = Math.exp(1.0);
  const z = lp + ln + lu;
  const p = lp / z;
  const n = ln / z;
  const u = lu / z;
  const label = p >= n && p >= u ? 'positive' : n > p && n >= u ? 'negative' : 'neutral';
  return { label, score: Math.round((p - n) * 10000) / 10000 };
}

interface NewsItem { feed: string; raw: string }

const NEWS: NewsItem[] = [
  { feed: 'India feed 1', raw: 'Sample Industries posts 12% rise in quarterly profit' },
  { feed: 'India feed 2', raw: 'SAMPLE INDUSTRIES POSTS 12% RISE IN QUARTERLY PROFIT' },
  { feed: 'Global feed 1', raw: '  sample industries posts 12% rise in quarterly profit  ' },
  { feed: 'India feed 3', raw: 'Sample Industries posts 12% rise in quarterly profit.' },
  { feed: 'India feed 1', raw: 'Regulator opens probe into sector pricing practices' },
  { feed: 'Global feed 2', raw: 'Regulator Opens Probe Into Sector Pricing Practices' },
  { feed: 'India feed 4', raw: 'Analysts cut target price on Sample Industries after weak guidance' },
  { feed: 'Global feed 3', raw: 'Sample Industries unveils new plant, expects capacity to double' },
  { feed: 'India feed 5', raw: 'sample industries unveils new plant, expects capacity to double' },
  { feed: 'India feed 6', raw: 'Sample Industries shares fall as input costs surge' },
  { feed: 'Global feed 4', raw: 'Input costs surge: Sample Industries shares fall' },
  { feed: 'Global feed 5', raw: '[Removed]' },
  { feed: 'India feed 2', raw: 'Foreign investors raise stake in Sample Industries' },
  { feed: 'Global feed 1', raw: 'Foreign investors raise stake in Sample Industries' },
];

const NEWS_HASH: string[] = NEWS.map((n) => {
  const t = n.raw.trim();
  return t && t !== '[Removed]' ? hashHeadline(t) : '';
});
const NEWS_SENT: Sentiment[] = NEWS.map((n) => lexiconSentiment(n.raw));

interface Seg { t: string; ref?: string }
interface Source { key: string; label: string; value: string; trace: string }

function money(n: number): string {
  const [i, d] = n.toFixed(2).split('.') as [string, string];
  return '₹' + i.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '.' + d;
}

function dateLabel(iso: string): string {
  return iso.slice(8, 10) + ' ' + MONTHS[parseInt(iso.slice(5, 7), 10) - 1] + ' ' + iso.slice(2, 4);
}

@Component({
  selector: 'app-stock-demo',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    DEMO_STYLES,
    `
      .panel { display: grid; gap: 14px; align-content: start; min-width: 0; padding: 16px; border: 1px solid var(--line); border-radius: var(--r-md); background: var(--bg-2); }
      .panel > h3 { margin: 0; font-size: 0.74rem; font-family: var(--font-mono); letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-3); font-weight: 500; }
      .ctl { align-items: flex-end; }
      .ctl .field { flex: 1 1 160px; }
      .chip { display: inline-flex; align-items: center; gap: 8px; min-height: 44px; padding: 0 14px; border: 1px solid var(--line-2); border-radius: var(--r-pill); cursor: pointer; font-size: 0.85rem; }
      .chip input { width: 18px; height: 18px; accent-color: var(--lime); }
      .chip:focus-within { outline: 2px solid var(--accent-text); outline-offset: 2px; }
      .sw { display: inline-block; width: 18px; height: 0; border-top: 2px solid; }
      .sw.d { border-top-style: dashed; }
      .chartwrap { border: 1px solid var(--line); border-radius: var(--r-sm); background: var(--bg-2); overflow: hidden; }
      .chartwrap:focus-visible { outline: 2px solid var(--accent-text); outline-offset: 2px; }
      svg.chart { display: block; width: 100%; touch-action: pan-y; cursor: crosshair; user-select: none; }
      svg.chart text { font-family: var(--font-mono); font-size: 10.5px; fill: var(--text-3); }
      svg.chart .grid { stroke: var(--line); stroke-width: 1; }
      svg.chart .close { fill: none; stroke: var(--text); stroke-width: 1.6; stroke-linejoin: round; }
      svg.chart .area { fill: url(#sd-grad); }
      svg.chart .s50 { fill: none; stroke: var(--sky); stroke-width: 1.6; }
      svg.chart .s200 { fill: none; stroke: var(--amber); stroke-width: 1.6; stroke-dasharray: 6 4; }
      svg.chart .band { fill: color-mix(in srgb, var(--text-3) 18%, transparent); }
      svg.chart .rsi { fill: none; stroke: var(--violet); stroke-width: 1.5; }
      svg.chart .zone { fill: color-mix(in srgb, var(--coral) 10%, transparent); }
      svg.chart .zone.lo { fill: color-mix(in srgb, var(--mint) 12%, transparent); }
      svg.chart .guide { stroke: var(--text-3); stroke-dasharray: 3 4; stroke-width: 1; }
      svg.chart .cross { stroke: var(--text-2); stroke-width: 1; }
      svg.chart .dot { stroke: var(--bg-2); stroke-width: 1.5; }
      svg.chart .gc { fill: var(--mint); } svg.chart .dc { fill: var(--coral); }
      svg.chart .gl { fill: var(--text-2); font-weight: 700; }
      .readout { display: flex; flex-wrap: wrap; gap: 6px 16px; font-family: var(--font-mono); font-size: 0.78rem; color: var(--text-2); }
      .readout b { color: var(--text); font-weight: 600; }
      .legend { display: flex; gap: 14px; flex-wrap: wrap; font-size: 0.78rem; color: var(--text-2); align-items: center; }
      .news { margin: 0; padding: 0; list-style: none; display: grid; gap: 6px; }
      .news li { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 4px 10px; align-items: center; padding: 8px 10px; border: 1px solid var(--line); border-radius: var(--r-sm); background: var(--surface); max-height: 120px; overflow: hidden;
        transition: max-height .5s var(--ease-out), opacity .5s ease, padding .5s ease, background-color .3s ease; }
      .news li .h { font-size: 0.86rem; line-height: 1.35; overflow-wrap: anywhere; }
      .news li .m { grid-column: 2; display: flex; flex-wrap: wrap; gap: 6px; align-items: center; font-family: var(--font-mono); font-size: 0.7rem; color: var(--text-3); }
      .news li.dup { max-height: 40px; opacity: 0.6; padding-top: 5px; padding-bottom: 5px; }
      .news li.dup .h { text-decoration: line-through; }
      .news li.dup .m { display: none; }
      .news li.dropped { max-height: 40px; opacity: 0.6; padding-top: 5px; padding-bottom: 5px; }
      .news li.dropped .m { display: none; }
      .news li.kept { border-color: color-mix(in srgb, var(--mint) 40%, var(--line)); }
      .summary { margin: 0; line-height: 1.7; font-size: 0.92rem; color: var(--text); }
      .cite { padding: 1px 4px; margin: 0 -1px; border-radius: 4px; border-bottom: 1px dashed var(--accent-text); font-weight: 600; cursor: help; transition: background-color .2s ease; }
      .cite:focus-visible { outline: 2px solid var(--accent-text); outline-offset: 1px; }
      .cite.on, .src.on { background: var(--accent-soft); }
      .srcs { display: grid; gap: 8px; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); }
      .src { display: grid; gap: 2px; padding: 8px 10px; border: 1px solid var(--line); border-radius: var(--r-sm); background: var(--surface); transition: background-color .2s ease, border-color .2s ease; }
      .src.on { border-color: var(--accent-line); }
      .src strong { font-size: 0.95rem; font-variant-numeric: tabular-nums; }
      .src span { font-size: 0.72rem; color: var(--text-3); }
      .src small { font-family: var(--font-mono); font-size: 0.64rem; color: var(--text-3); }
      .tiny { font-size: 0.78rem; color: var(--text-3); margin: 0; }
    `,
  ],
  template: `
    <div class="demo">
      <div class="demo__bar">
        <strong class="demo__title">Stock analyzer, technicals and news</strong>
        <span class="demo__tag">Interactive &middot; runs in your browser</span>
      </div>

      <div class="demo__body">
        <div class="row ctl">
          <label class="field">
            <span>Symbol</span>
            <select #symSel (change)="setSymbol(+symSel.value)">
              @for (s of symbols; track s.code; let i = $index) {
                <option [value]="i" [selected]="i === symIdx()">{{ s.name }} ({{ s.code }})</option>
              }
            </select>
          </label>
          <label class="field">
            <span>Seed</span>
            <input type="number" min="1" step="1" [value]="seed()" #seedIn (change)="setSeed(seedIn.value)" />
          </label>
          <button type="button" class="dbtn" (click)="regenerate()">Regenerate with new seed</button>
        </div>

        <div class="row" role="group" aria-label="Chart overlays">
          <label class="chip"><input type="checkbox" [checked]="show50()" #o1 (change)="show50.set(o1.checked)" /> <span class="sw" style="color: var(--sky)"></span> SMA 50</label>
          <label class="chip"><input type="checkbox" [checked]="show200()" #o2 (change)="show200.set(o2.checked)" /> <span class="sw d" style="color: var(--amber)"></span> SMA 200</label>
          <label class="chip"><input type="checkbox" [checked]="showBand()" #o3 (change)="showBand.set(o3.checked)" /> High-low range</label>
          <label class="chip"><input type="checkbox" [checked]="showCross()" #o4 (change)="showCross.set(o4.checked)" /> Cross markers</label>
        </div>

        <div class="kvs" aria-live="polite" aria-label="Latest technicals">
          <div class="kv"><strong>{{ money(last().close) }}</strong><span>Last close, {{ dateLabel(last().date) }}</span></div>
          <div class="kv"><strong>{{ rsiText() }}</strong><span>RSI (14, Wilder) &middot; <span class="pill {{ rsiState().cls }}">{{ rsiState().label }}</span></span></div>
          <div class="kv"><strong>{{ trend().label }}</strong><span>{{ trend().detail }}</span></div>
          <div class="kv"><strong>{{ crossInfo().title }}</strong><span>{{ crossInfo().detail }}</span></div>
        </div>

        <div class="chartwrap" #wrap tabindex="0" role="group"
          aria-label="Price chart with SMA overlays and RSI panel. Use the left and right arrow keys to move the crosshair, Home and End to jump."
          (keydown)="onKey($event)" (blur)="clearHover()">
          <svg class="chart" #svg [attr.viewBox]="'0 0 ' + chart().w + ' ' + chart().h" [attr.width]="chart().w" [attr.height]="chart().h"
            role="img" [attr.aria-label]="chartLabel()"
            (pointermove)="onPointer($event, svg)" (pointerdown)="onPointer($event, svg)" (pointerleave)="clearHover()">
            <defs>
              <linearGradient id="sd-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stop-color="currentColor" stop-opacity="0.16" />
                <stop offset="1" stop-color="currentColor" stop-opacity="0" />
              </linearGradient>
            </defs>
            @for (t of chart().yTicks; track t.y) {
              <line class="grid" [attr.x1]="chart().left" [attr.x2]="chart().right" [attr.y1]="t.y" [attr.y2]="t.y" />
              <text [attr.x]="chart().right + 6" [attr.y]="t.y + 3.5">{{ t.label }}</text>
            }
            @if (showBand()) { <path class="band" [attr.d]="chart().band" /> }
            <path class="area" style="color: var(--text)" [attr.d]="chart().area" />
            <path class="close" [attr.d]="chart().line" />
            @if (show50()) { <path class="s50" [attr.d]="chart().p50" /> }
            @if (show200()) { <path class="s200" [attr.d]="chart().p200" /> }
            @if (showCross()) {
              @for (c of chart().crosses; track c.i) {
                <path [attr.class]="c.kind === 'golden' ? 'gc' : 'dc'" [attr.d]="c.shape" />
                <text class="gl" [attr.x]="c.x" [attr.y]="c.ty" text-anchor="middle">{{ c.kind === 'golden' ? 'Golden' : 'Death' }}</text>
              }
            }
            @for (t of chart().xTicks; track t.x) {
              <text [attr.x]="t.x" [attr.y]="chart().priceBottom + 14" text-anchor="middle">{{ t.label }}</text>
            }

            <rect class="zone" [attr.x]="chart().left" [attr.width]="chart().right - chart().left" [attr.y]="chart().rsiTop" [attr.height]="chart().rsiH * 0.3" />
            <rect class="zone lo" [attr.x]="chart().left" [attr.width]="chart().right - chart().left" [attr.y]="chart().rsiTop + chart().rsiH * 0.7" [attr.height]="chart().rsiH * 0.3" />
            <line class="guide" [attr.x1]="chart().left" [attr.x2]="chart().right" [attr.y1]="chart().rsiTop + chart().rsiH * 0.3" [attr.y2]="chart().rsiTop + chart().rsiH * 0.3" />
            <line class="guide" [attr.x1]="chart().left" [attr.x2]="chart().right" [attr.y1]="chart().rsiTop + chart().rsiH * 0.7" [attr.y2]="chart().rsiTop + chart().rsiH * 0.7" />
            <text [attr.x]="chart().right + 6" [attr.y]="chart().rsiTop + chart().rsiH * 0.3 + 3.5">70</text>
            <text [attr.x]="chart().right + 6" [attr.y]="chart().rsiTop + chart().rsiH * 0.7 + 3.5">30</text>
            <text [attr.x]="chart().left + 4" [attr.y]="chart().rsiTop + 11">RSI 14</text>
            <path class="rsi" [attr.d]="chart().rsiLine" />

            @if (hover() !== null) {
              <line class="cross" [attr.x1]="hx()" [attr.x2]="hx()" [attr.y1]="chart().priceTop" [attr.y2]="chart().h - 6" />
              <circle class="dot" r="4" [attr.cx]="hx()" [attr.cy]="hyPrice()" fill="var(--text)" />
              @if (hyRsi() !== null) { <circle class="dot" r="4" [attr.cx]="hx()" [attr.cy]="hyRsi()" fill="var(--violet)" /> }
            }
          </svg>
        </div>
        <p class="sr-only" aria-live="polite">{{ kbAnnounce() }}</p>
        <div class="readout" aria-hidden="true">
          <span><b>{{ dateLabel(shown().date) }}</b></span>
          <span>O {{ shown().open.toFixed(2) }}</span><span>H {{ shown().high.toFixed(2) }}</span>
          <span>L {{ shown().low.toFixed(2) }}</span><span>C <b>{{ shown().close.toFixed(2) }}</b></span>
          <span>SMA50 {{ shown().sma50 }}</span><span>SMA200 {{ shown().sma200 }}</span><span>RSI {{ shown().rsi }}</span>
        </div>
        <div class="legend">
          <span><span class="sw" style="color: var(--text)"></span> Close</span>
          <span><span class="sw" style="color: var(--sky)"></span> SMA 50</span>
          <span><span class="sw d" style="color: var(--amber)"></span> SMA 200 (starts after 200 sessions)</span>
          <span>RSI shading: above 70 overbought, below 30 oversold</span>
        </div>

        <div class="grid-2">
          <section class="panel" aria-labelledby="s-news">
            <h3 id="s-news">News merged from several feeds</h3>
            <div class="row">
              <button type="button" class="dbtn dbtn--primary" [disabled]="deduping()" (click)="runDedupe()">{{ revealed() > 0 && revealed() === newsCount ? 'Run again' : 'Dedupe' }}</button>
              <button type="button" class="dbtn" (click)="resetNews()">Reset</button>
            </div>
            <p class="hint" aria-live="polite">{{ newsStatus() }}</p>
            <ul class="news" aria-label="Headlines from feeds">
              @for (n of news; track i; let i = $index) {
                <li [class]="itemClass(i)">
                  <span class="pill {{ stateCls(i) }}">{{ stateLabel(i) }}</span>
                  <span class="h" [attr.title]="'Raw: ' + quote(n.raw)">{{ n.raw.trim() || '(empty title)' }}</span>
                  <span class="m">
                    <span>{{ n.feed }}</span>
                    @if (hashes[i]) { <span>#{{ hashes[i] }}</span> }
                    @if (n.raw.trim() !== '[Removed]') {
                      <span class="pill {{ sentCls(i) }}">{{ sent[i].label }} {{ sentScore(i) }}</span>
                    }
                  </span>
                </li>
              }
            </ul>
            <p class="tiny">The key is sha256 of the lower-cased, trimmed headline (first 16 hex chars), exactly as the ingestor computes it. Only case and surrounding whitespace are normalised, so re-worded or re-punctuated copies are different hashes and survive; the embedding-similarity layer is what links those. Sentiment here is a small word-list <strong>stand-in for FinBERT</strong>; it keeps FinBERT's output shape (three scores, score = positive minus negative).</p>
          </section>

          <section class="panel" aria-labelledby="s-ai">
            <h3 id="s-ai">AI summary (every number is traceable)</h3>
            <p class="summary" aria-live="polite">
              @for (s of summary(); track $index) {
                @if (s.ref) {
                  <span class="cite" tabindex="0" [class.on]="hoverRef() === s.ref" [attr.title]="'Source: ' + traceOf(s.ref)"
                    (mouseenter)="hoverRef.set(s.ref)" (mouseleave)="hoverRef.set('')" (focus)="hoverRef.set(s.ref)" (blur)="hoverRef.set('')">{{ s.t }}</span>
                } @else {
                  <span>{{ s.t }}</span>
                }
              }
            </p>
            <p class="tiny">In the real app an LLM writes this text, constrained to cite only numbers present in the stored data block. Here a fixed template stands in, and it can only print values from the table below. Hover or focus a number to see where it came from.</p>
            <div class="srcs" role="list" aria-label="Data the summary may cite">
              @for (s of sources(); track s.key) {
                <div class="src" role="listitem" [class.on]="hoverRef() === s.key">
                  <span>{{ s.label }}</span><strong>{{ s.value }}</strong><small>{{ s.trace }}</small>
                </div>
              }
            </div>
          </section>
        </div>
      </div>

      <p class="demo__note">
        All prices, volumes and headlines are synthetic: invented "Sample Industries" symbols and a seeded random walk, not market data.
        RSI-14 (simple-mean seed, then Wilder smoothing), SMA 50 / 200 and the headline-hash de-duplication are the same logic as the real ingestion code.
        Simplified: the real system pulls daily bars from yfinance and 11 live RSS feeds, scores sentiment with FinBERT, finds similar past events with embeddings,
        and uses an LLM (hosted or local) for the summary; here sentiment is a word list and the summary is a template.
        The 70 / 30 RSI bands are the conventional ones, used here for labelling only.
      </p>
    </div>
  `,
})
export class StockDemoComponent {
  private readonly device = inject(DeviceService);
  private readonly zone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);
  private readonly wrap = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly symbols = SYMBOLS;
  protected readonly news = NEWS;
  protected readonly hashes = NEWS_HASH;
  protected readonly sent = NEWS_SENT;
  protected readonly newsCount = NEWS.length;
  protected money = money;
  protected dateLabel = dateLabel;

  readonly symIdx = signal(0);
  readonly seeds = signal<number[]>(SYMBOLS.map((s) => s.seed));
  readonly width = signal(720);
  readonly show50 = signal(true);
  readonly show200 = signal(true);
  readonly showBand = signal(false);
  readonly showCross = signal(true);
  readonly hover = signal<number | null>(null);
  readonly kbAnnounce = signal('');
  readonly revealed = signal(0);
  readonly deduping = signal(false);
  readonly hoverRef = signal('');

  private revealTimer: ReturnType<typeof setInterval> | null = null;
  protected readonly outcomes = dedupe(NEWS.map((n) => n.raw));

  readonly seed = computed(() => this.seeds()[this.symIdx()] as number);
  readonly bars = computed(() => genBars(SYMBOLS[this.symIdx()] as SymbolSpec, this.seed()));

  readonly last = computed(() => {
    const b = this.bars();
    const i = b.close.length - 1;
    return { date: b.dates[i] as string, close: b.close[i] as number };
  });

  readonly rsiNow = computed(() => {
    const r = this.bars().rsi;
    return r[r.length - 1] as number;
  });
  readonly rsiText = computed(() => (Number.isNaN(this.rsiNow()) ? 'n/a' : this.rsiNow().toFixed(1)));
  readonly rsiState = computed(() => {
    const r = this.rsiNow();
    if (r >= 70) return { label: 'overbought', cls: 'bad' };
    if (r <= 30) return { label: 'oversold', cls: 'ok' };
    return { label: 'neutral', cls: 'mute' };
  });

  readonly trend = computed(() => {
    const b = this.bars();
    const i = b.close.length - 1;
    const a = b.sma50[i] as number;
    const s = b.sma200[i] as number;
    if (a > s) return { label: 'SMA 50 above 200', detail: 'Bullish regime: ' + a.toFixed(2) + ' vs ' + s.toFixed(2) };
    return { label: 'SMA 50 below 200', detail: 'Bearish regime: ' + a.toFixed(2) + ' vs ' + s.toFixed(2) };
  });

  /** Golden cross = SMA50 crosses above SMA200; death cross = below. Needs both averages (from session 200). */
  readonly crossList = computed(() => {
    const b = this.bars();
    const out: { i: number; kind: 'golden' | 'death' }[] = [];
    for (let i = 200; i < b.close.length; i++) {
      const d0 = (b.sma50[i - 1] as number) - (b.sma200[i - 1] as number);
      const d1 = (b.sma50[i] as number) - (b.sma200[i] as number);
      if (d0 <= 0 && d1 > 0) out.push({ i, kind: 'golden' });
      else if (d0 >= 0 && d1 < 0) out.push({ i, kind: 'death' });
    }
    return out;
  });

  readonly crossInfo = computed(() => {
    const list = this.crossList();
    const b = this.bars();
    const lastCross = list[list.length - 1];
    if (!lastCross) return { title: 'No cross', detail: 'SMA 50 / 200 have not crossed in the window' };
    const ago = b.close.length - 1 - lastCross.i;
    return {
      title: lastCross.kind === 'golden' ? 'Golden cross' : 'Death cross',
      detail: dateLabel(b.dates[lastCross.i] as string) + ', ' + ago + ' sessions ago',
    };
  });

  readonly shown = computed(() => {
    const b = this.bars();
    const i = this.hover() ?? b.close.length - 1;
    const f = (x: number): string => (Number.isNaN(x) ? '--' : x.toFixed(2));
    return {
      date: b.dates[i] as string,
      open: b.open[i] as number,
      high: b.high[i] as number,
      low: b.low[i] as number,
      close: b.close[i] as number,
      sma50: f(b.sma50[i] as number),
      sma200: f(b.sma200[i] as number),
      rsi: Number.isNaN(b.rsi[i] as number) ? '--' : (b.rsi[i] as number).toFixed(1),
    };
  });

  readonly chart = computed(() => {
    const b = this.bars();
    const n = b.close.length;
    const w = Math.max(280, this.width());
    const left = 6;
    const right = w - 46;
    const priceTop = 8;
    const priceBottom = 222;
    const rsiTop = 250;
    const rsiH = 92;
    const h = rsiTop + rsiH + 8;
    const X = (i: number): number => left + (i * (right - left)) / (n - 1);

    let lo = Infinity;
    let hi = -Infinity;
    for (let i = 0; i < n; i++) {
      lo = Math.min(lo, b.low[i] as number);
      hi = Math.max(hi, b.high[i] as number);
    }
    const pad = (hi - lo) * 0.05;
    lo -= pad;
    hi += pad;
    const Y = (p: number): number => priceTop + ((hi - p) / (hi - lo)) * (priceBottom - priceTop);
    const f = (x: number): string => (Math.round(x * 10) / 10).toString();

    const pathOf = (arr: number[]): string => {
      let d = '';
      let pen = false;
      for (let i = 0; i < n; i++) {
        const v = arr[i] as number;
        if (Number.isNaN(v)) { pen = false; continue; }
        d += (pen ? 'L' : 'M') + f(X(i)) + ' ' + f(Y(v)) + ' ';
        pen = true;
      }
      return d.trim();
    };
    const line = pathOf(b.close);
    const area = line + ' L' + f(X(n - 1)) + ' ' + priceBottom + ' L' + f(X(0)) + ' ' + priceBottom + ' Z';

    let band = '';
    for (let i = 0; i < n; i++) band += (i === 0 ? 'M' : 'L') + f(X(i)) + ' ' + f(Y(b.high[i] as number)) + ' ';
    for (let i = n - 1; i >= 0; i--) band += 'L' + f(X(i)) + ' ' + f(Y(b.low[i] as number)) + ' ';
    band += 'Z';

    const yTicks: { y: number; label: string }[] = [];
    for (let k = 0; k <= 3; k++) {
      const p = lo + ((hi - lo) * k) / 3;
      yTicks.push({ y: Math.round(Y(p) * 10) / 10, label: p.toFixed(0) });
    }
    const xTicks: { x: number; label: string }[] = [];
    for (let k = 0; k < 5; k++) {
      const i = Math.round(((n - 1) * k) / 4);
      const lab = dateLabel(b.dates[i] as string).slice(3);
      xTicks.push({ x: Math.min(Math.max(X(i), left + 18), right - 18), label: lab });
    }

    const crosses = this.crossList().map((c) => {
      const cx = X(c.i);
      const cy = Y(b.sma50[c.i] as number);
      const up = c.kind === 'golden';
      const shape = up
        ? 'M' + f(cx) + ' ' + f(cy - 9) + ' L' + f(cx - 6) + ' ' + f(cy + 2) + ' L' + f(cx + 6) + ' ' + f(cy + 2) + ' Z'
        : 'M' + f(cx) + ' ' + f(cy + 9) + ' L' + f(cx - 6) + ' ' + f(cy - 2) + ' L' + f(cx + 6) + ' ' + f(cy - 2) + ' Z';
      return { i: c.i, kind: c.kind, x: Math.min(Math.max(cx, left + 22), right - 22), shape, ty: up ? cy - 14 : cy + 21 };
    });

    const RY = (r: number): number => rsiTop + ((100 - r) / 100) * rsiH;
    let rsiLine = '';
    let pen = false;
    for (let i = 0; i < n; i++) {
      const v = b.rsi[i] as number;
      if (Number.isNaN(v)) continue;
      rsiLine += (pen ? 'L' : 'M') + f(X(i)) + ' ' + f(RY(v)) + ' ';
      pen = true;
    }

    return {
      w, h, left, right, priceTop, priceBottom, rsiTop, rsiH,
      line, area, band, p50: pathOf(b.sma50), p200: pathOf(b.sma200), rsiLine: rsiLine.trim(),
      yTicks, xTicks, crosses, X, Y, RY,
    };
  });

  readonly hx = computed(() => {
    const i = this.hover();
    return i === null ? 0 : this.chart().X(i);
  });
  readonly hyPrice = computed(() => {
    const i = this.hover();
    return i === null ? 0 : this.chart().Y(this.bars().close[i] as number);
  });
  readonly hyRsi = computed(() => {
    const i = this.hover();
    if (i === null) return null;
    const r = this.bars().rsi[i] as number;
    return Number.isNaN(r) ? null : this.chart().RY(r);
  });

  readonly chartLabel = computed(() => {
    const spec = SYMBOLS[this.symIdx()] as SymbolSpec;
    return spec.name + ' synthetic price, 260 sessions. Last close ' + money(this.last().close) + ', RSI ' + this.rsiText() + ', ' + this.rsiState().label + '.';
  });

  /* ---- news / summary ---- */

  readonly newsStatus = computed(() => {
    const r = this.revealed();
    const n = this.newsCount;
    if (r === 0) return n + ' headlines fetched from the feeds. Nothing has been de-duplicated yet.';
    const slice = this.outcomes.slice(0, r);
    const kept = slice.filter((o) => o.state === 'kept').length;
    const dups = slice.filter((o) => o.state === 'dup').length;
    const drop = slice.filter((o) => o.state === 'dropped').length;
    return (r < n ? 'Checking headline ' + r + ' of ' + n + '. ' : 'Done. ') + kept + ' kept, ' + dups + ' duplicates removed, ' + drop + ' dropped.';
  });

  private readonly newsFacts = computed(() => {
    if (this.revealed() < this.newsCount) return null;
    let kept = 0;
    let dups = 0;
    let pos = 0;
    let neg = 0;
    this.outcomes.forEach((o, i) => {
      if (o.state === 'dup') dups++;
      if (o.state === 'kept') {
        kept++;
        if ((NEWS_SENT[i] as Sentiment).label === 'positive') pos++;
        if ((NEWS_SENT[i] as Sentiment).label === 'negative') neg++;
      }
    });
    return { kept, dups, pos, neg };
  });

  readonly sources = computed<Source[]>(() => {
    const b = this.bars();
    const i = b.close.length - 1;
    const back = b.close[i - 21] as number;
    const chg = ((b.close[i] as number) / back - 1) * 100;
    let hi = -Infinity;
    let lo = Infinity;
    for (let k = 0; k < b.close.length; k++) {
      hi = Math.max(hi, b.high[k] as number);
      lo = Math.min(lo, b.low[k] as number);
    }
    const list: Source[] = [
      { key: 'price', label: 'Last close', value: money(b.close[i] as number), trace: 'close[' + i + ']' },
      { key: 'chg', label: '21-session change', value: (chg >= 0 ? '+' : '') + chg.toFixed(2) + '%', trace: 'close[' + i + '] / close[' + (i - 21) + ']' },
      { key: 'rsi', label: 'RSI (14)', value: this.rsiText(), trace: 'Wilder smoothing at index ' + i },
      { key: 'sma50', label: 'SMA 50', value: (b.sma50[i] as number).toFixed(2), trace: 'mean of last 50 closes' },
      { key: 'sma200', label: 'SMA 200', value: (b.sma200[i] as number).toFixed(2), trace: 'mean of last 200 closes' },
      { key: 'hi', label: '260-session high', value: money(hi), trace: 'max(high)' },
      { key: 'lo', label: '260-session low', value: money(lo), trace: 'min(low)' },
    ];
    const last = this.crossList()[this.crossList().length - 1];
    if (last) list.push({ key: 'ago', label: 'Sessions since cross', value: String(i - last.i), trace: 'index ' + i + ' minus ' + last.i });
    const nf = this.newsFacts();
    if (nf) {
      list.push({ key: 'kept', label: 'Unique headlines', value: String(nf.kept), trace: 'after hash de-dupe' });
      list.push({ key: 'dups', label: 'Duplicates removed', value: String(nf.dups), trace: 'same sha256 key' });
      list.push({ key: 'pos', label: 'Positive (stand-in)', value: String(nf.pos), trace: 'lexicon label' });
      list.push({ key: 'neg', label: 'Negative (stand-in)', value: String(nf.neg), trace: 'lexicon label' });
    }
    return list;
  });

  /** Template summary: every number in it comes from `sources()`. */
  readonly summary = computed<Seg[]>(() => {
    const spec = SYMBOLS[this.symIdx()] as SymbolSpec;
    const src = this.sources();
    const v = (k: string): string => (src.find((s) => s.key === k) as Source).value;
    const has = (k: string): boolean => src.some((s) => s.key === k);
    const b = this.bars();
    const i = b.close.length - 1;
    const up = (b.close[i] as number) >= (b.close[i - 21] as number);
    const segs: Seg[] = [
      { t: spec.name + ' closed at ' },
      { t: v('price'), ref: 'price' },
      { t: ', ' + (up ? 'up ' : 'down ') },
      { t: v('chg').replace('+', ''), ref: 'chg' },
      { t: ' over the last 21 sessions. RSI(14) is ' },
      { t: v('rsi'), ref: 'rsi' },
      { t: ' (' + this.rsiState().label + '). The 50-day average (' },
      { t: v('sma50'), ref: 'sma50' },
      { t: ') is ' + ((b.sma50[i] as number) > (b.sma200[i] as number) ? 'above' : 'below') + ' the 200-day average (' },
      { t: v('sma200'), ref: 'sma200' },
      { t: ')' },
    ];
    if (has('ago')) {
      const k = this.crossList()[this.crossList().length - 1] as { kind: string };
      segs.push({ t: '; the last ' + k.kind + ' cross was ' });
      segs.push({ t: v('ago'), ref: 'ago' });
      segs.push({ t: ' sessions ago' });
    }
    segs.push({ t: '. The 260-session range is ' });
    segs.push({ t: v('lo'), ref: 'lo' });
    segs.push({ t: ' to ' });
    segs.push({ t: v('hi'), ref: 'hi' });
    segs.push({ t: '. ' });
    if (has('kept')) {
      segs.push({ t: 'After de-duplication there are ' });
      segs.push({ t: v('kept'), ref: 'kept' });
      segs.push({ t: ' unique headlines (' });
      segs.push({ t: v('dups'), ref: 'dups' });
      segs.push({ t: ' duplicates removed): ' });
      segs.push({ t: v('pos'), ref: 'pos' });
      segs.push({ t: ' read positive and ' });
      segs.push({ t: v('neg'), ref: 'neg' });
      segs.push({ t: ' negative by the stand-in scorer. This is a description of the data above, not advice.' });
    } else {
      segs.push({ t: 'Run Dedupe to add the news counts. This is a description of the data above, not advice.' });
    }
    return segs;
  });

  constructor() {
    afterNextRender(() => {
      const el = this.wrap.nativeElement.querySelector('.chartwrap') as HTMLElement | null;
      if (!el || typeof ResizeObserver === 'undefined') return;
      const apply = (): void => {
        const w = Math.round(el.clientWidth);
        if (w > 0 && w !== this.width()) this.zone.run(() => this.width.set(w));
      };
      apply();
      const ro = new ResizeObserver(apply);
      ro.observe(el);
      this.destroyRef.onDestroy(() => ro.disconnect());
    });
    this.destroyRef.onDestroy(() => this.stopReveal());
  }

  /* ---------------- handlers ---------------- */

  setSymbol(i: number): void {
    if (i >= 0 && i < SYMBOLS.length) {
      this.symIdx.set(i);
      this.hover.set(null);
    }
  }

  setSeed(v: string): void {
    const n = Math.round(parseFloat(v));
    if (!Number.isFinite(n) || n < 1) return;
    this.setSeedValue(n);
  }

  regenerate(): void {
    this.setSeedValue(1 + Math.floor(Math.random() * 9999));
  }

  private setSeedValue(n: number): void {
    const idx = this.symIdx();
    this.seeds.update((s) => s.map((x, i) => (i === idx ? n : x)));
    this.hover.set(null);
  }

  onPointer(ev: PointerEvent, svg: Element): void {
    const rect = svg.getBoundingClientRect();
    if (!rect.width) return;
    const c = this.chart();
    const x = ((ev.clientX - rect.left) / rect.width) * c.w;
    const n = this.bars().close.length;
    const i = Math.round(((x - c.left) / (c.right - c.left)) * (n - 1));
    this.hover.set(Math.max(0, Math.min(n - 1, i)));
  }

  clearHover(): void {
    this.hover.set(null);
  }

  onKey(ev: KeyboardEvent): void {
    const n = this.bars().close.length;
    const cur = this.hover() ?? n - 1;
    const step = ev.shiftKey ? 10 : 1;
    let next: number | null = null;
    if (ev.key === 'ArrowLeft') next = cur - step;
    else if (ev.key === 'ArrowRight') next = cur + step;
    else if (ev.key === 'Home') next = 0;
    else if (ev.key === 'End') next = n - 1;
    else if (ev.key === 'Escape') {
      this.hover.set(null);
      return;
    }
    if (next === null) return;
    ev.preventDefault();
    next = Math.max(0, Math.min(n - 1, next));
    this.hover.set(next);
    const s = this.shown();
    this.kbAnnounce.set(dateLabel(s.date) + ': close ' + s.close.toFixed(2) + ', RSI ' + s.rsi + ', SMA 50 ' + s.sma50 + ', SMA 200 ' + s.sma200);
  }

  runDedupe(): void {
    if (this.deduping()) return;
    this.stopReveal();
    if (this.device.reducedMotion) {
      this.revealed.set(this.newsCount);
      return;
    }
    this.revealed.set(0);
    this.deduping.set(true);
    this.revealTimer = setInterval(() => {
      const next = this.revealed() + 1;
      this.revealed.set(next);
      if (next >= this.newsCount) this.stopReveal();
    }, 240);
  }

  resetNews(): void {
    this.stopReveal();
    this.revealed.set(0);
  }

  private stopReveal(): void {
    if (this.revealTimer) clearInterval(this.revealTimer);
    this.revealTimer = null;
    this.deduping.set(false);
  }

  /* ---------------- template helpers ---------------- */

  protected quote(s: string): string {
    return '"' + s + '"';
  }

  protected traceOf(ref: string): string {
    const s = this.sources().find((x) => x.key === ref);
    return s ? s.label + ' = ' + s.value + ' (' + s.trace + ')' : '';
  }

  private stateOf(i: number): DedupeState | 'pending' {
    return i < this.revealed() ? (this.outcomes[i] as DedupeOutcome).state : 'pending';
  }

  protected itemClass(i: number): string {
    return this.stateOf(i);
  }

  protected stateLabel(i: number): string {
    const s = this.stateOf(i);
    if (s === 'dup') return 'duplicate of #' + ((this.outcomes[i] as DedupeOutcome).of + 1);
    if (s === 'dropped') return 'dropped';
    if (s === 'kept') return 'kept #' + (i + 1);
    return '#' + (i + 1);
  }

  protected stateCls(i: number): string {
    const s = this.stateOf(i);
    return s === 'kept' ? 'ok' : s === 'dup' ? 'warn' : s === 'dropped' ? 'bad' : 'mute';
  }

  protected sentCls(i: number): string {
    const l = (NEWS_SENT[i] as Sentiment).label;
    return l === 'positive' ? 'ok' : l === 'negative' ? 'bad' : 'mute';
  }

  protected sentScore(i: number): string {
    const sc = (NEWS_SENT[i] as Sentiment).score;
    return (sc >= 0 ? '+' : '') + sc.toFixed(2);
  }
}
