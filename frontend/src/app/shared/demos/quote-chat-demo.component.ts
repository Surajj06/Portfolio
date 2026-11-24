import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, ViewChild, computed, inject, signal } from '@angular/core';
import { DeviceService } from '../../services/device.service';
import { DEMO_STYLES } from './demo-styles';
import { ratio, tokenSetRatio, tokenSortRatio } from './fuzzy';

/** Same step order as the real chat state machine (the two previous-policy steps are skipped when the answer is "no"). */
type StepId = 'rto' | 'make' | 'model' | 'variant' | 'reg' | 'policy' | 'prev' | 'expiry' | 'claim' | 'purchase' | 'confirm' | 'processing' | 'results';
type FormVal = string | number | null;
type QForm = Record<string, FormVal>;

interface Opt {
  label: string;
  value: string;
  sub?: string;
}
interface Ui {
  options: Opt[];
  placeholder: string;
  input: boolean;
}
interface Seg {
  t: string;
  b: boolean;
}
interface Msg {
  id: number;
  from: 'bot' | 'user';
  segs: Seg[];
}
interface Snap {
  step: StepId;
  form: QForm;
  msgCount: number;
  ui: Ui;
}
interface Resp {
  accepted: boolean;
  msgs: string[];
  ui: Ui;
  next?: StepId;
  patch?: QForm;
  clear?: string[];
}
interface PayloadLine {
  key: string;
  text: string;
  set: boolean;
  derived: boolean;
}
interface Partner {
  name: string;
  state: 'wait' | 'run' | 'ok' | 'err';
  p1?: number;
  p2?: number;
  p3?: number;
}
type Resolve =
  | { kind: 'exact'; value: string }
  | { kind: 'auto'; value: string; score: number }
  | { kind: 'ask'; cands: { name: string; score: number }[] }
  | { kind: 'none' };

interface Variant {
  variant: string;
  fuel: string;
  cc: number;
}
interface Rto {
  code: string;
  city: string;
}

const ORDER: StepId[] = ['rto', 'make', 'model', 'variant', 'reg', 'policy', 'prev', 'expiry', 'claim', 'purchase', 'confirm'];
const TOTAL = ORDER.length;

const FORM_KEYS = [
  'rto_code',
  'rto_city',
  'make',
  'model',
  'variant',
  'fuel_type',
  'cc',
  'registration_number',
  'policy_type',
  'has_previous_policy',
  'prev_policy_expiry',
  'prev_claim',
  'purchase_date',
];

/** Synthetic reference data (invented subset; real codes, made-up details). */
const RTOS: Rto[] = [
  { code: 'GJ-01', city: 'Ahmedabad' },
  { code: 'GJ-05', city: 'Surat' },
  { code: 'GJ-06', city: 'Vadodara' },
  { code: 'MH-02', city: 'Mumbai (West)' },
  { code: 'MH-12', city: 'Pune' },
  { code: 'MH-14', city: 'Pimpri Chinchwad' },
  { code: 'DL-01', city: 'Delhi (North)' },
  { code: 'DL-08', city: 'Delhi (South West)' },
  { code: 'KA-01', city: 'Bangalore (East)' },
  { code: 'KA-05', city: 'Bangalore (Central)' },
  { code: 'KA-09', city: 'Mysuru' },
  { code: 'TN-01', city: 'Chennai (North)' },
  { code: 'TN-14', city: 'Coimbatore' },
];

const VEHICLES: Record<string, Record<string, Variant[]>> = {
  HONDA: {
    ACTIVA: [
      { variant: 'STD DRUM', fuel: 'PETROL', cc: 109 },
      { variant: 'DLX ALLOY', fuel: 'PETROL', cc: 109 },
    ],
    SHINE: [
      { variant: 'DRUM', fuel: 'PETROL', cc: 124 },
      { variant: 'DISC', fuel: 'PETROL', cc: 124 },
    ],
    UNICORN: [{ variant: 'STD', fuel: 'PETROL', cc: 162 }],
  },
  TVS: {
    JUPITER: [
      { variant: 'STD', fuel: 'PETROL', cc: 110 },
      { variant: 'ZX DISC', fuel: 'PETROL', cc: 110 },
    ],
    'APACHE RTR 160': [
      { variant: 'DRUM', fuel: 'PETROL', cc: 159 },
      { variant: 'DISC', fuel: 'PETROL', cc: 159 },
    ],
    IQUBE: [{ variant: 'STANDARD', fuel: 'ELECTRIC', cc: 0 }],
  },
  HERO: {
    'SPLENDOR PLUS': [
      { variant: 'KICK ALLOY', fuel: 'PETROL', cc: 97 },
      { variant: 'I3S', fuel: 'PETROL', cc: 97 },
    ],
    'XPULSE 200': [{ variant: 'STD', fuel: 'PETROL', cc: 199 }],
  },
  YAMAHA: {
    'FZ-S': [{ variant: 'FI V3', fuel: 'PETROL', cc: 149 }],
    R15: [
      { variant: 'V3', fuel: 'PETROL', cc: 155 },
      { variant: 'V4', fuel: 'PETROL', cc: 155 },
    ],
  },
  'ROYAL ENFIELD': {
    'CLASSIC 350': [
      { variant: 'SINGLE CHANNEL', fuel: 'PETROL', cc: 349 },
      { variant: 'DUAL CHANNEL', fuel: 'PETROL', cc: 349 },
    ],
    'HUNTER 350': [{ variant: 'RETRO', fuel: 'PETROL', cc: 349 }],
    'METEOR 350': [{ variant: 'FIREBALL', fuel: 'PETROL', cc: 349 }],
  },
  SUZUKI: {
    'ACCESS 125': [
      { variant: 'STD', fuel: 'PETROL', cc: 124 },
      { variant: 'SPECIAL EDITION', fuel: 'PETROL', cc: 124 },
    ],
    GIXXER: [{ variant: 'SF', fuel: 'PETROL', cc: 155 }],
  },
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const START_RTO_OPTS: Opt[] = RTOS.slice(0, 13).map((r) => ({ label: r.code + ' — ' + r.city, value: r.code }));
const EMPTY_UI: Ui = { options: [], placeholder: '', input: false };

const toSegs = (text: string): Seg[] =>
  text
    .split('**')
    .map((t, i) => ({ t, b: i % 2 === 1 }))
    .filter((s) => s.t.length > 0);

const pad2 = (n: number): string => String(n).padStart(2, '0');
const dmy = (d: Date): string => pad2(d.getDate()) + '/' + pad2(d.getMonth() + 1) + '/' + d.getFullYear();
const daysFromNow = (n: number): Date => new Date(Date.now() + n * 86400000);

/** Same accepted formats and 2000-2035 year window as the real parser; returns "DD Mon YYYY". */
function parseDate(input: string): string | null {
  const text = input.trim();
  const tries: Array<[RegExp, 'dmy' | 'ymd']> = [
    [/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, 'dmy'],
    [/^(\d{1,2})-(\d{1,2})-(\d{4})$/, 'dmy'],
    [/^(\d{4})-(\d{1,2})-(\d{1,2})$/, 'ymd'],
    [/^(\d{1,2}) (\d{1,2}) (\d{4})$/, 'dmy'],
    [/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/, 'dmy'],
    [/^(\d{1,2})-(\d{1,2})-(\d{2})$/, 'dmy'],
  ];
  for (const [re, order] of tries) {
    const m = re.exec(text);
    if (!m) continue;
    let y = order === 'dmy' ? +m[3] : +m[1];
    const mo = +m[2];
    const d = order === 'dmy' ? +m[1] : +m[3];
    if (y < 100) y += 2000;
    if (y < 2000 || y > 2035) continue;
    const dt = new Date(y, mo - 1, d);
    if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) continue;
    return pad2(d) + ' ' + MONTHS[mo - 1] + ' ' + y;
  }
  return null;
}
function fromDisplay(s: string): Date | null {
  const m = /^(\d{2}) (\w{3}) (\d{4})$/.exec(s);
  if (!m) return null;
  const mi = MONTHS.indexOf(m[2]);
  return mi < 0 ? null : new Date(+m[3], mi, +m[1]);
}
/** Indian digit grouping without relying on Intl. */
function rupees(n: number): string {
  const s = String(Math.round(n));
  if (s.length <= 3) return '₹' + s;
  const last3 = s.slice(-3);
  const rest = s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return '₹' + rest + ',' + last3;
}

