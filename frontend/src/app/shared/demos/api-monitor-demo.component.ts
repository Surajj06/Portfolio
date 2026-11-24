import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { DeviceService } from '../../services/device.service';
import { DEMO_STYLES } from './demo-styles';

/* ------------------------------------------------------------------ */
/*  Port of the real health checker's rules (defaults from settings)  */
/* ------------------------------------------------------------------ */

type Status = 'UP' | 'SLOW' | 'DOWN' | 'ERROR';

/** Real defaults: MonitoringConfig. */
const DEFAULTS = {
  slowMs: 30000,
  timeoutS: 35,
  concurrency: 50,
  historyMax: 5,
  intervalS: 600,
};

/** Demo-only: how often the auto-run toggle fires (the real scheduler waits 10 minutes). */
const AUTO_SECONDS = 12;

/** HealthChecker._classify_status, exactly. */
function classifyStatus(code: number, ms: number, slowMs: number): { status: Status; rule: string } {
  if (code >= 500 && code < 600) return { status: 'DOWN', rule: '5xx response (HTTP ' + code + ') -> DOWN' };
  if (code >= 400 && code < 500) return { status: 'ERROR', rule: '4xx response (HTTP ' + code + ') -> ERROR: reachable, but the call failed' };
  if (code >= 200 && code < 300) {
    if (ms > slowMs) return { status: 'SLOW', rule: '2xx but ' + Math.round(ms) + ' ms > ' + slowMs + ' ms threshold -> SLOW' };
    return { status: 'UP', rule: '2xx within ' + slowMs + ' ms -> UP' };
  }
  if (code >= 300 && code < 400) return { status: 'UP', rule: '3xx (HTTP ' + code + ') is still a valid response -> UP' };
  return { status: 'ERROR', rule: 'Unknown status code (HTTP ' + code + ') -> ERROR' };
}

/** timeout <= slow threshold  =>  timeout = slow threshold + 5 s (so a >30 s answer can still be SLOW). */
function effectiveTimeoutS(timeoutS: number, slowMs: number): number {
  const slowS = slowMs / 1000;
  return timeoutS <= slowS ? slowS + 5 : timeoutS;
}

type PlanKind = 'http' | 'timeout' | 'refused' | 'clienterr';

interface Plan {
  kind: PlanKind;
  code: number;
  latencyMs: number;
  jitter: boolean;
}

interface Result {
  status: Status;
  code: number | null;
  ms: number;
  rule: string;
  message: string;
  time: string;
}

interface Endpoint {
  id: number;
  name: string;
  group: 'TP' | 'COMP';
  base: number;
  plan: Plan;
  history: Result[];
}

type AlertKind = 'critical' | 'warning' | 'info' | 'suppressed' | 'norule';

interface AlertEntry {
  id: number;
  time: string;
  kind: AlertKind;
  api: string;
  text: string;
  channels: string[];
}

/** README alert table: UP/SLOW -> DOWN critical, DOWN -> UP info, UP -> SLOW warning. Same state: suppressed. */
function alertRule(prev: Status | null, cur: Status, name: string, failures: number): { kind: AlertKind; text: string } | null {
  if (prev === null) return null;
  if (prev === cur) {
    if (cur === 'UP') return null;
    return {
      kind: 'suppressed',
      text: name + ' is still ' + cur + ' (' + failures + ' in a row). State unchanged, so no alert is sent.',
    };
  }
  if ((prev === 'UP' || prev === 'SLOW') && cur === 'DOWN') return { kind: 'critical', text: "API '" + name + "' is now DOWN" };
  if (prev === 'DOWN' && cur === 'UP') return { kind: 'info', text: "API '" + name + "' has RECOVERED" };
  if (prev === 'UP' && cur === 'SLOW') return { kind: 'warning', text: "API '" + name + "' is experiencing SLOW responses" };
  return { kind: 'norule', text: name + ' changed ' + prev + ' -> ' + cur + '. Not in the alert table, so no alert is sent.' };
}

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

const OK_PLAN = (base: number): Plan => ({ kind: 'http', code: 200, latencyMs: base, jitter: true });

