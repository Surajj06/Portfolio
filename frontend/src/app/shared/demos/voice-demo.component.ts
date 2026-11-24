import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, ViewChild, computed, inject, signal } from '@angular/core';
import { DeviceService } from '../../services/device.service';
import { DEMO_STYLES } from './demo-styles';

type Intent = 'pickup-word' | 'yes' | 'no' | 'callback' | 'ai-check' | 'knowledge' | 'not-in-docs' | 'personal-fact' | 'unknown';
type CallStage = 'identity' | 'timecheck' | 'talk' | 'ended';
type Wave = 'idle' | 'caller' | 'agent';

interface ChatLine {
  id: number;
  who: 'caller' | 'agent';
  text: string;
  intent?: Intent;
  tools?: string[];
}
interface LogLine {
  at: string;
  text: string;
}
interface Classified {
  intent: Intent;
  kbKey?: string;
  time?: string;
  needsTime?: boolean;
  note?: string;
}
interface Decision {
  intent: Intent;
  reply: string;
  tools: string[];
  end: boolean;
  stage: CallStage;
  pickups: number;
  toolLog: string[];
  why: string;
}
interface KbFact {
  key: string;
  keywords: string[];
  answer: string;
}
interface StageView {
  key: string;
  name: string;
  sub: string;
  ms: number | null;
}

/** Invented knowledge documents for the fictional campaign. */
const KB: KbFact[] = [
  {
    key: 'counting',
    keywords: ['count', 'counting', 'counted', 'counts', 'ginti', 'gine', 'gina', 'qualify', 'qualifies', 'qualifying', 'how does it work', 'kaise'],
    answer:
      'Only dealer-network sales that are registered and delivered between 1 April and 30 June count toward the contest. Returned units are subtracted.',
  },
  {
    key: 'deadline',
    keywords: ['deadline', 'last date', 'closes', 'close', 'closing', 'ends', 'end date', 'kab tak', 'cutoff', 'cut off'],
    answer: 'The contest closes on 30 June at midnight. Sales registered after that count toward the next quarter.',
  },
  {
    key: 'rewards',
    keywords: ['reward', 'rewards', 'prize', 'prizes', 'gift', 'gifts', 'trip', 'voucher', 'bonus', 'inaam', 'inam', 'kya milega'],
    answer: 'Everyone who reaches 50 qualifying units gets a 5,000 rupee voucher, and the top ten dealers win a group trip.',
  },
  {
    key: 'results',
    keywords: ['result', 'results', 'announce', 'announced', 'payout', 'when will', 'kab milega', 'milega', 'milegi', 'kab aayega'],
    answer: 'Results are announced within 15 days after the contest closes, and vouchers are emailed within 30 days.',
  },
  {
    key: 'eligibility',
    keywords: ['eligible', 'eligibility', 'who can', 'participate', 'participation', 'kaun', 'join'],
    answer: 'Any dealer on the active network list with at least one registered sale this quarter is eligible.',
  },
];

const QUICK_REPLIES: string[] = [
  'Yes, go ahead',
  'Hello?',
  'Busy, call me tomorrow 3 pm',
  'How does counting work?',
  'Did I win?',
  'Are you a robot?',
  'No',
];

const OVERLAP_MS = 170;
const TIME_SCALE = 0.4;
const EQ_BARS = 30;