let uid = 0;

@Component({
  selector: 'app-quote-chat-demo',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="demo" aria-label="Interactive conversational quote assistant demo">
      <div class="demo__bar">
        <strong class="demo__title">Quote assistant: a chat that builds one JSON request</strong>
        <span class="demo__tag">Interactive &middot; runs in your browser</span>
      </div>

      <div class="demo__body">
        <p class="hint">
          Answer by tapping a chip or typing. Try a typo like <em>&ldquo;banglore&rdquo;</em> or <em>&ldquo;hunda&rdquo;</em>, a loose model name like
          <em>&ldquo;350&rdquo;</em>, or a bad date, and watch the payload on the right fill in field by field.
        </p>

        <div class="grid-2">
          <div class="col">
            <div class="phone">
              <div class="phone__head">
                <span class="avatar" aria-hidden="true">Q</span>
                <div class="phone__who">
                  <strong>Quote assistant</strong>
                  <small>Two-wheeler cover &middot; demo</small>
                </div>
              </div>
              <ol class="msgs" role="log" aria-live="polite" aria-label="Conversation" #msgs>
                @for (m of messages(); track m.id) {
                  <li class="msg" [class.msg--user]="m.from === 'user'">
                    <span class="msg__body">
                      @for (s of m.segs; track $index) {
                        @if (s.b) {
                          <strong>{{ s.t }}</strong>
                        } @else {
                          {{ s.t }}
                        }
                      }
                    </span>
                  </li>
                }
                @if (typing()) {
                  <li class="msg typing">
                    <span class="sr-only">The assistant is typing</span>
                    <span class="dot" aria-hidden="true"></span><span class="dot" aria-hidden="true"></span><span class="dot" aria-hidden="true"></span>
                  </li>
                }
                @if (partners().length) {
                  <li class="msg msg--cards" aria-label="Partner quotes">
                    <div class="plist">
                      @for (p of partners(); track p.name) {
                        <div class="pcard" [class.pcard--err]="p.state === 'err'" [class.pcard--ok]="p.state === 'ok'">
                          <div class="pcard__top">
                            <strong>{{ p.name }}</strong>
                            @switch (p.state) {
                              @case ('wait') {
                                <span class="pill mute">queued</span>
                              }
                              @case ('run') {
                                <span class="pill info">fetching quote</span>
                              }
                              @case ('ok') {
                                <span class="pill ok">quote ready</span>
                              }
                              @default {
                                <span class="pill bad">unavailable</span>
                              }
                            }
                          </div>
                          @if (p.state === 'ok') {
                            <div class="pcard__prices">
                              <span><small>1 yr</small>{{ money(p.p1) }}</span>
                              <span><small>2 yr</small>{{ money(p.p2) }}</span>
                              <span><small>3 yr</small>{{ money(p.p3) }}</span>
                            </div>
                          }
                          @if (p.state === 'err') {
                            <p class="pcard__err">Request timed out. This partner is skipped; the others are unaffected.</p>
                          }
                        </div>
                      }
                    </div>
                    @if (summary()) {
                      <p class="pcard__sum" role="status">{{ summary() }}</p>
                    }
                  </li>
                }
              </ol>

              @if (ui().options.length && !busy()) {
                <div class="chips" role="group" aria-label="Suggested answers">
                  @for (o of ui().options; track o.value) {
                    <button type="button" class="dbtn dbtn--sm chip" (click)="choose(o)">
                      <span>{{ o.label }}</span>
                      @if (o.sub) {
                        <small>{{ o.sub }}</small>
                      }
                    </button>
                  }
                </div>
              }

              <form class="composer" (submit)="onSubmit($event)">
                <label class="sr-only" [attr.for]="inputId">Your answer</label>
                <input
                  [id]="inputId"
                  type="text"
                  name="answer"
                  autocomplete="off"
                  maxlength="60"
                  [placeholder]="ui().input ? ui().placeholder : 'Waiting for the assistant'"
                  [value]="draft()"
                  [disabled]="busy() || !ui().input"
                  (input)="onDraft($event)" />
                <button type="submit" class="dbtn dbtn--primary" [disabled]="busy() || !ui().input || !draft().trim()">Send</button>
              </form>
            </div>
            <div class="row">
              <button type="button" class="dbtn dbtn--sm" [disabled]="busy() || !canUndo()" (click)="undo()">Undo last answer</button>
              <button type="button" class="dbtn dbtn--sm" (click)="restart()">Restart</button>
            </div>
          </div>

          <div class="col">
            <div class="prog" aria-live="polite">
              <div class="prog__row">
                <strong>Step {{ stepNo() }} of {{ total }}</strong>
                <span class="pill" [class.ok]="stepNo() === total" [class.info]="stepNo() < total">{{ stepName() }}</span>
              </div>
              <div class="prog__track" role="progressbar" aria-label="Conversation progress" aria-valuemin="1" [attr.aria-valuemax]="total" [attr.aria-valuenow]="stepNo()">
                <div class="prog__fill" [style.transform]="progressTransform()"></div>
              </div>
            </div>

            <div class="json" role="region" aria-label="Live request payload">
              <div class="json__head">
                <span>Live payload</span>
                <span class="pill mute">built field by field</span>
              </div>
              <div class="json__body">
                <div class="json__brace">{{ '{' }}</div>
                @for (l of payloadLines(); track l.key) {
                  <div class="json__line" [class.json__line--set]="l.set" [class.json__line--flash]="isFlash(l.key)" [class.json__line--derived]="l.derived">
                    <span class="json__k">"{{ l.key }}"</span>: <span class="json__v">{{ l.text }}</span>
                  </div>
                }
                <div class="json__brace">{{ '}' }}</div>
              </div>
              <p class="hint hint--small">
                The first group is the chat's own form data. Lines in the second group are derived from it before the quote request goes out (policy kind, lapse
                status, break-in flag).
              </p>
            </div>
          </div>
        </div>
      </div>

      <p class="demo__note">
        Everything here is synthetic: the vehicle list, locations, partners (&ldquo;Partner A/B/C&rdquo;) and premiums are invented and illustrative, and
        Partner B is made to fail on purpose to show that one failing partner call does not stop the others. Simplified: the real assistant runs as a
        server-side session with a larger reference dataset and live partner calls, and its progress bar counts 11 steps; the fuzzy &ldquo;did you
        mean&rdquo; matching and the soft registration-format hint are added for this demo, while the date parsing and step flow follow the real logic.
      </p>
    </section>
  `,
  styles: [
    DEMO_STYLES,
    `
      .hint--small { font-size: 0.78rem; color: var(--text-3); }
      .phone { display: grid; grid-template-rows: auto 1fr auto auto; border: 1px solid var(--line-2); border-radius: 24px; background: var(--bg-2); overflow: hidden; max-width: 440px; width: 100%; margin-inline: auto; }
      .phone__head { display: flex; align-items: center; gap: 12px; padding: 12px 16px; background: var(--surface-2); border-bottom: 1px solid var(--line); }
      .avatar { display: grid; place-items: center; width: 36px; height: 36px; border-radius: 50%; background: var(--accent-soft); border: 1px solid var(--accent-line); color: var(--accent-text); font-weight: 700; }
      .phone__who { display: grid; line-height: 1.25; }
      .phone__who small { color: var(--text-3); font-size: 0.74rem; }

      .msgs { margin: 0; padding: 14px 12px; list-style: none; display: flex; flex-direction: column; gap: 8px; height: 420px; overflow-y: auto; overscroll-behavior: contain; }
      .msg { max-width: 86%; align-self: flex-start; padding: 9px 13px; border-radius: 16px 16px 16px 4px; background: var(--surface-2); border: 1px solid var(--line);
        font-size: 0.9rem; line-height: 1.45; white-space: pre-line; overflow-wrap: anywhere; animation: pop .3s var(--ease-out); }
      .msg--user { align-self: flex-end; border-radius: 16px 16px 4px 16px; background: var(--accent-soft); border-color: var(--accent-line); }
      .msg--cards { max-width: 100%; width: 100%; padding: 0; background: transparent; border: 0; white-space: normal; }
      .typing { display: inline-flex; gap: 5px; align-items: center; padding: 12px 14px; }
      .dot { width: 7px; height: 7px; border-radius: 50%; background: var(--text-3); animation: bounce 1s ease-in-out infinite; }
      .dot:nth-child(3) { animation-delay: .15s; }
      .dot:nth-child(4) { animation-delay: .3s; }
      @keyframes bounce { 0%, 80%, 100% { transform: translateY(0); opacity: .5; } 40% { transform: translateY(-5px); opacity: 1; } }
      @keyframes pop { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }

      .chips { display: flex; flex-wrap: wrap; gap: 6px; padding: 8px 12px; border-top: 1px solid var(--line); max-height: 168px; overflow-y: auto; }
      .chip { flex-direction: column; align-items: flex-start; gap: 0; height: auto; min-height: 44px; padding: 6px 14px; text-align: left; }
      .chip small { font-size: 0.68rem; font-weight: 400; color: var(--text-3); }
      .composer { display: flex; gap: 8px; padding: 10px 12px; border-top: 1px solid var(--line); background: var(--surface-2); }
      .composer input { flex: 1 1 auto; min-width: 0; min-height: 44px; padding: 8px 14px; border: 1px solid var(--line-2); border-radius: var(--r-pill); background: var(--bg-2); color: var(--text); font: inherit; font-size: 0.95rem; }
      .composer input:focus-visible { outline: 2px solid var(--accent-text); outline-offset: 2px; }
      .composer input:disabled { opacity: .55; }

      .plist { display: grid; gap: 8px; }
      .pcard { padding: 10px 12px; border: 1px solid var(--line-2); border-radius: var(--r-md); background: var(--surface); display: grid; gap: 6px; transition: border-color .3s ease, background-color .3s ease; }
      .pcard--ok { border-color: color-mix(in srgb, var(--mint) 45%, transparent); }
      .pcard--err { border-color: color-mix(in srgb, var(--coral) 55%, transparent); }
      .pcard__top { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
      .pcard__prices { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; font-variant-numeric: tabular-nums; font-weight: 600; }
      .pcard__prices small { display: block; font-family: var(--font-mono); font-size: 0.62rem; letter-spacing: .08em; text-transform: uppercase; color: var(--text-3); font-weight: 400; }
      .pcard__err { margin: 0; font-size: 0.8rem; color: var(--text-2); }
      .pcard__sum { margin: 8px 0 0; font-size: 0.82rem; color: var(--text-2); }

      .prog { display: grid; gap: 8px; padding: 12px 14px; border: 1px solid var(--line); border-radius: var(--r-sm); background: var(--bg-2); }
      .prog__row { display: flex; justify-content: space-between; gap: 10px; align-items: center; flex-wrap: wrap; }
      .prog__track { height: 8px; border-radius: 999px; background: var(--line); overflow: hidden; }
      .prog__fill { height: 100%; background: var(--lime); transform-origin: left center; transform: scaleX(0); transition: transform .5s var(--ease-out); }

      .json { border: 1px solid var(--line); border-radius: var(--r-sm); background: var(--bg-2); overflow: hidden; }
      .json__head { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 10px 14px; border-bottom: 1px solid var(--line); background: var(--surface-2);
        font-family: var(--font-mono); font-size: 0.68rem; letter-spacing: .08em; text-transform: uppercase; color: var(--text-3); }
      .json__body { padding: 10px 14px; font-family: var(--font-mono); font-size: 0.78rem; line-height: 1.7; overflow-x: auto; }
      .json__brace { color: var(--text-3); }
      .json__line { padding: 0 8px; margin-inline: -8px; border-radius: 4px; white-space: nowrap; color: var(--text-3); }
      .json__line--set .json__k { color: var(--accent-text); }
      .json__line--set .json__v { color: var(--text); }
      .json__line--derived { border-left: 2px solid var(--line-2); }
      .json__line--flash { animation: flash 1.4s ease-out; }
      @keyframes flash { 0% { background: color-mix(in srgb, var(--lime) 38%, transparent); } 100% { background: transparent; } }
    `,
  ],
})
export class QuoteChatDemoComponent {
  private readonly device = inject(DeviceService);
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();
  @ViewChild('msgs') private msgsEl?: ElementRef<HTMLElement>;

  readonly total = TOTAL;
  readonly inputId = 'qc-answer-' + ++uid;

  readonly messages = signal<Msg[]>([]);
  readonly form = signal<QForm>(this.emptyForm());
  readonly step = signal<StepId>('rto');
  readonly ui = signal<Ui>(EMPTY_UI);
  readonly typing = signal(false);
  readonly busy = signal(false);
  readonly draft = signal('');
  readonly partners = signal<Partner[]>([]);
  readonly summary = signal('');
  readonly flash = signal<string[]>([]);
  readonly undoStack = signal<Snap[]>([]);

  readonly canUndo = computed(() => this.undoStack().length > 0);
  readonly stepNo = computed(() => {
    const i = ORDER.indexOf(this.step());
    return i < 0 ? TOTAL : i + 1;
  });
  readonly stepName = computed(() => {
    const names: Record<string, string> = {
      rto: 'RTO location',
      make: 'Make',
      model: 'Model',
      variant: 'Variant',
      reg: 'Registration number',
      policy: 'Policy type',
      prev: 'Previous policy?',
      expiry: 'Previous policy expiry',
      claim: 'Previous claim?',
      purchase: 'Purchase date',
      confirm: 'Confirm',
      processing: 'Fetching quotes',
      results: 'Results',
    };
    return names[this.step()] ?? '';
  });
  readonly progressTransform = computed(() => 'scaleX(' + (this.stepNo() / TOTAL).toFixed(3) + ')');
  readonly payloadLines = computed<PayloadLine[]>(() => {
    const f = this.form();
    const lines: PayloadLine[] = FORM_KEYS.map((k) => ({
      key: k,
      text: f[k] === null || f[k] === undefined ? 'null' : JSON.stringify(f[k]) + ',',
      set: f[k] !== null && f[k] !== undefined,
      derived: false,
    }));
    if (f['purchase_date'] !== null) {
      const hasPrev = f['has_previous_policy'] === 'yes';
      const exp = typeof f['prev_policy_expiry'] === 'string' ? fromDisplay(f['prev_policy_expiry']) : null;
      const status = !hasPrev ? '' : this.expiryStatus(exp);
      const breaking = !hasPrev || status === 'ExpiredBeyond90Days';
      const year = typeof f['purchase_date'] === 'string' ? +f['purchase_date'].slice(-4) : null;
      const derived: Array<[string, string]> = [
        ['PolicyType', JSON.stringify(hasPrev ? 'Renewal' : 'New')],
        ['PrevPolicyExpiryStatus', JSON.stringify(status)],
        ['IsBreakingCase', String(breaking)],
        ['IsThirdPartyOnly', String(f['policy_type'] === 'ThirdParty')],
        ['RegistrationYear', String(year)],
      ];
      for (const [k, v] of derived) lines.push({ key: k, text: v, set: true, derived: true });
    }
    return lines;
  });

  private nextId = 1;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.clearTimers());
    this.initialState();
  }

  // ---------- template helpers ----------
  isFlash(key: string): boolean {
    return this.flash().includes(key);
  }
  money(n: number | undefined): string {
    return n === undefined ? '' : rupees(n);
  }
  onDraft(ev: Event): void {
    this.draft.set((ev.target as HTMLInputElement).value);
  }
  onSubmit(ev: Event): void {
    ev.preventDefault();
    this.submit(this.draft(), null);
  }
  choose(o: Opt): void {
    this.submit(o.value, o.label);
  }

  // ---------- lifecycle ----------
  private emptyForm(): QForm {
    const f: QForm = {};
    for (const k of FORM_KEYS) f[k] = null;
    return f;
  }

  private initialState(): void {
    this.messages.set([
      { id: this.nextId++, from: 'bot', segs: toSegs('Welcome! I will help you get a **two-wheeler** insurance quote.') },
      { id: this.nextId++, from: 'bot', segs: toSegs("Let's start. Type or tap your **RTO location** (a code like GJ-01 or a city name):") },
    ]);
    this.ui.set({ options: START_RTO_OPTS, placeholder: 'RTO code or city, e.g. ban', input: true });
  }

  restart(): void {
    this.clearTimers();
    this.busy.set(false);
    this.typing.set(false);
    this.form.set(this.emptyForm());
    this.step.set('rto');
    this.partners.set([]);
    this.summary.set('');
    this.flash.set([]);
    this.undoStack.set([]);
    this.draft.set('');
    this.messages.set([]);
    this.ui.set(EMPTY_UI);
    this.deliver(
      ['Welcome back! Starting a fresh **two-wheeler** quote.', "Let's start. Type or tap your **RTO location**:"],
      { options: START_RTO_OPTS, placeholder: 'RTO code or city, e.g. ban', input: true },
    );
  }

  undo(): void {
    if (this.busy()) return;
    const stack = this.undoStack();
    const snap = stack[stack.length - 1];
    if (!snap) return;
    this.undoStack.set(stack.slice(0, -1));
    this.form.set(snap.form);
    this.step.set(snap.step);
    this.messages.update((m) => m.slice(0, snap.msgCount));
    this.ui.set(snap.ui);
    this.partners.set([]);
    this.summary.set('');
    this.flash.set([]);
    this.draft.set('');
    this.scroll();
  }

  // ---------- one user answer ----------
  private submit(value: string, label: string | null): void {
    const text = value.trim();
    if (!text || this.busy() || !this.ui().input) return;
    const snap: Snap = { step: this.step(), form: this.form(), msgCount: this.messages().length, ui: this.ui() };
    this.draft.set('');
    this.messages.update((m) => [...m, { id: this.nextId++, from: 'user', segs: [{ t: label ?? text, b: false }] }]);

    const r = this.handle(this.step(), text);
    if (r.accepted) {
      this.undoStack.update((s) => [...s, snap]);
      const patch = r.patch ?? {};
      const before = this.form();
      const next: QForm = { ...before, ...patch };
      for (const k of r.clear ?? []) next[k] = null;
      this.form.set(next);
      const keys = Object.keys(patch);
      if ('purchase_date' in patch) keys.push('PolicyType', 'PrevPolicyExpiryStatus', 'IsBreakingCase', 'IsThirdPartyOnly', 'RegistrationYear');
      this.flash.set(keys);
      this.later(() => this.flash.set([]), 1600);
      if (r.next) this.step.set(r.next);
    }
    const after = r.accepted && r.next === 'processing' ? () => this.runQuotes() : undefined;
    this.deliver(r.msgs, r.ui, after);
  }

  // ---------- step handlers (order, prompts and validators follow the real state machine) ----------
  private handle(step: StepId, input: string): Resp {
    switch (step) {
      case 'rto':
        return this.hRto(input);
      case 'make':
        return this.hMake(input);
      case 'model':
        return this.hModel(input);
      case 'variant':
        return this.hVariant(input);
      case 'reg':
        return this.hReg(input);
      case 'policy':
        return this.hPolicy(input);
      case 'prev':
        return this.hPrev(input);
      case 'expiry':
        return this.hExpiry(input);
      case 'claim':
        return this.hClaim(input);
      case 'purchase':
        return this.hPurchase(input);
      case 'confirm':
        return this.hConfirm(input);
      default:
        return { accepted: false, msgs: ['Quotes are ready. Tap **New quote** to start again.'], ui: this.resultsUi() };
    }
  }

  private rtoUi(extra?: Opt[]): Ui {
    return { options: extra ?? START_RTO_OPTS, placeholder: 'RTO code or city', input: true };
  }
  private hRto(inp: string): Resp {
    const q = inp.trim();
    let rto = RTOS.find((r) => r.code === q.toUpperCase());
    if (!rto) {
      const lq = q.toLowerCase();
      const hits = RTOS.filter((r) => r.code.toLowerCase().includes(lq) || r.city.toLowerCase().includes(lq)).slice(0, 15);
      if (hits.length === 1) rto = hits[0];
      else if (hits.length > 1) {
        return {
          accepted: false,
          msgs: ['Found **' + hits.length + '** matches. Select one:'],
          ui: this.rtoUi(hits.map((r) => ({ label: r.code + ' — ' + r.city, value: r.code }))),
        };
      } else {
        const cands = RTOS.map((r) => ({ r, score: this.score(q, r.city) }))
          .filter((c) => c.score >= 70)
          .sort((a, b) => b.score - a.score)
          .slice(0, 4);
        if (cands.length) {
          return {
            accepted: false,
            msgs: ['No exact match for "' + q + '". Did you mean one of these?'],
            ui: this.rtoUi(cands.map((c) => ({ label: c.r.code + ' — ' + c.r.city, value: c.r.code, sub: 'similarity ' + c.score + '%' }))),
          };
        }
        return { accepted: false, msgs: ['RTO not found. Try a valid code (e.g. GJ-01) or city name:'], ui: this.rtoUi() };
      }
    }
    return {
      accepted: true,
      msgs: ['RTO: **' + rto.code + ' — ' + rto.city + '**', 'Select the **manufacturer**:'],
      ui: this.makeUi(),
      next: 'make',
      patch: { rto_code: rto.code, rto_city: rto.city },
    };
  }

  private makeUi(): Ui {
    return { options: Object.keys(VEHICLES).map((m) => ({ label: m, value: m })), placeholder: 'Manufacturer, e.g. Honda', input: true };
  }
  private hMake(inp: string): Resp {
    const pool = Object.keys(VEHICLES);
    const r = this.resolve(inp, pool);
    if (r.kind === 'exact' || r.kind === 'auto') {
      const make = r.value;
      return {
        accepted: true,
        msgs: [...this.autoNote(r, inp), 'Make: **' + make + '**', 'Select the **' + make + '** model:'],
        ui: this.modelUi(make),
        next: 'model',
        patch: { make },
        clear: ['model', 'variant', 'fuel_type', 'cc'],
      };
    }
    return this.reprompt(r, inp, pool, 'manufacturer', this.makeUi());
  }

  private modelUi(make: string): Ui {
    return { options: Object.keys(VEHICLES[make] ?? {}).map((m) => ({ label: m, value: m })), placeholder: 'Model', input: true };
  }
  private hModel(inp: string): Resp {
    const make = String(this.form()['make']);
    const pool = Object.keys(VEHICLES[make] ?? {});
    const r = this.resolve(inp, pool);
    if (r.kind === 'exact' || r.kind === 'auto') {
      const model = r.value;
      return {
        accepted: true,
        msgs: [...this.autoNote(r, inp), 'Model: **' + make + ' ' + model + '**', 'Select the **variant**:'],
        ui: this.variantUi(make, model),
        next: 'variant',
        patch: { model },
        clear: ['variant', 'fuel_type', 'cc'],
      };
    }
    return this.reprompt(r, inp, pool, 'model', this.modelUi(make));
  }

  private variantUi(make: string, model: string): Ui {
    const vs = VEHICLES[make]?.[model] ?? [];
    return {
      options: vs.map((v) => ({ label: v.variant + ' - ' + v.fuel, value: v.variant, sub: v.cc > 0 ? v.cc + ' CC | ' + v.fuel : v.fuel })),
      placeholder: 'Variant',
      input: true,
    };
  }
  private hVariant(inp: string): Resp {
    const make = String(this.form()['make']);
    const model = String(this.form()['model']);
    const vs = VEHICLES[make]?.[model] ?? [];
    const pool = vs.map((v) => v.variant);
    const cleaned = inp.replace(/\s*-\s*(PETROL|ELECTRIC|DIESEL|CNG)\s*$/i, '');
    const r = this.resolve(cleaned, pool);
    if (r.kind === 'exact' || r.kind === 'auto') {
      const v = vs.find((x) => x.variant === r.value);
      if (v) {
        return {
          accepted: true,
          msgs: [
            ...this.autoNote(r, inp),
            'Variant: **' + v.variant + ' - ' + v.fuel + '**',
            'Enter the **registration number** (e.g. ' + this.form()['rto_code'] + '-AB-1234):',
          ],
          ui: this.regUi(),
          next: 'reg',
          patch: { variant: v.variant, fuel_type: v.fuel, cc: v.cc },
        };
      }
    }
    return this.reprompt(r, inp, pool, 'variant', this.variantUi(make, model));
  }

  private regUi(): Ui {
    const rto = String(this.form()['rto_code'] ?? 'GJ-01');
    return { options: [{ label: 'Use sample ' + rto + '-AB-1234', value: rto + '-AB-1234' }], placeholder: rto + '-XX-0000', input: true };
  }
  private hReg(inp: string): Resp {
    const cleaned = inp.toUpperCase().replace(/ /g, '-').trim();
    if (cleaned.length < 4) {
      return {
        accepted: false,
        msgs: ['Please enter a valid registration number (e.g. GJ-01-AB-1234):'],
        ui: this.regUi(),
      };
    }
    const odd = !/^[A-Z]{2}-?\d{1,2}-?[A-Z]{1,3}-?\d{1,4}$/.test(cleaned);
    const msgs = ['Registration: **' + cleaned + '**'];
    if (odd) msgs.push('(Accepted. It does not match the usual XX-00-AB-0000 pattern, but the real flow allows a flexible format.)');
    msgs.push('What type of **insurance policy** do you need?');
    return {
      accepted: true,
      msgs,
      ui: {
        options: [
          { label: 'Comprehensive', value: 'Comprehensive', sub: 'OD + Third Party' },
          { label: 'Third Party Only', value: 'ThirdParty', sub: 'Mandatory TP liability only' },
        ],
        placeholder: 'comprehensive or third party',
        input: true,
      },
      next: 'policy',
      patch: { registration_number: cleaned },
    };
  }

  private policyUi(): Ui {
    return {
      options: [
        { label: 'Comprehensive', value: 'Comprehensive', sub: 'OD + Third Party' },
        { label: 'Third Party Only', value: 'ThirdParty', sub: 'Mandatory TP liability only' },
      ],
      placeholder: 'comprehensive or third party',
      input: true,
    };
  }
  private hPolicy(inp: string): Resp {
    const l = inp.toLowerCase();
    const value = inp === 'Comprehensive' || /compre/.test(l) ? 'Comprehensive' : inp === 'ThirdParty' || /third|\btp\b/.test(l) ? 'ThirdParty' : null;
    if (!value) return { accepted: false, msgs: ['Select a valid policy type:'], ui: this.policyUi() };
    return {
      accepted: true,
      msgs: ['Policy: **' + (value === 'Comprehensive' ? 'Comprehensive' : 'Third Party Only') + '**', 'Do you have an **existing / previous policy**?'],
      ui: this.yesNoUi('Yes, I have a previous policy', 'No, this is a new policy'),
      next: 'prev',
      patch: { policy_type: value },
    };
  }

  private yesNoUi(yes: string, no: string): Ui {
    return { options: [{ label: yes, value: 'yes' }, { label: no, value: 'no' }], placeholder: 'yes or no', input: true };
  }
  private yn(inp: string): 'yes' | 'no' | null {
    const l = inp.trim().toLowerCase();
    if (['yes', 'y', 'haan', 'han', 'ha'].includes(l)) return 'yes';
    if (['no', 'n', 'nahi', 'nahin', 'na'].includes(l)) return 'no';
    return null;
  }
  private dateUi(kind: 'expiry' | 'purchase'): Ui {
    const opts: Opt[] =
      kind === 'expiry'
        ? [
            { label: 'Expired 2 weeks ago', value: dmy(daysFromNow(-14)), sub: dmy(daysFromNow(-14)) },
            { label: 'Expired 8 months ago', value: dmy(daysFromNow(-240)), sub: dmy(daysFromNow(-240)) },
            { label: 'Expires in a month', value: dmy(daysFromNow(30)), sub: dmy(daysFromNow(30)) },
          ]
        : [
            { label: 'About 2 years ago', value: dmy(daysFromNow(-730)), sub: dmy(daysFromNow(-730)) },
            { label: 'About 6 years ago', value: dmy(daysFromNow(-2190)), sub: dmy(daysFromNow(-2190)) },
          ];
    return { options: opts, placeholder: 'DD/MM/YYYY', input: true };
  }
  private hPrev(inp: string): Resp {
    const a = this.yn(inp);
    if (!a) return { accepted: false, msgs: ['Select yes or no:'], ui: this.yesNoUi('Yes', 'No') };
    if (a === 'yes') {
      return {
        accepted: true,
        msgs: ['Previous policy: **Yes**', 'When does/did it **expire**? (DD/MM/YYYY):'],
        ui: this.dateUi('expiry'),
        next: 'expiry',
        patch: { has_previous_policy: 'yes' },
      };
    }
    return {
      accepted: true,
      msgs: ['Previous policy: **No (new)**', 'When was the vehicle **purchased**? (DD/MM/YYYY):'],
      ui: this.dateUi('purchase'),
      next: 'purchase',
      patch: { has_previous_policy: 'no' },
      clear: ['prev_policy_expiry', 'prev_claim'],
    };
  }
  private hExpiry(inp: string): Resp {
    const parsed = parseDate(inp);
    if (!parsed) return { accepted: false, msgs: ['Invalid date. Use **DD/MM/YYYY** (e.g. 15/06/2025):'], ui: this.dateUi('expiry') };
    const status = this.expiryStatus(fromDisplay(parsed));
    const note =
      status === 'ExpiredBeyond90Days'
        ? 'That lapse is longer than 90 days, so this will be treated as a **break-in** case.'
        : status === 'ExpiredWithin90Days'
          ? 'Lapsed under 90 days ago, so this stays a normal renewal.'
          : 'Not expired yet, so this is a normal renewal.';
    return {
      accepted: true,
      msgs: ['Expiry: **' + parsed + '**', note, 'Any **claim** in the previous policy?'],
      ui: this.yesNoUi('Yes, I made a claim', 'No claims'),
      next: 'claim',
      patch: { prev_policy_expiry: parsed },
    };
  }
  private hClaim(inp: string): Resp {
    const a = this.yn(inp);
    if (!a) return { accepted: false, msgs: ['Select yes or no:'], ui: this.yesNoUi('Yes', 'No') };
    return {
      accepted: true,
      msgs: ['Claim: **' + (a === 'yes' ? 'Yes' : 'No') + '**', 'Vehicle **purchase date**? (DD/MM/YYYY):'],
      ui: this.dateUi('purchase'),
      next: 'purchase',
      patch: { prev_claim: a },
    };
  }
  private hPurchase(inp: string): Resp {
    const parsed = parseDate(inp);
    if (!parsed) return { accepted: false, msgs: ['Invalid date. Use **DD/MM/YYYY** (e.g. 01/11/2020):'], ui: this.dateUi('purchase') };
    const f = { ...this.form(), purchase_date: parsed };
    return {
      accepted: true,
      msgs: ['Purchase: **' + parsed + '**', '**Quotation summary**\n' + this.summaryText(f), '**Confirm** to check eligible partners and fetch quotes:'],
      ui: {
        options: [
          { label: 'Confirm & get quotes', value: 'confirm' },
          { label: 'Start over', value: 'restart' },
        ],
        placeholder: 'confirm or restart',
        input: true,
      },
      next: 'confirm',
      patch: { purchase_date: parsed },
    };
  }
  private hConfirm(inp: string): Resp {
    const l = inp.trim().toLowerCase();
    if (l === 'restart' || l === 'start over') {
      // handled after the user bubble, so the transcript reads naturally
      this.later(() => this.restart(), 0);
      return { accepted: false, msgs: [], ui: EMPTY_UI };
    }
    if (l !== 'confirm' && l !== 'yes' && l !== 'y') {
      return {
        accepted: false,
        msgs: ['Confirm or restart:'],
        ui: { options: [{ label: 'Confirm', value: 'confirm' }, { label: 'Restart', value: 'restart' }], placeholder: 'confirm or restart', input: true },
      };
    }
    return {
      accepted: true,
      msgs: ['Checking which partners can quote this two-wheeler...'],
      ui: EMPTY_UI,
      next: 'processing',
    };
  }

  private summaryText(f: QForm): string {
    const lines = [
      'RTO: ' + f['rto_code'] + ' — ' + f['rto_city'],
      'Make: ' + f['make'],
      'Model: ' + f['model'],
      'Variant: ' + f['variant'] + ' - ' + f['fuel_type'],
      'Reg no: ' + f['registration_number'],
      'Policy: ' + (f['policy_type'] === 'Comprehensive' ? 'Comprehensive' : 'Third Party Only'),
    ];
    if (f['has_previous_policy'] === 'yes') {
      lines.push('Previous policy: Yes');
      if (f['prev_policy_expiry']) lines.push('Expiry: ' + f['prev_policy_expiry']);
      lines.push('Claim: ' + (f['prev_claim'] === 'yes' ? 'Yes' : 'No'));
    } else {
      lines.push('Previous policy: No (new)');
    }
    lines.push('Purchase: ' + f['purchase_date']);
    return lines.join('\n');
  }

  // ---------- fuzzy vehicle / location search ----------
  private score(q: string, target: string): number {
    const a = q.toLowerCase().trim();
    const b = target.toLowerCase().replace(/[()]/g, '');
    const toks = b.split(/\s+/).filter(Boolean);
    let s = Math.max(ratio(a, b), tokenSortRatio(a, b), tokenSetRatio(a, b));
    if (toks.length > 1) for (const t of toks) s = Math.max(s, ratio(a, t) * 0.97);
    return Math.round(s);
  }
  private resolve(input: string, pool: string[]): Resolve {
    const q = input.trim().toUpperCase().replace(/\s+/g, ' ');
    const exact = pool.find((p) => p === q);
    if (exact) return { kind: 'exact', value: exact };
    const ranked = pool
      .map((name) => ({ name, score: this.score(q, name) }))
      .filter((c) => c.score >= 60)
      .sort((a, b) => b.score - a.score);
    if (!ranked.length) return { kind: 'none' };
    const [top, second] = ranked;
    if (top.score >= 88 && (!second || top.score - second.score >= 8)) return { kind: 'auto', value: top.name, score: top.score };
    return { kind: 'ask', cands: ranked.slice(0, 4) };
  }
  private autoNote(r: Resolve, input: string): string[] {
    return r.kind === 'auto' ? ['Matched "' + input.trim() + '" to **' + r.value + '** (similarity ' + r.score + '%).'] : [];
  }
  private reprompt(r: Resolve, input: string, pool: string[], what: string, full: Ui): Resp {
    if (r.kind === 'ask') {
      const sorted = r.cands;
      return {
        accepted: false,
        msgs: [
          sorted.length === 1
            ? 'No exact ' + what + ' called "' + input.trim() + '". Did you mean **' + sorted[0].name + '**?'
            : '"' + input.trim() + '" could be more than one ' + what + '. Did you mean:',
        ],
        ui: { options: sorted.map((c) => ({ label: c.name, value: c.name, sub: 'similarity ' + c.score + '%' })), placeholder: what, input: true },
      };
    }
    void pool;
    return { accepted: false, msgs: ["'" + input.trim() + "' not found. Select from the list:"], ui: full };
  }

  private expiryStatus(exp: Date | null): string {
    if (!exp) return '';
    const days = Math.floor((Date.now() - exp.getTime()) / 86400000);
    if (exp.getTime() > Date.now()) return 'NotExpired';
    return days <= 90 ? 'ExpiredWithin90Days' : 'ExpiredBeyond90Days';
  }

  // ---------- partner check and per-partner quotes (each call isolated) ----------
  private resultsUi(): Ui {
    return { options: [{ label: 'New quote', value: 'restart' }], placeholder: 'Chat finished', input: false };
  }

  private premium(factor: number): { p1: number; p2: number; p3: number } {
    const f = this.form();
    const cc = Number(f['cc'] ?? 0);
    const tpBase = cc === 0 ? 457 : cc <= 150 ? 714 : cc <= 350 ? 1366 : 2804;
    let od = 0;
    if (f['policy_type'] === 'Comprehensive') {
      const base = cc === 0 ? 900 : cc <= 150 ? 1100 : cc <= 350 ? 1800 : 3200;
      const year = typeof f['purchase_date'] === 'string' ? +f['purchase_date'].slice(-4) : new Date().getFullYear();
      const age = Math.max(0, new Date().getFullYear() - year);
      od = base * (1 - Math.min(0.5, age * 0.06));
      const exp = typeof f['prev_policy_expiry'] === 'string' ? fromDisplay(f['prev_policy_expiry']) : null;
      if (f['has_previous_policy'] === 'yes') {
        if (f['prev_claim'] === 'yes') od *= 1.15;
        else od *= 0.85;
        if (this.expiryStatus(exp) === 'ExpiredBeyond90Days') od *= 1.1;
      }
    }
    const p1 = (tpBase + od) * factor;
    return { p1, p2: p1 * 1.9, p3: p1 * 2.75 };
  }

  private runQuotes(): void {
    const names = ['Partner A', 'Partner B', 'Partner C'];
    const factors = [0.97, 1, 1.05];
    const fails = [false, true, false];
    this.partners.set(names.map((name) => ({ name, state: 'wait' })));
    this.summary.set('');
    this.busy.set(true);
    this.scroll();
    const set = (i: number, patch: Partial<Partner>): void => this.partners.update((ps) => ps.map((p, j) => (j === i ? { ...p, ...patch } : p)));
    const finish = (): void => {
      const f = this.form();
      const ps = [...this.partners()].sort((a, b) => (a.state === 'err' ? 1 : 0) - (b.state === 'err' ? 1 : 0) || (a.p1 ?? 0) - (b.p1 ?? 0));
      this.partners.set(ps);
      const ok = ps.filter((p) => p.state === 'ok').length;
      const bad = ps.length - ok;
      const kind =
        f['has_previous_policy'] !== 'yes' ? 'New policy' : this.expiryStatus(typeof f['prev_policy_expiry'] === 'string' ? fromDisplay(f['prev_policy_expiry']) : null) === 'ExpiredBeyond90Days' ? 'Break-in (lapsed over 90 days)' : 'Renewal';
      this.summary.set(ok + ' partner quotes, sorted by 1-year premium. Quote type: ' + kind + '. ' + bad + ' partner had errors (may load later). Illustrative numbers.');
      this.busy.set(false);
      this.step.set('results');
      this.messages.update((m) => [
        ...m,
        { id: this.nextId++, from: 'bot', segs: toSegs('**' + ok + ' of ' + ps.length + '** partners returned a quote. ' + bad + ' had errors, shown above and skipped.') },
      ]);
      this.ui.set(this.resultsUi());
      this.scroll();
    };

    if (this.device.reducedMotion) {
      names.forEach((_, i) => (fails[i] ? set(i, { state: 'err' }) : set(i, { state: 'ok', ...this.premium(factors[i]) })));
      this.messages.update((m) => [...m, { id: this.nextId++, from: 'bot', segs: toSegs('**3 eligible partners.** Fetching a quote from each; one failing does not stop the others.') }]);
      finish();
      return;
    }

    this.later(() => {
      this.messages.update((m) => [...m, { id: this.nextId++, from: 'bot', segs: toSegs('**3 eligible partners.** Fetching a quote from each; one failing does not stop the others.') }]);
      this.scroll();
      let i = 0;
      const next = (): void => {
        if (i >= names.length) {
          finish();
          return;
        }
        const idx = i;
        set(idx, { state: 'run' });
        this.scroll();
        this.later(() => {
          if (fails[idx]) set(idx, { state: 'err' });
          else set(idx, { state: 'ok', ...this.premium(factors[idx]) });
          this.scroll();
          i++;
          this.later(next, 250);
        }, 800);
      };
      next();
    }, 900);
  }

  // ---------- bot message delivery with typing indicator ----------
  private deliver(msgs: string[], ui: Ui, after?: () => void): void {
    this.ui.set(EMPTY_UI);
    if (this.device.reducedMotion) {
      if (msgs.length) this.messages.update((m) => [...m, ...msgs.map((t) => ({ id: this.nextId++, from: 'bot' as const, segs: toSegs(t) }))]);
      this.ui.set(ui);
      this.scroll();
      after?.();
      return;
    }
    this.busy.set(true);
    const queue = [...msgs];
    const next = (): void => {
      const t = queue.shift();
      if (t === undefined) {
        this.typing.set(false);
        this.ui.set(ui);
        this.busy.set(false);
        this.scroll();
        after?.();
        return;
      }
      this.typing.set(true);
      this.scroll();
      this.later(() => {
        this.typing.set(false);
        this.messages.update((m) => [...m, { id: this.nextId++, from: 'bot', segs: toSegs(t) }]);
        this.scroll();
        this.later(next, 140);
      }, Math.min(950, 380 + t.length * 7));
    };
    next();
  }

  // ---------- plumbing ----------
  private scroll(): void {
    this.later(() => {
      const el = this.msgsEl?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    }, 30);
  }
  private later(fn: () => void, ms: number): void {
    const id = setTimeout(() => {
      this.timers.delete(id);
      fn();
    }, ms);
    this.timers.add(id);
  }
  private clearTimers(): void {
    for (const t of this.timers) clearTimeout(t);
    this.timers.clear();
  }
}