function resultFromPlan(plan: Plan, base: number, jitterRand: number, slowMs: number, timeoutS: number, time: string): Result {
  const timeoutMs = effectiveTimeoutS(timeoutS, slowMs) * 1000;
  if (plan.kind === 'timeout') {
    return {
      status: 'DOWN', code: null, ms: timeoutMs, time,
      rule: 'asyncio.TimeoutError -> DOWN',
      message: 'Request timed out after ' + timeoutMs / 1000 + 's',
    };
  }
  if (plan.kind === 'refused') {
    return {
      status: 'DOWN', code: null, ms: 40 + Math.round(jitterRand * 30), time,
      rule: 'ClientConnectorError -> DOWN',
      message: 'Connection error: cannot connect to host',
    };
  }
  if (plan.kind === 'clienterr') {
    return {
      status: 'ERROR', code: null, ms: 80 + Math.round(jitterRand * 60), time,
      rule: 'Other aiohttp ClientError -> ERROR',
      message: 'Client error: malformed response',
    };
  }
  const ms = Math.round(plan.jitter ? plan.latencyMs * (0.85 + jitterRand * 0.3) : plan.latencyMs);
  if (ms >= timeoutMs) {
    return {
      status: 'DOWN', code: null, ms: timeoutMs, time,
      rule: 'No answer within the ' + timeoutMs / 1000 + ' s timeout -> DOWN',
      message: 'Request timed out after ' + timeoutMs / 1000 + 's',
    };
  }
  const c = classifyStatus(plan.code, ms, slowMs);
  let message = '';
  if (c.status === 'DOWN') message = 'Server error (HTTP ' + plan.code + ')';
  else if (c.status === 'SLOW') message = 'Slow response (' + ms + 'ms > ' + slowMs + 'ms threshold)';
  else if (c.status === 'ERROR') message = 'Client error (HTTP ' + plan.code + ')';
  return { status: c.status, code: plan.code, ms, rule: c.rule, message, time };
}

function consecutiveFailures(h: Result[]): number {
  let n = 0;
  for (let i = h.length - 1; i >= 0; i--) {
    const s = (h[i] as Result).status;
    if (s === 'DOWN' || s === 'ERROR') n++;
    else break;
  }
  return n;
}

const SPARK_MIN = Math.log10(30);
const SPARK_MAX = Math.log10(50000);
function sparkY(ms: number): number {
  const v = (Math.log10(Math.max(30, Math.min(50000, ms))) - SPARK_MIN) / (SPARK_MAX - SPARK_MIN);
  return Math.round((26 - v * 24) * 10) / 10;
}

function fmtMs(ms: number): string {
  return ms >= 10000 ? (ms / 1000).toFixed(1) + ' s' : Math.round(ms) + ' ms';
}

function sliderToMs(v: number): number {
  return Math.round(50 * Math.pow(1000, v / 100));
}
function msToSlider(ms: number): number {
  return Math.round((100 * Math.log(Math.max(50, ms) / 50)) / Math.log(1000));
}

const BEHAVIOURS: { v: string; label: string }[] = [
  { v: '200', label: '200 OK' },
  { v: '301', label: '301 Redirect' },
  { v: '403', label: '403 Forbidden' },
  { v: '404', label: '404 Not Found' },
  { v: '500', label: '500 Server Error' },
  { v: '503', label: '503 Unavailable' },
  { v: 'timeout', label: 'Timeout (no response)' },
  { v: 'refused', label: 'Connection refused' },
  { v: 'clienterr', label: 'Client error (bad response)' },
];

function planFromForm(v: string, latency: number): Plan {
  if (v === 'timeout' || v === 'refused' || v === 'clienterr') return { kind: v, code: 0, latencyMs: latency, jitter: false };
  return { kind: 'http', code: parseInt(v, 10), latencyMs: latency, jitter: false };
}

function formFromPlan(p: Plan): string {
  return p.kind === 'http' ? String(p.code) : p.kind;
}