const norm = (t: string): string =>
  ' ' +
  t
    .toLowerCase()
    .replace(/[^\p{L}\p{N}:'\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim() +
  ' ';
const has = (n: string, words: string[]): boolean => words.some((w) => n.includes(' ' + w + ' '));
const jitter = (base: number, pct: number): number => Math.round(base * (1 + (Math.random() * 2 - 1) * pct));

@Component({
  selector: 'app-voice-demo',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="demo" aria-label="Interactive voice-agent pipeline demo">
      <div class="demo__bar">
        <strong class="demo__title">Voice agent: one call turn, stage by stage</strong>
        <span class="demo__tag">Interactive &middot; runs in your browser</span>
      </div>

      <div class="demo__body">
        <p class="hint">
          Scenario: a reminder call for a made-up dealer rewards contest (&ldquo;Acme Rewards&rdquo;). You are the person who picks up. Tap a reply or type
          your own (English or Hinglish), press <strong>Send</strong>, and watch the turn travel through the pipeline.
        </p>

        <div class="row" role="group" aria-label="Quick replies">
          @for (q of quick; track q) {
            <button type="button" class="dbtn dbtn--sm" [disabled]="busy() || ended()" (click)="send(q)">{{ q }}</button>
          }
        </div>

        <form class="row composer" (submit)="onSubmit($event)">
          <label class="field composer__field">
            <span>Your reply (type anything)</span>
            <input
              type="text"
              name="utterance"
              autocomplete="off"
              maxlength="140"
              placeholder="e.g. haan bolo, kal 3 baje call karna, kab milega?"
              [value]="draft()"
              [disabled]="busy() || ended()"
              (input)="onDraft($event)" />
          </label>
          <button type="submit" class="dbtn dbtn--primary composer__send" [disabled]="busy() || ended() || !draft().trim()">Send</button>
        </form>

        <div class="row">
          <button
            type="button"
            class="dbtn dbtn--sm"
            [attr.aria-pressed]="failover()"
            [disabled]="busy()"
            (click)="toggleFailover()">
            Make the primary LLM fail: {{ failover() ? 'on' : 'off' }}
          </button>
          <button type="button" class="dbtn dbtn--sm" [disabled]="busy() || !hasTurn()" (click)="replay()">Replay last turn</button>
          <button type="button" class="dbtn dbtn--sm" [disabled]="busy()" (click)="restart()">Restart call</button>
          <span class="pill" [class.ok]="!ended()" [class.mute]="ended()">{{ ended() ? 'Call ended' : 'Call live' }}</span>
        </div>

        <div class="pipe" role="list" aria-label="Per-turn pipeline stages">
          @for (s of stages(); track s.key; let i = $index) {
            <div
              class="stage"
              role="listitem"
              [class.active]="stageIdx() === i"
              [class.done]="stageIdx() > i"
              [class.fail]="failover() && i === 3 && stageIdx() >= i && hasTurn()">
              <span class="stage__n" aria-hidden="true">{{ i + 1 }}</span>
              <strong class="stage__name">{{ s.name }}</strong>
              <span class="stage__sub">{{ s.sub }}</span>
              <span class="stage__ms">{{ s.ms === null ? 'speech' : '~' + s.ms + ' ms' }}</span>
              @if (i === 3 && toolChips().length && stageIdx() >= 3) {
                <span class="stage__tools">
                  @for (t of toolChips(); track t) {
                    <span class="pill info">{{ t }}</span>
                  }
                </span>
              }
            </div>
          }
        </div>
        <p class="hint hint--small">
          Stage figures are typical measured timings from real test calls, with small random jitter. The animation is sped up; the meter shows real time.
          Stages overlap slightly (the speech-to-text stage streams), so they do not sum exactly to the total.
        </p>

        <div class="meter" aria-live="polite">
          <div class="meter__head">
            <span class="eq-label pill" [class.info]="wave() === 'caller'" [class.ok]="wave() === 'agent'" [class.mute]="wave() === 'idle'">
              {{ wave() === 'caller' ? 'Caller audio' : wave() === 'agent' ? 'Agent audio' : 'Line quiet' }}
            </span>
            <span class="meter__num"
              >caller stops &rarr; first agent sound: <strong>{{ secs(elapsed()) }}</strong> s
              <span class="meter__typ">(typical &asymp; 2.2 s)</span></span
            >
          </div>
          <div class="eq" aria-hidden="true" [attr.data-mode]="wave()" [class.eq--still]="reduced">
            @for (b of bars; track b.i) {
              <span class="eq__bar" [style.animation-delay]="b.delay" [style.animation-duration]="b.dur" [style.--h]="b.h"></span>
            }
          </div>
          <div class="track" role="img" [attr.aria-label]="'Latency meter, ' + secs(elapsed()) + ' seconds of about 3.5'">
            <div class="track__fill" [class.warn]="elapsed() > 2800" [style.transform]="fillTransform()"></div>
            <div class="track__mark" style="left: 62.857%"></div>
          </div>
          @if (delta() > 0) {
            <p class="hint hint--small delta">
              <span class="pill warn">Failover</span> primary LLM failed, the hedged backup request answered: about
              <strong>+{{ secs(delta()) }} s</strong> compared with a healthy turn.
            </p>
          }
        </div>

        <div class="grid-2">
          <div class="col">
            <h4 class="sect">Transcript</h4>
            <ol class="chat" role="log" aria-live="polite" aria-label="Call transcript" #chat>
              @for (l of lines(); track l.id) {
                <li class="bubble" [class.bubble--caller]="l.who === 'caller'" [class.bubble--agent]="l.who === 'agent'">
                  <span class="bubble__who">{{ l.who === 'caller' ? 'Caller (you)' : 'Agent' }}</span>
                  <span class="bubble__text">{{ l.text }}</span>
                  @if (l.intent || (l.tools && l.tools.length)) {
                    <span class="bubble__tags">
                      @if (l.intent) {
                        <span class="pill" [class]="pillClass(l.intent)">intent: {{ l.intent }}</span>
                      }
                      @for (t of l.tools ?? []; track t) {
                        <span class="pill info">tool: {{ t }}</span>
                      }
                    </span>
                  }
                </li>
              }
            </ol>
          </div>
          <div class="col">
            <h4 class="sect">What the engine did</h4>
            <ol class="log" aria-label="Engine log">
              @if (!log().length) {
                <li><span>Nothing yet. Send a reply to see the per-turn engine events.</span></li>
              }
              @for (e of log(); track $index) {
                <li>
                  <time>{{ e.at }}</time>
                  <span>{{ e.text }}</span>
                </li>
              }
            </ol>
          </div>
        </div>
      </div>

      <p class="demo__note">
        Illustrative scenario: the campaign, dates and figures are invented, and timings are typical values from test calls, not guarantees. Simplified here:
        in the real platform the language model handles every turn from a written prompt, and a small keyword layer only recognises yes/no style replies. The
        classifier in this demo (keywords, Hinglish, time parsing) stands in for the model so the page works offline. The real pipeline also does noise
        suppression and has more speech, language and voice providers than shown.
      </p>
    </section>
  `,
  styles: [
    DEMO_STYLES,
    `
      .sect { margin: 0; font-family: var(--font-mono); font-size: 0.68rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-3); font-weight: 500; }
      .hint--small { font-size: 0.78rem; color: var(--text-3); }
      .composer { align-items: flex-end; }
      .composer__field { flex: 1 1 240px; }
      .composer__send { flex: none; min-width: 96px; }

      .pipe { display: grid; gap: 8px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
      @media (min-width: 560px) { .pipe { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
      @media (min-width: 900px) { .pipe { grid-template-columns: repeat(6, minmax(0, 1fr)); } }
      .stage {
        position: relative; display: grid; gap: 3px; align-content: start; min-width: 0;
        padding: 10px 12px; border: 1px solid var(--line); border-radius: var(--r-sm);
        background: var(--bg-2); color: var(--text-3);
        transition: border-color .35s ease, background-color .35s ease, color .35s ease, transform .35s var(--ease-out);
      }
      .stage__n { font-family: var(--font-mono); font-size: 0.66rem; color: var(--text-3); }
      .stage__name { font-size: 0.86rem; line-height: 1.2; color: var(--text-2); }
      .stage__sub { font-size: 0.72rem; line-height: 1.3; }
      .stage__ms { font-family: var(--font-mono); font-size: 0.74rem; font-variant-numeric: tabular-nums; }
      .stage__tools { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; min-width: 0; }
      .stage__tools .pill, .tools .pill, .pill.info { white-space: normal; overflow-wrap: anywhere; max-width: 100%; }
      .stage.active { border-color: var(--accent-text); background: var(--accent-soft); color: var(--text); transform: translateY(-2px); }
      .stage.active .stage__name { color: var(--text); }
      .stage.done { border-color: var(--line-2); color: var(--text-2); }
      .stage.done .stage__n::after { content: ' \\2713'; color: var(--mint); }
      .stage.fail.active, .stage.fail.done { border-color: var(--amber); }

      .meter { display: grid; gap: 10px; padding: 14px; border: 1px solid var(--line); border-radius: var(--r-sm); background: var(--bg-2); }
      .meter__head { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; justify-content: space-between; }
      .meter__num { font-size: 0.86rem; color: var(--text-2); }
      .meter__num strong { font-family: var(--font-mono); font-size: 1.05rem; color: var(--text); font-variant-numeric: tabular-nums; }
      .meter__typ { color: var(--text-3); font-size: 0.78rem; }
      .delta { margin: 0; }

      .eq { display: flex; align-items: center; gap: 3px; height: 44px; }
      .eq__bar {
        flex: 1 1 0; min-width: 2px; height: 100%; border-radius: 2px; background: var(--line-2);
        transform: scaleY(0.12); transform-origin: center;
      }
      .eq[data-mode='caller'] .eq__bar { background: var(--sky); animation: eq 0.9s ease-in-out infinite; }
      .eq[data-mode='agent'] .eq__bar { background: var(--mint); animation: eq 0.9s ease-in-out infinite; }
      .eq.eq--still[data-mode='caller'] .eq__bar, .eq.eq--still[data-mode='agent'] .eq__bar { animation: none; transform: scaleY(var(--h, 0.5)); }
      @keyframes eq { 0%, 100% { transform: scaleY(0.14); } 50% { transform: scaleY(var(--h, 0.8)); } }

      .track { position: relative; height: 8px; border-radius: 999px; background: var(--line); overflow: hidden; }
      .track__fill { position: absolute; inset: 0; background: var(--mint); transform-origin: left center; transform: scaleX(0); transition: transform .45s var(--ease-out); }
      .track__fill.warn { background: var(--amber); }
      .track__mark { position: absolute; top: 0; bottom: 0; width: 2px; background: var(--text); opacity: 0.6; }

      .chat { margin: 0; padding: 12px; list-style: none; display: flex; flex-direction: column; gap: 10px; min-height: 220px; max-height: 340px; overflow: auto;
        border: 1px solid var(--line); border-radius: var(--r-sm); background: var(--bg-2); }
      .bubble { display: grid; gap: 4px; max-width: 88%; padding: 10px 12px; border-radius: var(--r-md); font-size: 0.9rem; line-height: 1.45; animation: pop .35s var(--ease-out); }
      .bubble--agent { align-self: flex-start; background: var(--surface-2); border: 1px solid var(--line); }
      .bubble--caller { align-self: flex-end; background: var(--accent-soft); border: 1px solid var(--accent-line); }
      .bubble__who { font-family: var(--font-mono); font-size: 0.64rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-3); }
      .bubble__tags { display: flex; flex-wrap: wrap; gap: 4px; }
      @keyframes pop { from { opacity: 0; transform: translateY(6px) scale(0.98); } to { opacity: 1; transform: none; } }
      .log { min-height: 220px; max-height: 340px; }
      .log li > span { overflow-wrap: anywhere; }
    `,
  ],
})
export class VoiceDemoComponent {
  private readonly device = inject(DeviceService);
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();

  @ViewChild('chat') private chatEl?: ElementRef<HTMLElement>;

  readonly quick = QUICK_REPLIES;
  readonly reduced = this.device.reducedMotion;
  readonly bars = Array.from({ length: EQ_BARS }, (_, i) => ({
    i,
    delay: -((i * 0.137) % 0.9).toFixed(2) + 's',
    dur: (0.62 + ((i * 7) % 11) * 0.045).toFixed(2) + 's',
    h: (0.35 + ((i * 13) % 10) * 0.065).toFixed(2),
  }));

  readonly draft = signal('');
  readonly lines = signal<ChatLine[]>([]);
  readonly log = signal<LogLine[]>([]);
  readonly stageIdx = signal(-1);
  readonly wave = signal<Wave>('idle');
  readonly busy = signal(false);
  readonly callStage = signal<CallStage>('identity');
  readonly failover = signal(false);
  readonly elapsed = signal(0);
  readonly timings = signal<number[]>([0, 700, 500, 860, 230, 80]);
  readonly toolChips = signal<string[]>([]);
  readonly delta = signal(0);
  readonly hasTurn = signal(false);

  readonly ended = computed(() => this.callStage() === 'ended');
  readonly fillTransform = computed(() => 'scaleX(' + Math.min(1, this.elapsed() / 3500).toFixed(3) + ')');
  readonly stages = computed<StageView[]>(() => {
    const t = this.timings();
    const fail = this.failover() && this.hasTurn();
    return [
      { key: 'audio', name: 'Caller audio', sub: 'telephony in', ms: null },
      { key: 'vad', name: 'VAD + end of turn', sub: 'VAD 0.2 s + patience 0.5 s', ms: t[1] },
      { key: 'stt', name: 'Speech to text', sub: 'streaming STT', ms: t[2] },
      { key: 'llm', name: 'LLM', sub: fail ? 'primary failed, hedge to backup' : 'first word', ms: t[3] },
      { key: 'tts', name: 'Text to speech', sub: 'first audio chunk', ms: t[4] },
      { key: 'out', name: 'Agent audio', sub: 'engine overhead', ms: t[5] },
    ];
  });

  private nextId = 1;
  private pickups = 0;
  private last: { raw: string; decision: Decision; classified: Classified } | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.clearTimers());
    this.lines.set([
      {
        id: this.nextId++,
        who: 'agent',
        text: 'Hello, this is the automated assistant calling from Acme Rewards, for Sample Motors. Am I speaking with the owner?',
      },
    ]);
  }

  // ---------- template helpers ----------
  secs(ms: number): string {
    return (ms / 1000).toFixed(2);
  }
  pillClass(i: Intent): string {
    switch (i) {
      case 'yes':
      case 'knowledge':
        return 'ok';
      case 'no':
        return 'bad';
      case 'callback':
      case 'ai-check':
        return 'info';
      case 'not-in-docs':
      case 'personal-fact':
        return 'warn';
      default:
        return 'mute';
    }
  }
  onDraft(ev: Event): void {
    this.draft.set((ev.target as HTMLInputElement).value);
  }
  onSubmit(ev: Event): void {
    ev.preventDefault();
    this.send(this.draft());
  }

  // ---------- actions ----------
  send(raw: string): void {
    const text = raw.trim();
    if (!text || this.busy() || this.ended()) return;
    this.draft.set('');
    const classified = this.classify(text);
    const decision = this.decide(classified);
    this.last = { raw: text, decision, classified };
    this.hasTurn.set(true);
    this.pickups = decision.pickups;
    const callerId = this.nextId++;
    this.lines.update((l) => [...l, { id: callerId, who: 'caller', text }]);
    this.scrollChat();
    this.animate(callerId, true);
  }

  toggleFailover(): void {
    this.failover.update((v) => !v);
    if (this.last && !this.busy()) this.replay();
  }

  replay(): void {
    if (!this.last || this.busy()) return;
    this.animate(-1, false);
  }

  restart(): void {
    this.clearTimers();
    this.busy.set(false);
    this.callStage.set('identity');
    this.pickups = 0;
    this.last = null;
    this.hasTurn.set(false);
    this.stageIdx.set(-1);
    this.wave.set('idle');
    this.elapsed.set(0);
    this.delta.set(0);
    this.toolChips.set([]);
    this.log.set([]);
    this.timings.set([0, 700, 500, 860, 230, 80]);
    this.nextId = 1;
    this.lines.set([
      {
        id: this.nextId++,
        who: 'agent',
        text: 'Hello, this is the automated assistant calling from Acme Rewards, for Sample Motors. Am I speaking with the owner?',
      },
    ]);
  }

  // ---------- classifier (stands in for the LLM's decision) ----------
  private classify(raw: string): Classified {
    const n = norm(raw);
    const trimmed = n.trim();

    if (/(robot|\bbot\b|machine|automated|\bai\b|real person|real human|a human|insaan|insan|computer)/.test(n)) {
      return { intent: 'ai-check' };
    }
    if (
      /(did i win|have i won|am i (the )?winner|am i eligible|my (points|units|sales|total|count|score|rank|status|number|result)|how many (have|did) i|\bmera\b|\bmeri\b|\bmere\b|maine jeeta|jeeta kya|jeet gaya)/.test(
        n,
      )
    ) {
      return { intent: 'personal-fact' };
    }

    const t = this.parseTime(n);
    const callbackWords =
      /(call (me )?(back|later|tomorrow|again)|callback|call back|baad mein|baad me|\blater\b|\bbusy\b|abhi nahi|not now|phir (call|baat)|dobara|ring me|reschedule)/.test(
        n,
      );
    if (t.time) return { intent: 'callback', time: t.time, note: t.note };
    if (callbackWords) return { intent: 'callback', needsTime: true };

    if (/^(hello|hullo|helo|hi|hey|hey there|hello hello|hello hello hello|bolo|boliye|kaun|who is this|ji bolo)$/.test(trimmed)) {
      return { intent: 'pickup-word' };
    }

    let best: KbFact | null = null;
    let bestHits = 0;
    for (const f of KB) {
      const hits = f.keywords.filter((k) => n.includes(' ' + k + ' ') || (k.includes(' ') && n.includes(k))).length;
      if (hits > bestHits) {
        best = f;
        bestHits = hits;
      }
    }
    if (best) return { intent: 'knowledge', kbKey: best.key };

    if (/\?|\b(how|what|when|why|where|who|which|does|can|is there|tell me)\b|\b(kya|kaise|kab|kitna|kitne|kyun|kyu|kahan)\b/.test(n)) {
      return { intent: 'not-in-docs' };
    }

    if (has(n, ['no', 'nope', 'nahi', 'nahin', 'naa', 'mat', 'wrong number', 'not interested', 'nahi chahiye', 'stop'])) return { intent: 'no' };
    if (
      has(n, ['yes', 'yeah', 'yep', 'yup', 'sure', 'ok', 'okay', 'haan', 'han', 'haa', 'ji', 'theek', 'thik', 'bilkul', 'zaroor', 'speaking', 'correct', 'right', 'go ahead', 'boliye', 'sunao'])
    ) {
      return { intent: 'yes' };
    }
    return { intent: 'unknown' };
  }

  private parseTime(n: string): { time?: string; dayOnly?: boolean; note?: string } {
    let day: string | null = null;
    if (/ (tomorrow|tmrw|tomorow|kal) /.test(n)) day = 'tomorrow';
    else if (/ (day after tomorrow|parso) /.test(n)) day = 'day after tomorrow';
    else if (/ (today|aaj|tonight|tonite) /.test(n)) day = 'today';
    else {
      const wd = /\b(mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)(day|sday|nesday|rsday|urday)?\b/.exec(n);
      if (wd) {
        const names: Record<string, string> = { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday' };
        day = names[wd[1].slice(0, 3)] ?? null;
      }
    }

    let hour = -1;
    let minute = 0;
    let meridiem: 'am' | 'pm' | null = null;
    const m1 = /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm|baje|bje|oclock|o'clock)\b/.exec(n);
    if (m1) {
      hour = +m1[1];
      minute = m1[2] ? +m1[2] : 0;
      if (m1[3] === 'am' || m1[3] === 'pm') meridiem = m1[3];
    } else {
      const m2 = /\b(?:at|by|around|tak|kal|tomorrow|tmrw|today|aaj)\s+(\d{1,2})(?::(\d{2}))?\b/.exec(n);
      if (m2) {
        hour = +m2[1];
        minute = m2[2] ? +m2[2] : 0;
      }
    }
    if (hour < 0 || hour > 23 || minute > 59) {
      return { dayOnly: !!day };
    }

    let note = '';
    if (!meridiem) {
      if (/(subah|subha|morning)/.test(n)) meridiem = 'am';
      else if (/(shaam|sham|evening|raat|night|dopahar|afternoon|tonight)/.test(n)) meridiem = 'pm';
      else if (hour >= 13) meridiem = null;
      else if (hour >= 7 && hour <= 11) {
        meridiem = 'am';
        note = 'no am/pm said, assumed am';
      } else {
        meridiem = 'pm';
        note = 'no am/pm said, assumed pm';
      }
    }
    const h12 = meridiem === null ? hour % 12 || 12 : hour % 12 === 0 ? 12 : hour % 12;
    const ap = meridiem ?? (hour >= 12 ? 'pm' : 'am');
    const when = (day ?? 'today') + ', ' + h12 + ':' + String(minute).padStart(2, '0') + ' ' + ap;
    return { time: when, note };
  }

  // ---------- what the agent does (prompt-driven in the real system) ----------
  private decide(c: Classified): Decision {
    const stage = this.callStage();
    let pickups = this.pickups;
    const base: Decision = {
      intent: c.intent,
      reply: '',
      tools: [],
      end: false,
      stage,
      pickups,
      toolLog: [],
      why: '',
    };
    const done = (d: Partial<Decision>): Decision => ({ ...base, ...d, pickups });
    const askNext = stage === 'identity' ? ' Just to confirm first: am I speaking with the owner of Sample Motors?' : '';

    if (c.intent === 'ai-check') {
      return done({
        reply:
          "I'm an automated voice assistant calling for Acme Rewards. If you'd rather speak to a person, your account manager can call you. Thanks for your time, goodbye.",
        tools: ['end_call'],
        end: true,
        stage: 'ended',
        why: 'Honest disclosure rule: say it is an automated assistant, then call the end-call tool.',
      });
    }

    if (c.intent === 'callback') {
      if (c.time) {
        return done({
          reply: "Done, I've scheduled a call for " + c.time + '. Thanks, goodbye.',
          tools: ['callback_scheduled {time: "' + c.time + '"}', 'end_call'],
          toolLog: ['callback tool returned ok, only now does the agent confirm the time to the caller'],
          end: true,
          stage: 'ended',
          why: 'Callback with a time: call the callback tool first, confirm only after it succeeds.' + (c.note ? ' (' + c.note + ')' : ''),
        });
      }
      return done({
        reply: 'Of course. What time would suit you?',
        why: 'Callback wanted but no clock time heard, so one short question and no tool call yet.',
      });
    }

    if (stage === 'identity') {
      if (c.intent === 'pickup-word') {
        if (pickups === 0) {
          pickups = 1;
          return done({
            reply: 'Hi, am I speaking with the owner of Sample Motors?',
            why: 'A bare "Hello?" is a pickup word, not a yes. Re-ask once, in fewer words.',
          });
        }
        return done({
          reply: "Sorry, I can't hear you clearly. I'll try again later. Goodbye.",
          tools: ['end_call'],
          end: true,
          stage: 'ended',
          why: 'Second pickup word with no answer: stop pestering, end politely.',
        });
      }
      if (c.intent === 'yes') {
        return done({
          reply: 'Thanks! Is this a good time for a quick one-minute reminder?',
          stage: 'timecheck',
          why: 'Identity confirmed. Next, ask whether it is a good time (one question per turn).',
        });
      }
      if (c.intent === 'no') {
        return done({
          reply: 'Sorry about that, thanks for letting me know. Goodbye.',
          tools: ['end_call'],
          end: true,
          stage: 'ended',
          why: 'Not the right person: apologise and end the call.',
        });
      }
      return done({
        reply: 'Sorry, I need to check one thing first.' + askNext,
        why: 'Identity is not confirmed yet, so the agent stays on that one question.',
      });
    }

    if (stage === 'timecheck') {
      if (c.intent === 'yes') {
        return done({
          reply: 'Great. A quick reminder: the Acme Rewards dealer contest closes on 30 June. Would you like me to explain how counting works?',
          stage: 'talk',
          why: 'Good time confirmed, so deliver the reminder, then offer help.',
        });
      }
      if (c.intent === 'no') {
        return done({
          reply: 'No problem. When would be a better time to call you back?',
          why: '"No" to "good time?" means busy, so offer a callback and ask for a time.',
        });
      }
      if (c.intent === 'pickup-word') {
        return done({ reply: "Yes, I'm here. Is now a good time for a one-minute reminder?", why: 'Pickup word again: repeat the question in fewer words.' });
      }
    }

    // stage 'talk' (and fall-through from timecheck for questions)
    const next: CallStage = stage === 'timecheck' ? 'talk' : stage;
    switch (c.intent) {
      case 'knowledge': {
        const f = KB.find((k) => k.key === c.kbKey);
        return done({
          reply: (f ? f.answer : '') + ' Anything else you would like to know?',
          tools: ['knowledge("' + (c.kbKey ?? '') + '")'],
          toolLog: ['knowledge tool searched the assistant documents, 1 match: "' + (c.kbKey ?? '') + '"'],
          stage: next,
          why: 'Factual question: answer only from the knowledge documents.',
        });
      }
      case 'not-in-docs':
        return done({
          reply: "That isn't in my documents, so I won't guess. Your account manager can confirm it. Anything else I can help with?",
          tools: ['knowledge("(no match)")'],
          toolLog: ['knowledge tool searched the assistant documents, 0 matches'],
          stage: next,
          why: 'Nothing relevant in the documents: say so instead of inventing an answer.',
        });
      case 'personal-fact':
        return done({
          reply:
            "I can't see your personal results from here, and I don't want to guess. Your account manager will confirm that for you. Anything else on how the contest works?",
          stage: next,
          why: 'Person-specific fact: never guess, hand off to the account manager.',
        });
      case 'yes':
        return done({ reply: 'Great. What would you like to know about the contest: counting, the deadline, rewards or results?', stage: next, why: 'Yes with nothing to act on: offer the topics.' });
      case 'no':
        return done({
          reply: 'Alright, thanks for your time. Goodbye.',
          tools: ['end_call'],
          end: true,
          stage: 'ended',
          why: 'Caller has nothing more: close politely and end the call.',
        });
      case 'pickup-word':
        return done({ reply: "I'm here. Could you say that again?", stage: next, why: 'Pickup word mid-call: ask to repeat, briefly.' });
      default:
        return done({
          reply: "Sorry, I didn't catch that. Did you want to know about counting, the deadline, or the rewards?",
          stage: next,
          why: 'Unclear reply: ask one clarifying question.',
        });
    }
  }

  // ---------- pipeline animation ----------
  private animate(callerId: number, apply: boolean): void {
    const last = this.last;
    if (!last) return;
    const d = last.decision;
    const c = last.classified;
    const fail = this.failover();

    const stt = jitter(500, 0.1);
    const llmBase = jitter(860, 0.1);
    const penalty = fail ? jitter(350, 0.12) : 0;
    const llm = llmBase + penalty;
    const tts = jitter(230, 0.1);
    const eng = jitter(80, 0.15);
    const vad = 700;
    const sum = vad + stt + llm + tts + eng;
    const total = sum - OVERLAP_MS;
    const k = total / sum;
    this.timings.set([0, vad, stt, llm, tts, eng]);
    this.delta.set(penalty);
    this.toolChips.set([]);
    this.elapsed.set(0);
    this.log.set([]);

    const entries: Array<{ at: number; text: string }[]> = [
      [{ at: 0, text: 'Telephony audio in. Caller is speaking: "' + last.raw + '"' }],
      [
        { at: 0, text: 'VAD (Silero): speech ended, 200 ms of quiet' },
        { at: vad, text: 'Smart-Turn end-of-turn: patience 500 ms elapsed, turn closed (' + vad + ' ms of quiet in total)' },
      ],
      [{ at: vad, text: 'Streaming STT final transcript: "' + last.raw + '" (~' + stt + ' ms)' }],
      this.llmLog(d, c, fail, llm, penalty, vad + stt),
      [{ at: vad + stt + llm, text: 'TTS: first audio chunk ready (~' + tts + ' ms)' }],
      [{ at: vad + stt + llm + tts, text: 'Engine: audio frames to telephony (~' + eng + ' ms). Agent starts speaking: "' + this.short(d.reply) + '"' }],
    ];
    const real = [0, vad, stt, llm, tts, eng];

    const finish = (): void => {
      this.stageIdx.set(6);
      this.wave.set('idle');
      this.busy.set(false);
      if (apply) {
        this.callStage.set(d.stage);
      }
      this.scrollChat();
    };
    const agentSays = (): void => {
      if (!apply) return;
      this.lines.update((l) => [...l, { id: this.nextId++, who: 'agent', text: d.reply, tools: d.tools }]);
      this.scrollChat();
    };
    const tagCaller = (): void => {
      if (!apply) return;
      this.lines.update((l) => l.map((x) => (x.id === callerId ? { ...x, intent: d.intent } : x)));
    };
    const pushLog = (stageI: number): void => {
      for (const e of entries[stageI]) {
        const tm = Math.max(0, Math.round(e.at * k));
        this.log.update((arr) => [...arr, { at: '+' + (tm / 1000).toFixed(2) + 's', text: e.text }]);
      }
    };

    this.busy.set(true);

    if (this.reduced) {
      for (let i = 0; i < 6; i++) pushLog(i);
      this.elapsed.set(total);
      this.toolChips.set(d.tools);
      tagCaller();
      agentSays();
      finish();
      return;
    }

    let i = 0;
    const cumulative = (idx: number): number => real.slice(0, idx + 1).reduce((a, b) => a + b, 0) * k;
    const runStage = (): void => {
      if (i > 5) {
        finish();
        return;
      }
      this.stageIdx.set(i);
      this.wave.set(i === 0 ? 'caller' : i === 5 ? 'agent' : 'idle');
      pushLog(i);
      if (i === 3) {
        this.toolChips.set(d.tools);
        tagCaller();
      }
      if (i === 5) agentSays();
      const dur = i === 0 ? 650 : Math.max(160, real[i] * TIME_SCALE);
      // The meter counts caller-stop -> now, so it only starts moving at stage 2.
      if (i > 0) this.elapsed.set(Math.round(cumulative(i)));
      const hold = i === 5 ? 1200 : dur;
      this.later(() => {
        i++;
        runStage();
      }, hold);
    };
    runStage();
  }

  private llmLog(d: Decision, c: Classified, fail: boolean, llm: number, penalty: number, start: number): Array<{ at: number; text: string }> {
    const out: Array<{ at: number; text: string }> = [];
    if (fail) {
      out.push({ at: start, text: 'primary LLM request sent' });
      out.push({ at: start + 100, text: 'primary LLM: no first token and an error, hedged backup request fired after 0.1 s' });
      out.push({ at: start + llm, text: 'backup LLM first word arrived (+' + penalty + ' ms vs a healthy turn), primary cancelled' });
    } else {
      out.push({ at: start, text: 'LLM (primary) streaming. First word after ~' + llm + ' ms' });
    }
    out.push({ at: start + llm, text: 'Decision (demo classifier standing in for the model): intent = ' + d.intent + (c.time ? ', time = ' + c.time : '') });
    out.push({ at: start + llm, text: d.why });
    for (const t of d.tools) out.push({ at: start + llm, text: 'tool call: ' + t });
    for (const t of d.toolLog) out.push({ at: start + llm, text: t });
    return out;
  }

  private short(s: string): string {
    return s.length > 70 ? s.slice(0, 67) + '...' : s;
  }

  // ---------- plumbing ----------
  private scrollChat(): void {
    this.later(() => {
      const el = this.chatEl?.nativeElement;
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
