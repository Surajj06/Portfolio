import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { DEMO_STYLES } from './demo-styles';

/* ------------------------------------------------------------------ */
/*  Port of the pure helpers in the real automation (Report.gs).       */
/*  Same semantics; only the project names in the table are generic.   */
/* ------------------------------------------------------------------ */

const IST_OFFSET_MIN = 330;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Real defaults from the script properties. */
const CFG = { askAt: '17:30', sendByHour: 21, dayStart: '09:30', gapCap: 60, maxPerRun: 5 };

const istShift = (d: Date): Date => new Date(d.getTime() + IST_OFFSET_MIN * 60000);
const istDay = (d: Date): string => istShift(d).toISOString().slice(0, 10);
const istMinuteOfDay = (d: Date): number => {
  const s = istShift(d);
  return s.getUTCHours() * 60 + s.getUTCMinutes();
};

function addDays(ymd: string, n: number): string {
  const d = new Date(ymd + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function dateLabel(ymd: string): string {
  const p = ymd.split('-');
  return p[2] + '-' + MONTHS[+(p[1] as string) - 1] + '-' + p[0];
}

function hmToMinutes(hm: string): number {
  const p = String(hm).split(':');
  return +(p[0] as string) * 60 + (+(p[1] as string) || 0);
}

function hhmm(minutes: number): string {
  const pad = (n: number): string => (n < 10 ? '0' : '') + n;
  return pad(Math.floor(minutes / 60)) + ':' + pad(minutes % 60);
}

/** dueDates_: a day is due once over; today only after the send-by hour; oldest first, at most maxPerRun. */
function dueDates(lastSent: string, now: Date, sendByHour: number, maxPerRun: number): string[] {
  const today = istDay(now);
  const out: string[] = [];
  for (let d = addDays(lastSent, 1); d <= today; d = addDays(d, 1)) {
    if (d === today && istMinuteOfDay(now) < sendByHour * 60) continue;
    out.push(d);
    if (out.length >= maxPerRun) break;
  }
  return out;
}

interface Commit {
  sha: string;
  subject: string;
  minute: number;
  minutes: number;
}

/** estimateMinutes_: gap since the previous commit (first: since day start), capped, never negative. */
function estimateMinutes(commits: Commit[], dayStartMin: number, capMin: number): Commit[] {
  let prev = dayStartMin;
  commits.forEach((c) => {
    c.minutes = Math.max(0, Math.min(c.minute - prev, capMin));
    prev = Math.max(prev, c.minute);
  });
  return commits;
}

function parseMinutes(v: unknown): number | null {
  if (typeof v === 'number') return isFinite(v) && v > 0 ? Math.round(v) : null;
  const s = String(v == null ? '' : v).trim().toLowerCase();
  if (!s) return null;
  const clock = s.match(/^(\d+):(\d{2})$/);
  if (clock) return +(clock[1] as string) * 60 + +(clock[2] as string);
  const h = s.match(/(\d+(?:\.\d+)?)\s*h/);
  const m = s.match(/(\d+)\s*m/);
  if (h || m) return Math.round((h ? +(h[1] as string) * 60 : 0) + (m ? +(m[1] as string) : 0));
  if (/^\d+$/.test(s)) return +s;
  return null;
}

interface ExtraProject { name: string; key: string }

/** A line starts with one of these keys ("Meeting" and "Meetings" both match). Generic names here. */
const EXTRA_PROJECTS: ExtraProject[] = [
  { name: 'Project Alpha', key: 'alpha' },
  { name: 'Project Beta', key: 'beta' },
  { name: 'Project Gamma', key: 'gamma' },
  { name: 'Support', key: 'support' },
  { name: 'Meetings', key: 'meeting' },
  { name: 'Voice Agent', key: 'voice' },
  { name: 'Other', key: 'other' },
];

/** replyBody_: the reply without the quoted mail underneath it. */
function replyBody(plain: string): string {
  const t = String(plain || '').replace(/\r\n/g, '\n');
  const cuts = [
    t.search(/\n\s*On [\s\S]{0,200}?wrote:/),
    t.search(/(^|\n)>/),
    t.search(/\n\s*-{2,}\s*Original Message/i),
    t.search(/\n\s*From:\s/),
  ].filter((i) => i >= 0);
  return (cuts.length ? t.slice(0, Math.min(...cuts)) : t).trim();
}

function matchProject(left: string): ExtraProject | null {
  const l = left.trim().toLowerCase();
  let best: ExtraProject | null = null;
  EXTRA_PROJECTS.forEach((p) => {
    if (l.indexOf(p.key) === 0 && (!best || p.key.length > best.key.length)) best = p;
  });
  return best;
}

interface ReplyItem { project: string; description: string; env: string; minutes: number; status: string }

interface ParseResult {
  items: ReplyItem[];
  unparsed: string[];
  reasons: string[];
  ignored: string[];
  confirmed: boolean;
  quoted: boolean;
}

/**
 * parseReply_: "PROJECT: what you did - time", optional "| environment". A line that looks like an item
 * but cannot be read goes to `unparsed` and keeps the report waiting. confirmed = at least one item or
 * "none"/"send"/"ok", and nothing unreadable. (`reasons` and `ignored` are extra, for display only.)
 */
function parseReply(text: string): ParseResult {
  const items: ReplyItem[] = [];
  const unparsed: string[] = [];
  const reasons: string[] = [];
  const ignored: string[] = [];
  let said = false;
  const body = replyBody(text);
  body.split('\n').forEach((raw) => {
    const line = raw.trim();
    if (!line) return;
    if (/^(none|nothing|nothing to add|no|no more|nil|send|send now|ok|okay|done)[.!]*$/i.test(line)) {
      said = true;
      ignored.push(line + '  (confirms: nothing more to add)');
      return;
    }
    const colon = line.indexOf(':');
    const proj = colon > 0 ? matchProject(line.slice(0, colon)) : null;
    let rest = colon > 0 ? line.slice(colon + 1).trim() : '';
    if (proj && !rest) {
      ignored.push(line + '  (blank template line)');
      return;
    }
    const looksLikeItem = !!proj || /\d+\s*(mins?|m|hrs?|h|hours?)\b/i.test(line) || /^[A-Za-z ]{2,20}:/.test(line);
    if (!looksLikeItem) {
      ignored.push(line + '  (not an item, like a greeting or signature)');
      return;
    }
    if (!proj) {
      unparsed.push(line);
      reasons.push(colon > 0 ? 'unknown project "' + line.slice(0, colon).trim() + '"' : 'no "PROJECT:" at the start');
      return;
    }
    let env = '';
    const bar = rest.lastIndexOf('|');
    if (bar >= 0) {
      env = rest.slice(bar + 1).trim();
      rest = rest.slice(0, bar).trim();
    }
    const m = rest.match(/^(.*\S)\s+[-–—]\s+([^-–—]+)$/);
    const minutes = m ? parseMinutes(m[2]) : null;
    if (minutes === null || !m) {
      unparsed.push(line);
      reasons.push('no readable time after " - "');
      return;
    }
    items.push({ project: proj.name, description: (m[1] as string).trim(), env: env || '-', minutes, status: 'Done' });
  });
  return {
    items, unparsed, reasons, ignored,
    confirmed: !unparsed.length && (said || items.length > 0),
    quoted: body.length < String(text || '').replace(/\r\n/g, '\n').trim().length,
  };
}

interface Row { project: string; description: string; env: string; minutes: number; status: string; first: number }

interface CodeItem { area: string; description: string; commits: string[] }

function codeRow(cfg: { project: string; areaPrefix: string }, area: string, text: string, cs: Commit[]): Row {
  let minutes = 0;
  let first = 1440;
  cs.forEach((c) => {
    minutes += c.minutes;
    first = Math.min(first, c.minute);
  });
  return {
    project: cfg.project,
    description: cfg.areaPrefix + ' / ' + (area || 'General') + ': ' + text,
    env: 'Pushed to main (GitHub): ' + cs.map((c) => c.sha).join(', ') + '. Production deploy: not confirmed.',
    minutes,
    status: 'Done',
    first,
  };
}

/** buildRows_: one row per group; a commit left out still gets a row; a commit listed twice counts once. */
function buildRows(items: CodeItem[], commits: Commit[], cfg: { project: string; areaPrefix: string }): Row[] {
  const bySha: Record<string, Commit> = {};
  const used: Record<string, boolean> = {};
  const rows: Row[] = [];
  commits.forEach((c) => (bySha[c.sha] = c));
  items.forEach((it) => {
    const mine = it.commits
      .filter((s) => {
        if (used[s]) return false;
        used[s] = true;
        return true;
      })
      .map((s) => bySha[s] as Commit);
    if (mine.length) rows.push(codeRow(cfg, it.area, it.description, mine));
  });
  commits.forEach((c) => {
    if (!used[c.sha]) {
      used[c.sha] = true;
      rows.push(codeRow(cfg, '', c.subject, [c]));
    }
  });
  rows.sort((a, b) => a.first - b.first);
  return rows;
}

function fmtMinutes(m: number | null): string {
  if (m == null) return 'not entered';
  if (m < 60) return m + ' min';
  const h = Math.floor(m / 60);
  return h + (h === 1 ? ' hr ' : ' hrs ') + (m % 60) + ' min';
}

const totalMinutes = (rows: { minutes: number }[]): number => rows.reduce((a, r) => a + (r.minutes || 0), 0);

/** projectSpans_: spans[i] = rows covered by the project cell starting at i, 0 when already covered. */
function projectSpans(rows: { project: string }[]): number[] {
  const spans = rows.map(() => 0);
  let start = 0;
  for (let i = 1; i <= rows.length; i++) {
    if (i === rows.length || (rows[i] as { project: string }).project !== (rows[start] as { project: string }).project) {
      spans[start] = i - start;
      start = i;
    }
  }
  return spans;
}

function footerNote(gapCapMin: number, answered: boolean): string {
  return (
    'Time for code items is estimated from commit times (each gap capped at ' + gapCapMin +
    ' min); other items are as entered. The total is the sum of the rows.' +
    (answered ? '' : ' Items outside git (extra projects, support, meetings) were not confirmed for this day.')
  );
}

function alertText(kind: string, ymd: string, detail: string): { subject: string; body: string } {
  const label = dateLabel(ymd);
  const what: Record<string, string> = {
    credits:
      'The LLM API credit balance is used up, so the report for ' + label + ' cannot be written yet. ' +
      'Top up the account. It is retried on every run and goes out by itself once credits are back.',
    unparsed:
      'Some lines of your reply for ' + label + ' could not be read, so the report is waiting. Reply again with everything in one mail, ' +
      'one line per item as PROJECT: what you did - time. The lines were:',
    other: 'The report for ' + label + ' failed and is retried on the next run.',
  };
  return {
    subject: '[Daily report] ' + label + (kind === 'unparsed' ? ': could not read your reply' : ': waiting'),
    body: (what[kind] ?? what['other']) + (detail ? '\n\nDetail: ' + detail : ''),
  };
}

/* ------------------------------------------------------------------ */

const TODAY = '2026-10-22';
const DAY_START_DEFAULT = hmToMinutes(CFG.dayStart);
const RUN_MINUTES = Array.from({ length: 10 }, (_, k) => 1020 + k * 30); // 17:00 .. 21:30
const TL_START = 1020;
const TL_END = 1350;

interface CommitInput { id: number; time: string; msg: string }

const COMMITS_SEED: CommitInput[] = [
  { id: 1, time: '09:52', msg: 'Speech: tune silence detection' },
  { id: 2, time: '10:14', msg: 'Speech: handle barge-in during greetings' },
  { id: 3, time: '10:30', msg: 'Dashboard: show live call transcript' },
  { id: 4, time: '11:12', msg: 'Dashboard: fix empty state on first load' },
  { id: 5, time: '11:30', msg: 'Latency: cache voice prompts' },
  { id: 6, time: '16:00', msg: 'Email: send summary after each call' },
];

const SAMPLES: { id: string; label: string; text: string }[] = [
  {
    id: 'typical',
    label: 'Typical reply',
    text: [
      'Alpha: Reviewed mapping for 1 file - 40 min | Staging database',
      'Meeting: Stand-up with the team - 30 min',
      'Support asking: Helped support with a failed callback - 25 min',
      'Beta:',
      'Gamma: Fixed quote - premium mismatch - 1 hr 20 min',
      '',
      'Thanks',
    ].join('\n'),
  },
  {
    id: 'quoted',
    label: 'Quoted mail below',
    text: [
      'Alpha: Pairing session on the importer - 45 min',
      'Sent from my phone',
      '',
      'On Thu, Oct 22, 2026 at 5:30 PM Reporter <reporter@example.com> wrote:',
      '> Meetings: this quoted line must be ignored - 40 min',
    ].join('\n'),
  },
  {
    id: 'malformed',
    label: 'Malformed lines',
    text: [
      'Alpha: Reviewed importer edge cases - 35 min',
      'Had a call with the vendor 30 min',
      'Gamma: fixed the export',
      'Acme: something - 10 min',
    ].join('\n'),
  },
];

function sentence(s: string): string {
  const t = s.trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
}

@Component({
  selector: 'app-daily-report-demo',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    DEMO_STYLES,
    `
      .panel { display: grid; gap: 14px; align-content: start; min-width: 0; padding: 16px; border: 1px solid var(--line); border-radius: var(--r-md); background: var(--bg-2); }
      .panel > h3 { margin: 0; font-size: 0.74rem; font-family: var(--font-mono); letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-3); font-weight: 500; }
      .form { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); }
      .crow { display: grid; grid-template-columns: 112px minmax(0, 1fr) auto; gap: 8px; align-items: center; }
      .crow input { width: 100%; min-height: 44px; padding: 8px 12px; border: 1px solid var(--line-2); border-radius: var(--r-sm); background: var(--surface); color: var(--text); font: inherit; font-size: 0.9rem; }
      .crow input:focus-visible { outline: 2px solid var(--accent-text); outline-offset: 2px; }
      .iconbtn { min-width: 44px; padding: 0; }
      .warnbox { margin: 0; padding: 10px 12px; border-left: 3px solid var(--amber); background: color-mix(in srgb, var(--amber) 8%, transparent); border-radius: 0 var(--r-sm) var(--r-sm) 0; font-size: 0.84rem; color: var(--text-2); }
      .warnbox ul { margin: 6px 0 0; padding-left: 18px; }
      .okbox { border-left-color: var(--mint); background: color-mix(in srgb, var(--mint) 8%, transparent); }
      .tl { position: relative; height: 54px; border: 1px solid var(--line); border-radius: var(--r-sm); background: var(--bg-2); overflow: hidden; }
      .seg { position: absolute; top: 14px; height: 18px; border-radius: 4px; background: var(--surface-2); border: 1px solid var(--line-2); overflow: hidden; display: flex; justify-content: flex-end; }
      .seg .cnt { height: 100%; background: var(--accent-text); opacity: 0.85; }
      .seg .cap { height: 100%; flex: 1 1 auto; background: repeating-linear-gradient(135deg, color-mix(in srgb, var(--coral) 55%, transparent) 0 4px, transparent 4px 8px); }
      .tick { position: absolute; top: 8px; bottom: 6px; width: 2px; background: var(--text); opacity: 0.65; }
      .tl .lab { position: absolute; bottom: 3px; font-family: var(--font-mono); font-size: 0.62rem; color: var(--text-3); transform: translateX(-50%); }
      .legend { display: flex; flex-wrap: wrap; gap: 6px 16px; font-size: 0.78rem; color: var(--text-2); }
      .legend i { display: inline-block; width: 14px; height: 10px; margin-right: 6px; border-radius: 2px; vertical-align: middle; }
      .ruler { position: relative; height: 74px; border: 1px solid var(--line); border-radius: var(--r-sm); background: var(--bg-2); }
      .ruler .run { position: absolute; top: 34px; width: 2px; height: 10px; background: var(--line-2); }
      .ruler .run.past { background: var(--text-3); }
      .ruler .ev { position: absolute; top: 8px; transform: translateX(-50%); font-family: var(--font-mono); font-size: 0.64rem; text-align: center; white-space: nowrap; color: var(--text-2); }
      .ruler .ev b { display: block; width: 2px; height: 20px; margin: 2px auto 0; background: var(--accent-text); }
      .ruler .ev.f b { background: var(--amber); }
      .ruler .now { position: absolute; top: 28px; width: 14px; height: 14px; margin-left: -7px; border-radius: 50%; background: var(--lime); border: 2px solid var(--bg-2); transition: left .35s var(--ease-out); }
      .ruler .ax { position: absolute; bottom: 4px; font-family: var(--font-mono); font-size: 0.62rem; color: var(--text-3); transform: translateX(-50%); }
      .stage { margin: 0; padding: 12px 14px; border: 1px solid var(--accent-line); border-radius: var(--r-sm); background: var(--accent-soft); font-size: 0.9rem; }
      .backlog { margin: 0; padding: 0; list-style: none; display: grid; gap: 6px; }
      .backlog li { display: flex; flex-wrap: wrap; gap: 6px 10px; align-items: center; padding: 8px 10px; border: 1px solid var(--line); border-radius: var(--r-sm); background: var(--surface); font-size: 0.82rem; }
      .backlog .dates { font-family: var(--font-mono); font-size: 0.74rem; color: var(--text-2); }
      .rep { width: 100%; }
      .rep td, .rep th { white-space: normal; vertical-align: top; }
      .rep td.t { white-space: nowrap; }
      .rep tr.dt td { text-align: center; font-weight: 700; background: color-mix(in srgb, var(--sky) 18%, transparent); }
      .rep tr.tot td { font-weight: 700; }
      .rep td.pr { font-weight: 700; text-align: center; }
      pre.plain { margin: 0; padding: 12px; overflow: auto; border: 1px solid var(--line); border-radius: var(--r-sm); background: var(--bg-2); font-family: var(--font-mono); font-size: 0.76rem; line-height: 1.5; white-space: pre-wrap; color: var(--text-2); }
      details summary { cursor: pointer; min-height: 44px; display: flex; align-items: center; font-weight: 600; font-size: 0.9rem; }
      details summary:focus-visible { outline: 2px solid var(--accent-text); outline-offset: 2px; border-radius: var(--r-sm); }
      .chip { display: inline-flex; align-items: center; gap: 8px; min-height: 44px; padding: 0 14px; border: 1px solid var(--line-2); border-radius: var(--r-pill); cursor: pointer; font-size: 0.85rem; }
      .chip input { width: 18px; height: 18px; accent-color: var(--lime); }
      .chip:focus-within { outline: 2px solid var(--accent-text); outline-offset: 2px; }
      .tiny { font-size: 0.78rem; color: var(--text-3); margin: 0; }
      @media (max-width: 480px) { .crow { grid-template-columns: 96px minmax(0, 1fr) auto; } }
    `,
  ],
  template: `
    <div class="demo">
      <div class="demo__bar">
        <strong class="demo__title">Daily report automation, the logic</strong>
        <span class="demo__tag">Interactive &middot; runs in your browser</span>
      </div>

      <div class="demo__body">
        <div class="grid-2">
          <!-- ===== Inputs ===== -->
          <section class="panel" aria-labelledby="d-in">
            <h3 id="d-in">1. The reply you send</h3>
            <div class="row" role="group" aria-label="Sample replies">
              @for (s of samples; track s.id) {
                <button type="button" class="dbtn dbtn--sm" (click)="loadSample(s.id)">{{ s.label }}</button>
              }
            </div>
            <label class="field">
              <span>Reply text (one line per item: PROJECT: what you did - time | environment)</span>
              <textarea rows="8" [value]="reply()" #replyBox (input)="reply.set(replyBox.value)" spellcheck="false"></textarea>
            </label>
            <p class="tiny">Projects the parser knows: {{ projectNames }}. The key is matched at the start of the line, so "Meeting" and "Support asking" both work.</p>

            <h3>2. The day's commits (editable)</h3>
            <div class="col">
              @for (c of commitInputs(); track c.id; let i = $index) {
                <div class="crow">
                  <input type="time" [value]="c.time" #ct (change)="setCommit(i, 'time', ct.value)" [attr.aria-label]="'Commit ' + (i + 1) + ' time'" />
                  <input type="text" [value]="c.msg" #cm (change)="setCommit(i, 'msg', cm.value)" [attr.aria-label]="'Commit ' + (i + 1) + ' message'" />
                  <button type="button" class="dbtn dbtn--sm iconbtn" (click)="removeCommit(i)" [attr.aria-label]="'Remove commit ' + (i + 1)">&times;</button>
                </div>
              }
            </div>
            <div class="row">
              <button type="button" class="dbtn dbtn--sm" (click)="addCommit()">Add commit</button>
              <button type="button" class="dbtn dbtn--sm" (click)="resetCommits()">Reset</button>
            </div>
            <div class="form">
              <label class="field"><span>Day starts</span>
                <input type="time" [value]="dayStartText()" #ds (change)="setDayStart(ds.value)" /></label>
              <label class="field"><span>Gap cap (min)</span>
                <input type="number" min="1" step="5" [value]="cap()" #cp (change)="setCap(cp.value)" /></label>
            </div>
          </section>

          <!-- ===== Parse + estimate ===== -->
          <section class="panel" aria-labelledby="d-out">
            <h3 id="d-out">Parsed items (parseReply)</h3>
            <div class="row" aria-live="polite">
              <span class="pill {{ parsed().confirmed ? 'ok' : 'warn' }}">{{ parsed().confirmed ? 'confirmed' : 'not confirmed' }}</span>
              <span class="hint">{{ confirmText() }}</span>
            </div>
            @if (parsed().items.length) {
              <div class="tbl">
                <table>
                  <thead><tr><th>Project</th><th>Description</th><th>Time</th><th>Environment</th></tr></thead>
                  <tbody>
                    @for (it of parsed().items; track $index) {
                      <tr><td>{{ it.project }}</td><td style="white-space: normal">{{ it.description }}</td><td>{{ fmtMinutes(it.minutes) }}</td><td>{{ it.env }}</td></tr>
                    }
                  </tbody>
                </table>
              </div>
            } @else {
              <p class="hint">No items read from this reply.</p>
            }
            @if (parsed().unparsed.length) {
              <div class="warnbox" role="alert">
                <strong>{{ parsed().unparsed.length }} line{{ parsed().unparsed.length === 1 ? '' : 's' }} could not be read, so the report waits and you get one alert mail.</strong>
                <ul>
                  @for (u of parsed().unparsed; track $index) {
                    <li><code>{{ u }}</code>: {{ parsed().reasons[$index] }}</li>
                  }
                </ul>
              </div>
            }
            @if (parsed().quoted) {
              <p class="warnbox okbox">The quoted mail under your reply was cut off before parsing, so lines in it are ignored.</p>
            }
            @if (parsed().ignored.length) {
              <p class="tiny">Skipped lines: {{ parsed().ignored.join(' | ') }}</p>
            }

            <h3>Time per commit (estimateMinutes)</h3>
            <div class="tl" role="img" [attr.aria-label]="timelineLabel()">
              @for (s of segments(); track s.id) {
                <div class="seg" [style.left.%]="s.left" [style.width.%]="s.width">
                  <span class="cap" [style.display]="s.capped ? 'block' : 'none'"></span>
                  <span class="cnt" [style.width.%]="s.countedPct"></span>
                </div>
                <span class="tick" [style.left.%]="s.tick"></span>
              }
              <span class="lab" style="left: 2%">{{ dayStartText() }}</span>
              <span class="lab" style="left: 96%">{{ lastCommitText() }}</span>
            </div>
            <div class="legend">
              <span><i style="background: var(--accent-text)"></i>counted</span>
              <span><i style="background: repeating-linear-gradient(135deg, color-mix(in srgb, var(--coral) 55%, transparent) 0 3px, transparent 3px 6px); border: 1px solid var(--line-2)"></i>over the {{ cap() }} min cap, not counted</span>
              <span><i style="background: var(--text); width: 2px"></i>commit</span>
            </div>
            <div class="tbl">
              <table>
                <thead><tr><th>Time</th><th>Commit</th><th>Gap</th><th>Counted</th></tr></thead>
                <tbody>
                  @for (c of estimated(); track c.sha) {
                    <tr>
                      <td>{{ hhmm(c.minute) }}</td>
                      <td style="white-space: normal">{{ c.subject }}</td>
                      <td>{{ c.gap }} min</td>
                      <td>{{ c.minutes }} min @if (c.capped) { <span class="pill warn">capped</span> }</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
            <p class="tiny">Total code time: {{ fmtMinutes(codeTotal()) }}. A commit before the day start counts 0, and there is deliberately no minimum for the day.</p>
          </section>
        </div>

        <!-- ===== Report ===== -->
        <section class="panel" aria-labelledby="d-rep">
          <h3 id="d-rep">3. The report</h3>
          <div class="row">
            <button type="button" class="dbtn dbtn--primary" (click)="showReport.set(true)">Generate report</button>
            @if (showReport()) { <button type="button" class="dbtn" (click)="showReport.set(false)">Hide</button> }
          </div>
          <p class="hint">In production an LLM rewrites the commit lines into plain language. Here a template stands in: commits are grouped by their "Area:" prefix and the messages are joined.
            The grouping, row building, rowspans, total and footer are the real logic.</p>
          @if (showReport()) {
            <div class="tbl" aria-live="polite">
              <table class="rep">
                <thead><tr><th>Sr. No</th><th>Project</th><th>Description</th><th>Environment</th><th>Time</th><th>Status</th></tr></thead>
                <tbody>
                  <tr class="dt"><td colspan="6">{{ reportDate }}</td></tr>
                  @for (r of reportRows(); track $index) {
                    <tr>
                      <td>{{ $index + 1 }}</td>
                      @if (r.span > 0) { <td class="pr" [attr.rowspan]="r.span">{{ r.project }}</td> }
                      <td>{{ r.description }}</td>
                      <td>{{ r.env }}</td>
                      <td class="t">{{ fmtMinutes(r.minutes) }}</td>
                      <td>{{ r.status }}</td>
                    </tr>
                  } @empty {
                    <tr><td colspan="6">No rows: add commits or items first.</td></tr>
                  }
                  <tr class="tot"><td colspan="4" style="text-align: center">TOTAL</td><td colspan="2">{{ fmtMinutes(reportTotal()) }}</td></tr>
                </tbody>
              </table>
            </div>
            <p class="tiny">{{ footer() }}</p>
            <details>
              <summary>Plain-text version (as mailed)</summary>
              <pre class="plain">{{ plainText() }}</pre>
            </details>
          }
        </section>

        <div class="grid-2">
          <!-- ===== Day timeline ===== -->
          <section class="panel" aria-labelledby="d-tl">
            <h3 id="d-tl">4. One evening, run by run</h3>
            <label class="field">
              <span>Clock (IST): {{ clockText() }}</span>
              <input type="range" min="0" [max]="runs.length - 1" step="1" [value]="clockIdx()" #clk (input)="clockIdx.set(+clk.value)"
                [attr.aria-valuetext]="clockText() + ', ' + stage().short" />
            </label>
            <div class="ruler" aria-hidden="true">
              @for (m of runs; track m) {
                <span class="run" [class.past]="m <= clockMinute()" [style.left.%]="pos(m)"></span>
              }
              <span class="ev" [style.left.%]="pos(askMin)">ask<b></b>{{ askText }}</span>
              <span class="ev f" [style.left.%]="pos(sendMin)">fallback<b></b>{{ sendText }}</span>
              <span class="now" [style.left.%]="pos(clockMinute())"></span>
              <span class="ax" style="left: 3%">17:00</span>
              <span class="ax" style="left: 50%">19:15</span>
              <span class="ax" style="left: 96%">21:30</span>
            </div>
            <label class="chip">
              <input type="checkbox" [checked]="replied()" #rp (change)="replied.set(rp.checked)" />
              Your reply is in the inbox (uses the reply text above)
            </label>
            <p class="stage" aria-live="polite"><strong>{{ stage().title }}</strong> {{ stage().detail }}</p>
            @if (stage().alert) {
              <p class="warnbox"><strong>{{ stage().alert }}</strong></p>
            }
            <p class="tiny">The script wakes every 30 minutes. Nothing is asked before {{ askText }}; the question lists the day's commits. The report goes out as soon as a readable reply arrives, or at the {{ sendText }} run regardless.</p>
          </section>

          <!-- ===== Backlog ===== -->
          <section class="panel" aria-labelledby="d-bl">
            <h3 id="d-bl">5. Missed days backlog</h3>
            <label class="field">
              <span>Days still unsent before today: {{ missed() }}</span>
              <input type="range" min="0" max="14" step="1" [value]="missed()" #ms (input)="missed.set(+ms.value)" />
            </label>
            <div class="form">
              <label class="field"><span>Max per run</span>
                <input type="number" min="1" max="20" step="1" [value]="maxPerRun()" #mp (change)="setMax(mp.value)" /></label>
              <label class="chip" style="align-self: end">
                <input type="checkbox" [checked]="outage()" #ou (change)="outage.set(ou.checked)" /> API credits exhausted
              </label>
            </div>
            <ul class="backlog" aria-live="polite" aria-label="Retry plan, oldest first">
              @for (b of backlog(); track b.run) {
                <li>
                  <span class="pill {{ b.blocked ? 'bad' : 'ok' }}">run {{ b.run }}</span>
                  <span class="dates">{{ b.dates }}</span>
                  <span>{{ b.note }}</span>
                </li>
              } @empty {
                <li>Nothing waiting: {{ missed() === 0 ? 'only today, which goes out at the evening run.' : '' }}</li>
              }
            </ul>
            @if (outage() && outageAlert(); as oa) {
              <p class="warnbox"><strong>One alert mail, then silence:</strong> {{ oa.subject }}. {{ oa.body }}</p>
            }
            <p class="tiny">The plan uses the real due-date function at 21:30 IST: days are sent oldest first, at most {{ maxPerRun() }} per run, so a long outage drains in order instead of flooding the inbox. If the API fails, the run stops at the oldest day.</p>
          </section>
        </div>
      </div>

      <p class="demo__note">
        Commits, replies, project names and dates are synthetic; nothing is read from GitHub, Gmail or a spreadsheet, and no LLM is called.
        The reply parser, commit-gap time estimate (capped), due-date and retry logic, row building and totals are ported from the real script and behave the same.
        Simplified: the LLM step is a template, the report is shown in the page instead of being mailed and appended to a sheet,
        and "now" is the slider. Project names are generic stand-ins for the real project list.
      </p>
    </div>
  `,
})
export class DailyReportDemoComponent {
  protected readonly samples = SAMPLES;
  protected readonly runs = RUN_MINUTES;
  protected readonly projectNames = EXTRA_PROJECTS.map((p) => p.name).join(', ');
  protected readonly reportDate = dateLabel(TODAY);
  protected readonly askMin = hmToMinutes(CFG.askAt);
  protected readonly sendMin = CFG.sendByHour * 60;
  protected readonly askText = CFG.askAt;
  protected readonly sendText = CFG.sendByHour + ':00';
  protected fmtMinutes = fmtMinutes;
  protected hhmm = hhmm;

  readonly reply = signal(SAMPLES[0]?.text ?? '');
  readonly commitInputs = signal<CommitInput[]>(COMMITS_SEED.map((c) => ({ ...c })));
  readonly dayStart = signal(DAY_START_DEFAULT);
  readonly cap = signal(CFG.gapCap);
  readonly showReport = signal(false);
  readonly clockIdx = signal(2);
  readonly replied = signal(true);
  readonly missed = signal(8);
  readonly maxPerRun = signal(CFG.maxPerRun);
  readonly outage = signal(false);

  private nextId = 100;

  readonly dayStartText = computed(() => hhmm(this.dayStart()));
  readonly parsed = computed(() => parseReply(this.reply()));
  readonly clockMinute = computed(() => RUN_MINUTES[this.clockIdx()] as number);
  readonly clockText = computed(() => hhmm(this.clockMinute()));

  readonly confirmText = computed(() => {
    const p = this.parsed();
    if (p.confirmed) return 'The reply counts as the complete answer, so the report can go out.';
    if (p.unparsed.length) return 'An unreadable line holds the report, so work is never dropped silently.';
    return 'No items and no "none" or "send": this is not an answer yet.';
  });

  /** Commits with real estimateMinutes_ applied (sorted by time, as the script sorts by commit date). */
  readonly estimated = computed(() => {
    const sorted = this.commitInputs()
      .map((c, i) => ({ c, i }))
      .filter((x) => /^\d{1,2}:\d{2}$/.test(x.c.time))
      .map((x) => ({
        sha: ('0000000' + ((((x.c.id + 1) * 2654435761) >>> 0).toString(16))).slice(-7),
        subject: x.c.msg.trim() || '(no message)',
        minute: hmToMinutes(x.c.time),
        minutes: 0,
      }))
      .sort((a, b) => a.minute - b.minute);
    const start = this.dayStart();
    const raw: number[] = [];
    let prev = start;
    sorted.forEach((c) => {
      raw.push(c.minute - prev);
      prev = Math.max(prev, c.minute);
    });
    estimateMinutes(sorted, start, this.cap());
    return sorted.map((c, i) => ({ ...c, gap: Math.max(0, raw[i] as number), capped: (raw[i] as number) > this.cap() }));
  });

  readonly codeTotal = computed(() => totalMinutes(this.estimated()));

  readonly lastCommitText = computed(() => {
    const e = this.estimated();
    return e.length ? hhmm(Math.max(this.dayStart(), (e[e.length - 1] as { minute: number }).minute)) : '';
  });

  readonly segments = computed(() => {
    const e = this.estimated();
    const start = this.dayStart();
    const last = e.length ? Math.max(start, (e[e.length - 1] as { minute: number }).minute) : start;
    const range = Math.max(1, last - start);
    let prev = start;
    return e.map((c) => {
      const from = Math.max(prev, start);
      const to = Math.max(from, c.minute);
      prev = Math.max(prev, c.minute);
      const width = ((to - from) / range) * 94;
      const left = 2 + ((from - start) / range) * 94;
      return {
        id: c.sha,
        left,
        width,
        tick: 2 + ((to - start) / range) * 94,
        capped: c.capped,
        countedPct: c.gap > 0 ? (c.minutes / c.gap) * 100 : 0,
      };
    });
  });

  readonly timelineLabel = computed(() => {
    const e = this.estimated();
    return 'Timeline of ' + e.length + ' commits from ' + this.dayStartText() + ': ' + e.map((c) => hhmm(c.minute) + ' counted ' + c.minutes + ' min').join(', ');
  });

  readonly cfgRow = { project: 'Core Platform', areaPrefix: 'Platform' };

  readonly rows = computed(() => {
    const commits: Commit[] = this.estimated().map((c) => ({ sha: c.sha, subject: c.subject, minute: c.minute, minutes: c.minutes }));
    // Template stand-in for the LLM: group commits by their "Area:" prefix.
    const groups: Record<string, { area: string; msgs: string[]; shas: string[] }> = {};
    const order: string[] = [];
    commits.forEach((c) => {
      const colon = c.subject.indexOf(':');
      const area = colon > 0 && colon < 24 ? c.subject.slice(0, colon).trim() : '';
      const msg = colon > 0 && colon < 24 ? c.subject.slice(colon + 1).trim() : c.subject;
      const key = area.toLowerCase();
      if (!groups[key]) {
        groups[key] = { area, msgs: [], shas: [] };
        order.push(key);
      }
      (groups[key] as { msgs: string[]; shas: string[] }).msgs.push(msg);
      (groups[key] as { msgs: string[]; shas: string[] }).shas.push(c.sha);
    });
    const items: CodeItem[] = order.map((k) => {
      const g = groups[k] as { area: string; msgs: string[]; shas: string[] };
      return { area: g.area, description: g.msgs.map(sentence).join('; ') + '.', commits: g.shas };
    });
    const codeRows = buildRows(items, commits, this.cfgRow);
    const extra: Row[] = this.parsed().items.map((it) => ({ ...it, first: 1440 }));
    return codeRows.concat(extra);
  });

  readonly reportTotal = computed(() => totalMinutes(this.rows()));

  readonly reportRows = computed(() => {
    const rows = this.rows();
    const spans = projectSpans(rows);
    return rows.map((r, i) => ({ ...r, span: spans[i] as number }));
  });

  readonly footer = computed(() => footerNote(this.cap(), this.parsed().confirmed));

  readonly plainText = computed(() => {
    const rows = this.rows();
    const lines = [dateLabel(TODAY)];
    rows.forEach((r, i) => {
      lines.push(i + 1 + '. [' + r.project + '] ' + r.description + ' | ' + r.env + ' | ' + fmtMinutes(r.minutes) + ' | ' + r.status);
    });
    lines.push('TOTAL: ' + fmtMinutes(totalMinutes(rows)));
    lines.push('', this.footer());
    return lines.join('\n');
  });

  /** What the 30-minute trigger decides at the chosen time (runDaily, today only). */
  readonly stage = computed(() => {
    const m = this.clockMinute();
    const now = new Date(TODAY + 'T' + hhmm(m) + ':00+05:30');
    const ans = this.replied() ? this.parsed() : { items: [], unparsed: [] as string[], confirmed: false };
    const last = addDays(TODAY, -1);
    const due = dueDates(last, now, CFG.sendByHour, CFG.maxPerRun);
    if (due.indexOf(TODAY) < 0 && TODAY > last && ans.confirmed) due.push(TODAY);
    const sent = due.indexOf(TODAY) >= 0;
    const asked = m >= this.askMin;
    const alert = this.replied() && asked && ans.unparsed.length ? alertText('unparsed', TODAY, ans.unparsed.join(' / ')).subject : '';
    const hh = hhmm(m);
    if (!asked) return { short: 'idle', title: hh + ' idle.', detail: 'Before ' + CFG.askAt + ' nothing is asked and nothing is sent.', alert };
    if (sent && ans.confirmed && m < this.sendMin) {
      return { short: 'sent early', title: hh + ' report sent early.', detail: 'A readable reply is in, so today goes out at this run instead of waiting for ' + this.sendText + '.', alert };
    }
    if (sent) {
      return {
        short: 'fallback',
        title: hh + ' fallback send.',
        detail: ans.confirmed
          ? 'The reply was complete, so the report is out.'
          : 'The send-by hour has passed without a usable reply, so the report goes out anyway with what git shows, and its footer says the other items were not confirmed.',
        alert,
      };
    }
    return {
      short: 'waiting',
      title: hh + ' question mail sent, waiting.',
      detail: this.replied() && ans.unparsed.length
        ? 'Your reply has lines the parser cannot read, so the report waits for a corrected reply (or for ' + this.sendText + ').'
        : 'The mail listing today\'s commits went out at ' + CFG.askAt + '. Reply from any device; the report is sent at the next run after a readable reply, or at ' + this.sendText + ' regardless.',
      alert,
    };
  });

  /** Oldest-first drain of the backlog with the real dueDates_, run after run. */
  readonly backlog = computed(() => {
    const now = new Date(TODAY + 'T21:30:00+05:30');
    const max = this.maxPerRun();
    let last = addDays(TODAY, -(this.missed() + 1));
    const out: { run: number; dates: string; note: string; blocked: boolean }[] = [];
    if (this.outage()) {
      const due = dueDates(last, now, CFG.sendByHour, max);
      if (due.length) {
        for (let r = 1; r <= 3; r++) {
          out.push({ run: r, dates: dateLabel(due[0] as string), note: 'API call fails; stops at the oldest day, later days wait their turn.', blocked: true });
        }
        out.push({ run: 4, dates: 'after top-up', note: 'Credits are back: the backlog drains oldest first, ' + max + ' per run.', blocked: false });
      }
      return out;
    }
    for (let run = 1; run <= 12; run++) {
      const due = dueDates(last, now, CFG.sendByHour, max);
      if (!due.length) break;
      out.push({
        run,
        dates: due.map((d) => dateLabel(d).slice(0, 6)).join(', '),
        note: due.length + ' day' + (due.length === 1 ? '' : 's') + ' sent' + (due.includes(TODAY) ? ' (includes today)' : ''),
        blocked: false,
      });
      last = due[due.length - 1] as string;
    }
    return out;
  });

  readonly outageAlert = computed(() => {
    const due = dueDates(addDays(TODAY, -(this.missed() + 1)), new Date(TODAY + 'T21:30:00+05:30'), CFG.sendByHour, this.maxPerRun());
    return due.length ? alertText('credits', due[0] as string, '') : null;
  });

  /* ---------------- helpers & handlers ---------------- */

  protected pos(m: number): number {
    return 3 + ((m - TL_START) / (TL_END - TL_START)) * 93;
  }

  loadSample(id: string): void {
    const s = SAMPLES.find((x) => x.id === id);
    if (s) this.reply.set(s.text);
  }

  setCommit(i: number, field: 'time' | 'msg', v: string): void {
    this.commitInputs.update((l) => l.map((c, k) => (k === i ? { ...c, [field]: v } : c)));
  }

  addCommit(): void {
    const l = this.commitInputs();
    const lastMin = l.length ? Math.max(...l.map((c) => (/^\d{1,2}:\d{2}$/.test(c.time) ? hmToMinutes(c.time) : 0))) : DAY_START_DEFAULT;
    this.commitInputs.set([...l, { id: ++this.nextId, time: hhmm(Math.min(1439, lastMin + 25)), msg: 'Area: describe the change' }]);
  }

  removeCommit(i: number): void {
    this.commitInputs.update((l) => l.filter((_, k) => k !== i));
  }

  resetCommits(): void {
    this.commitInputs.set(COMMITS_SEED.map((c) => ({ ...c })));
    this.dayStart.set(DAY_START_DEFAULT);
    this.cap.set(CFG.gapCap);
  }

  setDayStart(v: string): void {
    if (/^\d{1,2}:\d{2}$/.test(v)) this.dayStart.set(hmToMinutes(v));
  }

  setCap(v: string): void {
    const n = Math.round(parseFloat(v));
    if (Number.isFinite(n) && n > 0) this.cap.set(n);
  }

  setMax(v: string): void {
    const n = Math.round(parseFloat(v));
    if (Number.isFinite(n) && n > 0) this.maxPerRun.set(Math.min(20, n));
  }
}