function seedEndpoints(): Endpoint[] {
  const rand = mulberry32(2024);
  const out: Endpoint[] = [];
  for (let i = 0; i < 24; i++) {
    const base = 90 + Math.round(rand() * 760);
    const ep: Endpoint = {
      id: i,
      name: 'Partner ' + String(i + 1).padStart(2, '0'),
      group: i < 12 ? 'TP' : 'COMP',
      base,
      plan: OK_PLAN(base),
      history: [],
    };
    // Two endpoints start unhealthy so the board is not all green.
    if (i === 8) ep.plan = { kind: 'http', code: 403, latencyMs: base, jitter: true };
    if (i === 13) ep.plan = { kind: 'http', code: 503, latencyMs: base, jitter: true };
    for (let k = 0; k < DEFAULTS.historyMax; k++) {
      const plan = i === 13 && k < 2 ? OK_PLAN(base) : ep.plan;
      ep.history.push(resultFromPlan(plan, base, rand(), DEFAULTS.slowMs, DEFAULTS.timeoutS, '--:--:--'));
    }
    out.push(ep);
  }
  return out;
}

@Component({
  selector: 'app-api-monitor-demo',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    DEMO_STYLES,
    `
      .panel { display: grid; gap: 14px; align-content: start; min-width: 0; padding: 16px; border: 1px solid var(--line); border-radius: var(--r-md); background: var(--bg-2); }
      .panel > h3 { margin: 0; font-size: 0.74rem; font-family: var(--font-mono); letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-3); font-weight: 500; }
      .board { display: grid; gap: 10px; grid-template-columns: repeat(auto-fill, minmax(148px, 1fr)); }
      .tile { display: grid; gap: 6px; text-align: left; min-height: 96px; padding: 10px 12px; border: 1px solid var(--line-2); border-radius: var(--r-sm); background: var(--surface); color: var(--text); font: inherit; cursor: pointer;
        transition: border-color .2s ease, background-color .2s ease, transform .3s var(--ease-out); }
      .tile:hover { border-color: var(--text-3); }
      .tile:focus-visible { outline: 2px solid var(--accent-text); outline-offset: 2px; }
      .tile[aria-pressed='true'] { border-color: var(--accent-line); background: var(--accent-soft); }
      .tile.s-UP { border-left: 4px solid var(--mint); }
      .tile.s-SLOW { border-left: 4px solid var(--amber); }
      .tile.s-DOWN { border-left: 4px solid var(--coral); }
      .tile.s-ERROR { border-left: 4px solid var(--violet); }
      .tile.checking { animation: pulse 0.9s ease-in-out infinite; }
      @keyframes pulse { 50% { background: var(--surface-2); } }
      .tile.flash { animation: flash .7s var(--ease-out); }
      @keyframes flash { 0% { transform: scale(1.04); } 100% { transform: scale(1); } }
      .tile header { display: flex; justify-content: space-between; gap: 6px; align-items: center; }
      .tile strong { font-size: 0.86rem; }
      .tile .lat { font-family: var(--font-mono); font-size: 0.74rem; color: var(--text-2); }
      .tile .grp { font-family: var(--font-mono); font-size: 0.62rem; color: var(--text-3); letter-spacing: 0.06em; }
      svg.spark { width: 100%; height: 26px; display: block; overflow: visible; }
      svg.spark polyline { fill: none; stroke: var(--text-3); stroke-width: 1.4; stroke-linejoin: round; }
      svg.spark circle { stroke: var(--bg-2); stroke-width: 1; }
      .d-UP { fill: var(--mint); } .d-SLOW { fill: var(--amber); } .d-DOWN { fill: var(--coral); } .d-ERROR { fill: var(--violet); }
      .pill.err { color: var(--violet); border-color: color-mix(in srgb, var(--violet) 45%, transparent); background: color-mix(in srgb, var(--violet) 10%, transparent); }
      .form { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); }
      .hist { margin: 0; padding: 0; list-style: none; display: grid; gap: 4px; font-family: var(--font-mono); font-size: 0.76rem; color: var(--text-2); }
      .hist li { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
      .rule { margin: 0; padding: 10px 12px; border-left: 3px solid var(--accent-line); background: var(--surface); border-radius: 0 var(--r-sm) var(--r-sm) 0; font-size: 0.85rem; color: var(--text-2); }
      .chip { display: inline-flex; align-items: center; gap: 8px; min-height: 44px; padding: 0 14px; border: 1px solid var(--line-2); border-radius: var(--r-pill); cursor: pointer; font-size: 0.85rem; }
      .chip input { width: 18px; height: 18px; accent-color: var(--lime); }
      .chip:focus-within { outline: 2px solid var(--accent-text); outline-offset: 2px; }
      .alerts { max-height: 280px; }
      .alerts li { flex-wrap: wrap; }
      .tiny { font-size: 0.78rem; color: var(--text-3); margin: 0; }
      @media (max-width: 420px) { .board { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    `,
  ],
  template: `
    <div class="demo">
      <div class="demo__bar">
        <strong class="demo__title">API health monitor, live board</strong>
        <span class="demo__tag">Interactive &middot; runs in your browser</span>
      </div>

      <div class="demo__body">
        <div class="kvs" aria-label="Summary">
          <div class="kv"><strong>{{ counts().UP }}</strong><span>UP</span></div>
          <div class="kv"><strong>{{ counts().SLOW }}</strong><span>SLOW</span></div>
          <div class="kv"><strong>{{ counts().DOWN }}</strong><span>DOWN</span></div>
          <div class="kv"><strong>{{ counts().ERROR }}</strong><span>ERROR</span></div>
          <div class="kv"><strong>{{ avgLatency() }}</strong><span>avg latency (latest)</span></div>
          <div class="kv"><strong>{{ uptime() }}</strong><span>uptime, last-5 window</span></div>
        </div>
        <p class="sr-only" aria-live="polite">{{ announce() }}</p>

        <div class="row">
          <button type="button" class="dbtn dbtn--primary" [disabled]="running()" (click)="runAll()">
            {{ running() ? 'Checking...' : 'Run check now' }}
          </button>
          <button type="button" class="dbtn" [attr.aria-pressed]="auto()" (click)="toggleAuto()">
            {{ auto() ? 'Auto-run on, next in ' + countdown() + ' s' : 'Auto-run' }}
          </button>
          <button type="button" class="dbtn" [disabled]="running()" (click)="injectOutage()">Inject outage</button>
          <button type="button" class="dbtn" [disabled]="running()" (click)="injectSlowdown()">Inject slowdown</button>
          <button type="button" class="dbtn" [disabled]="running()" (click)="healAll()">Heal everything</button>
        </div>
        <p class="tiny">Auto-run fires every {{ autoSeconds }} s here. The real scheduler waits {{ defaults.intervalS / 60 }} minutes between cycles.</p>

        <div class="board" role="group" aria-label="Endpoints. Select one to change how it behaves.">
          @for (t of tiles(); track t.id) {
            <button type="button" class="tile s-{{ t.status }}" [class.checking]="t.checking" [class.flash]="t.flash"
              [attr.aria-pressed]="t.selected" [attr.aria-label]="t.aria" (click)="select(t.id)">
              <header>
                <strong>{{ t.name }}</strong>
                <span class="grp">{{ t.group }}</span>
              </header>
              <span class="pill {{ t.pill }}">{{ t.checking ? 'checking' : t.status }}</span>
              <span class="lat">{{ t.lat }}</span>
              <svg class="spark" viewBox="0 0 100 28" preserveAspectRatio="none" aria-hidden="true">
                <polyline [attr.points]="t.line"></polyline>
                @for (d of t.dots; track $index) {
                  <circle [attr.cx]="d.x" [attr.cy]="d.y" r="2.6" [attr.class]="'d-' + d.status"></circle>
                }
              </svg>
            </button>
          }
        </div>

        <div class="grid-2">
          <section class="panel" aria-labelledby="m-sel">
            <h3 id="m-sel">Selected endpoint: {{ selectedEp().name }}</h3>
            <div class="form">
              <label class="field">
                <span>Make it respond with</span>
                <select #bSel (change)="formKind.set(bSel.value)">
                  @for (b of behaviours; track b.v) {
                    <option [value]="b.v" [selected]="b.v === formKind()">{{ b.label }}</option>
                  }
                </select>
              </label>
              <label class="field">
                <span>Latency: {{ latencyText() }}</span>
                <input type="range" min="0" max="100" step="1" [value]="formSlider()" #lat (input)="formSlider.set(+lat.value)"
                  [disabled]="formKind() === 'timeout' || formKind() === 'refused' || formKind() === 'clienterr'"
                  aria-label="Latency, logarithmic scale from 50 ms to 50 seconds" />
              </label>
            </div>
            <div class="row">
              <button type="button" class="dbtn dbtn--primary" [disabled]="running()" (click)="applyAndCheck()">Apply and check this endpoint</button>
            </div>
            <p class="rule" aria-live="polite"><strong>Rule that fired:</strong> {{ lastRule() }}</p>
            <ul class="hist" aria-label="Last results for this endpoint, oldest first">
              @for (r of selectedEp().history; track $index) {
                <li><span class="pill {{ pillFor(r.status) }}">{{ r.status }}</span>
                  <span>{{ r.code === null ? 'no response' : 'HTTP ' + r.code }}</span><span>{{ fmtMs(r.ms) }}</span><span>{{ r.time }}</span></li>
              }
            </ul>
            <p class="tiny">Consecutive failures (DOWN or ERROR) in this window: {{ failures() }}. Only the last {{ defaults.historyMax }} results are kept, like the real deque.</p>
          </section>

          <section class="panel" aria-labelledby="m-th">
            <h3 id="m-th">Thresholds (real defaults)</h3>
            <div class="form">
              <label class="field">
                <span>Slow threshold (ms)</span>
                <input type="number" min="1" step="100" [value]="slowMs()" #slow (change)="setNum('slow', slow.value)" />
              </label>
              <label class="field">
                <span>Request timeout (s)</span>
                <input type="number" min="1" step="1" [value]="timeoutS()" #tmo (change)="setNum('timeout', tmo.value)" />
              </label>
              <label class="field">
                <span>Concurrent limit</span>
                <input type="number" min="1" max="50" step="1" [value]="concurrency()" #cc (change)="setNum('conc', cc.value)" />
              </label>
            </div>
            <p class="hint">Effective timeout: <strong>{{ effTimeout() }} s</strong>. If the timeout is not above the slow threshold it is raised to slow + 5 s, so a very slow 2xx can still be classified SLOW.
              With a limit of {{ concurrency() }}, the {{ endpointCount }} checks run in {{ waves() }} wave{{ waves() === 1 ? '' : 's' }}.</p>
            <ul class="hist" aria-label="Classification rules">
              <li>5xx or timeout or connection error: DOWN</li>
              <li>4xx or other client error: ERROR</li>
              <li>2xx slower than threshold: SLOW</li>
              <li>2xx and 3xx within threshold: UP</li>
            </ul>
            <div class="row"><button type="button" class="dbtn dbtn--sm" (click)="restoreDefaults()">Restore defaults</button></div>
          </section>
        </div>

        <section class="panel" aria-labelledby="m-al">
          <h3 id="m-al">Alerts (fire on state change only)</h3>
          <div class="row" role="group" aria-label="Simulated alert channels">
            <span class="chip" style="cursor: default"><span class="pill ok">Console</span> always on</span>
            <label class="chip"><input type="checkbox" [checked]="chEmail()" #ce (change)="chEmail.set(ce.checked)" /> Email</label>
            <label class="chip"><input type="checkbox" [checked]="chSlack()" #cs (change)="chSlack.set(cs.checked)" /> Slack</label>
            <label class="chip"><input type="checkbox" [checked]="chTeams()" #ct (change)="chTeams.set(ct.checked)" /> Teams</label>
            <span class="pill mute">{{ suppressed() }} suppressed so far</span>
          </div>
          <ul class="log alerts" aria-live="polite" aria-label="Alert history, newest first">
            @for (a of alerts(); track a.id) {
              <li>
                <time>{{ a.time }}</time>
                <span class="pill {{ alertPill(a.kind) }}">{{ a.kind }}</span>
                <span>{{ a.text }}</span>
                @if (a.channels.length) { <span class="pill mute">sent: {{ a.channels.join(', ') }}</span> }
              </li>
            } @empty {
              <li>No alerts yet. Break an endpoint and run a check. Run it again to see the repeat get suppressed, then heal it to see RECOVERED.</li>
            }
          </ul>
        </section>
      </div>

      <p class="demo__note">
        All endpoints, latencies and results are synthetic ("Partner 01" and so on), generated in your browser; nothing is requested over the network.
        Classification (UP / SLOW / DOWN / ERROR), the timeout rule, the 5-result history and the default thresholds mirror the real checker.
        Alert rules follow the project's documented table. Simplified: checks are simulated rather than real HTTP calls,
        the real service has about 85 endpoints and posts alerts to real email, Slack and Teams channels (here they are only labelled),
        and the dashboard streams updates over SSE instead of re-rendering in place.
      </p>
    </div>
  `,
})
export class ApiMonitorDemoComponent {
  private readonly device = inject(DeviceService);

  protected readonly defaults = DEFAULTS;
  protected readonly autoSeconds = AUTO_SECONDS;
  protected readonly behaviours = BEHAVIOURS;
  protected readonly endpointCount = 24;
  protected fmtMs = fmtMs;

  readonly endpoints = signal<Endpoint[]>(seedEndpoints());
  readonly selectedId = signal(13);
  readonly formKind = signal('503');
  readonly formSlider = signal(msToSlider(300));
  readonly slowMs = signal(DEFAULTS.slowMs);
  readonly timeoutS = signal(DEFAULTS.timeoutS);
  readonly concurrency = signal(DEFAULTS.concurrency);
  readonly checking = signal<number[]>([]);
  readonly flashing = signal<number[]>([]);
  readonly running = signal(false);
  readonly auto = signal(false);
  readonly countdown = signal(AUTO_SECONDS);
  readonly alerts = signal<AlertEntry[]>([]);
  readonly suppressed = signal(0);
  readonly chEmail = signal(true);
  readonly chSlack = signal(true);
  readonly chTeams = signal(false);
  readonly announce = signal('');
  readonly lastRule = signal('Select an endpoint, choose a response, and run a check to see which rule classifies it.');

  private timers: ReturnType<typeof setTimeout>[] = [];
  private autoTimer: ReturnType<typeof setInterval> | null = null;
  private alertSeq = 0;

  readonly selectedEp = computed(() => this.endpoints().find((e) => e.id === this.selectedId()) ?? (this.endpoints()[0] as Endpoint));
  readonly latencyText = computed(() => fmtMs(sliderToMs(this.formSlider())));
  readonly effTimeout = computed(() => effectiveTimeoutS(this.timeoutS(), this.slowMs()));
  readonly waves = computed(() => Math.ceil(this.endpointCount / Math.max(1, this.concurrency())));
  readonly failures = computed(() => consecutiveFailures(this.selectedEp().history));

  readonly counts = computed(() => {
    const c: Record<Status, number> = { UP: 0, SLOW: 0, DOWN: 0, ERROR: 0 };
    for (const e of this.endpoints()) c[this.latest(e).status]++;
    return c;
  });

  readonly avgLatency = computed(() => {
    const list = this.endpoints();
    const sum = list.reduce((s, e) => s + this.latest(e).ms, 0);
    return fmtMs(sum / list.length);
  });

  readonly uptime = computed(() => {
    let total = 0;
    let bad = 0;
    for (const e of this.endpoints()) {
      for (const r of e.history) {
        total++;
        if (r.status === 'DOWN' || r.status === 'ERROR') bad++;
      }
    }
    return total ? ((100 * (total - bad)) / total).toFixed(1) + '%' : 'n/a';
  });

  readonly tiles = computed(() => {
    const checking = this.checking();
    const flashing = this.flashing();
    const sel = this.selectedId();
    return this.endpoints().map((e) => {
      const last = this.latest(e);
      const pts: { x: number; y: number; status: Status }[] = e.history.map((r, i) => ({
        x: 4 + i * 23, y: sparkY(r.ms), status: r.status,
      }));
      return {
        id: e.id,
        name: e.name,
        group: e.group,
        status: last.status,
        pill: this.pillFor(last.status),
        lat: last.code === null ? 'no response, ' + fmtMs(last.ms) : 'HTTP ' + last.code + ', ' + fmtMs(last.ms),
        line: pts.map((p) => p.x + ',' + p.y).join(' '),
        dots: pts,
        checking: checking.includes(e.id),
        flash: flashing.includes(e.id),
        selected: e.id === sel,
        aria: e.name + ', ' + last.status + ', ' + fmtMs(last.ms) + '. Select to edit.',
      };
    });
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.clearTimers();
      this.stopAuto();
    });
  }

  /* ---------------- helpers ---------------- */

  protected pillFor(s: Status): string {
    return s === 'UP' ? 'ok' : s === 'SLOW' ? 'warn' : s === 'DOWN' ? 'bad' : 'err';
  }
  protected alertPill(k: AlertKind): string {
    return k === 'critical' ? 'bad' : k === 'warning' ? 'warn' : k === 'info' ? 'ok' : k === 'suppressed' ? 'mute' : 'info';
  }
  private latest(e: Endpoint): Result {
    return e.history[e.history.length - 1] as Result;
  }
  private clock(): string {
    return new Date().toLocaleTimeString('en-GB');
  }
  private clearTimers(): void {
    for (const t of this.timers) clearTimeout(t);
    this.timers = [];
  }
  private stopAuto(): void {
    if (this.autoTimer) clearInterval(this.autoTimer);
    this.autoTimer = null;
  }

  /* ---------------- handlers ---------------- */

  select(id: number): void {
    this.selectedId.set(id);
    const ep = this.endpoints().find((e) => e.id === id) as Endpoint;
    this.formKind.set(formFromPlan(ep.plan));
    this.formSlider.set(msToSlider(ep.plan.latencyMs));
    const last = this.latest(ep);
    this.lastRule.set(last.rule + (last.message ? '. Stored message: ' + last.message : ''));
  }

  setNum(which: 'slow' | 'timeout' | 'conc', v: string): void {
    const n = parseFloat(v);
    if (!Number.isFinite(n) || n <= 0) return;
    if (which === 'slow') this.slowMs.set(Math.round(n));
    else if (which === 'timeout') this.timeoutS.set(n);
    else this.concurrency.set(Math.max(1, Math.min(50, Math.round(n))));
  }

  restoreDefaults(): void {
    this.slowMs.set(DEFAULTS.slowMs);
    this.timeoutS.set(DEFAULTS.timeoutS);
    this.concurrency.set(DEFAULTS.concurrency);
  }

  applyAndCheck(): void {
    const id = this.selectedId();
    const plan = planFromForm(this.formKind(), sliderToMs(this.formSlider()));
    this.endpoints.update((l) => l.map((e) => (e.id === id ? { ...e, plan } : e)));
    this.runChecks([id]);
  }

  runAll(): void {
    this.runChecks(this.endpoints().map((e) => e.id));
  }

  injectOutage(): void {
    const ids = this.pickRandom(6);
    const kinds: Plan[] = [
      { kind: 'http', code: 503, latencyMs: 220, jitter: true },
      { kind: 'http', code: 500, latencyMs: 380, jitter: true },
      { kind: 'timeout', code: 0, latencyMs: 0, jitter: false },
      { kind: 'refused', code: 0, latencyMs: 0, jitter: false },
    ];
    this.endpoints.update((l) =>
      l.map((e) => (ids.includes(e.id) ? { ...e, plan: kinds[Math.floor(Math.random() * kinds.length)] as Plan } : e)),
    );
    this.syncForm();
    this.runChecks(this.endpoints().map((e) => e.id));
  }

  injectSlowdown(): void {
    const ids = this.pickRandom(6);
    const slow = this.slowMs();
    const tmo = this.effTimeout() * 1000;
    this.endpoints.update((l) =>
      l.map((e) => {
        if (!ids.includes(e.id)) return e;
        const hi = tmo * 0.95;
        const lo = slow * 1.05;
        const ms = lo < hi ? lo + Math.random() * (hi - lo) : slow + 500;
        return { ...e, plan: { kind: 'http', code: 200, latencyMs: Math.round(ms), jitter: false } as Plan };
      }),
    );
    this.syncForm();
    this.runChecks(this.endpoints().map((e) => e.id));
  }

  healAll(): void {
    this.endpoints.update((l) => l.map((e) => ({ ...e, plan: OK_PLAN(e.base) })));
    this.syncForm();
    this.runChecks(this.endpoints().map((e) => e.id));
  }

  toggleAuto(): void {
    if (this.auto()) {
      this.stopAuto();
      this.auto.set(false);
      return;
    }
    this.auto.set(true);
    this.countdown.set(AUTO_SECONDS);
    this.autoTimer = setInterval(() => {
      const left = this.countdown() - 1;
      if (left > 0) {
        this.countdown.set(left);
        return;
      }
      this.countdown.set(AUTO_SECONDS);
      if (!this.running()) this.runAll();
    }, 1000);
  }

  /* ---------------- the check cycle ---------------- */

  private syncForm(): void {
    const ep = this.selectedEp();
    this.formKind.set(formFromPlan(ep.plan));
    this.formSlider.set(msToSlider(ep.plan.latencyMs));
  }

  private pickRandom(n: number): number[] {
    const ids = this.endpoints().map((e) => e.id);
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = ids[i] as number;
      ids[i] = ids[j] as number;
      ids[j] = tmp;
    }
    return ids.slice(0, n);
  }

  /**
   * One cycle. Results are decided up front (like asyncio.gather), then applied as each "request"
   * finishes. A semaphore of `concurrency` slots decides when each one starts.
   */
  private runChecks(ids: number[]): void {
    if (this.running() || !ids.length) return;
    this.clearTimers();
    const slowMs = this.slowMs();
    const timeoutS = this.timeoutS();
    const animate = !this.device.reducedMotion;
    const eps = ids.map((id) => this.endpoints().find((e) => e.id === id) as Endpoint);
    const planned = eps.map((e) => ({ ep: e, res: resultFromPlan(e.plan, e.base, Math.random(), slowMs, timeoutS, this.clock()) }));

    this.running.set(true);
    this.countdown.set(AUTO_SECONDS);

    if (!animate) {
      for (const p of planned) this.applyResult(p.ep.id, p.res);
      this.finishRun(ids.length);
      return;
    }

    this.checking.set([...ids]);
    const slots = new Array<number>(Math.max(1, Math.min(this.concurrency(), ids.length))).fill(0);
    let pending = planned.length;
    for (const p of planned) {
      let k = 0;
      for (let i = 1; i < slots.length; i++) if ((slots[i] as number) < (slots[k] as number)) k = i;
      const start = slots[k] as number;
      const dur = Math.min(900, 140 + Math.min(p.res.ms, 6000) / 9) + Math.random() * 120;
      const end = start + dur;
      slots[k] = end;
      this.timers.push(
        setTimeout(() => {
          this.applyResult(p.ep.id, p.res);
          this.checking.update((c) => c.filter((x) => x !== p.ep.id));
          this.flashing.update((f) => [...f, p.ep.id]);
          this.timers.push(setTimeout(() => this.flashing.update((f) => f.filter((x) => x !== p.ep.id)), 700));
          pending--;
          if (pending === 0) this.finishRun(ids.length);
        }, end),
      );
    }
  }

  private finishRun(n: number): void {
    this.running.set(false);
    const c = this.counts();
    this.announce.set(
      'Check complete for ' + n + ' endpoint' + (n === 1 ? '' : 's') + '. ' + c.UP + ' up, ' + c.SLOW + ' slow, ' + c.DOWN + ' down, ' + c.ERROR + ' error.',
    );
    const sel = this.selectedEp();
    const last = this.latest(sel);
    this.lastRule.set(last.rule + (last.message ? '. Stored message: ' + last.message : ''));
  }

  /** DataStore.add_result: append to a deque of 5, compare with the previous status, maybe alert. */
  private applyResult(id: number, res: Result): void {
    const ep = this.endpoints().find((e) => e.id === id) as Endpoint;
    const prev = this.latest(ep).status;
    const history = [...ep.history, res].slice(-DEFAULTS.historyMax);
    this.endpoints.update((l) => l.map((e) => (e.id === id ? { ...e, history } : e)));
    const rule = alertRule(prev, res.status, ep.name, consecutiveFailures(history));
    if (!rule) return;
    if (rule.kind === 'suppressed') {
      this.suppressed.update((n) => n + 1);
      this.pushAlert({ kind: 'suppressed', api: ep.name, text: rule.text, channels: [] });
      return;
    }
    if (rule.kind === 'norule') {
      this.pushAlert({ kind: 'norule', api: ep.name, text: rule.text, channels: [] });
      return;
    }
    const channels = ['Console'];
    if (this.chEmail()) channels.push('Email');
    if (this.chSlack()) channels.push('Slack');
    if (this.chTeams()) channels.push('Teams');
    this.pushAlert({ kind: rule.kind, api: ep.name, text: rule.text, channels });
  }

  private pushAlert(a: Omit<AlertEntry, 'id' | 'time'>): void {
    const entry: AlertEntry = { ...a, id: ++this.alertSeq, time: this.clock() };
    this.alerts.update((l) => [entry, ...l].slice(0, 30));
  }
}
