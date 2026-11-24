import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, ViewChild, computed, inject, signal } from '@angular/core';
import { DeviceService } from '../../services/device.service';
import { DEMO_STYLES } from './demo-styles';

type DocKind = 'pan' | 'aadhaar';

interface Field {
  key: string;
  label: string;
  value: string;
  conf: number;
}
interface CardRow {
  label: string;
  value: string;
}
interface CardView {
  kind: DocKind;
  title: string;
  number: string;
  rows: CardRow[];
  blurry: boolean;
}
interface Sample {
  id: string;
  title: string;
  blurbs: string;
  kind: DocKind;
  filename: string;
  card: CardView;
  fields: Field[];
}
interface Check {
  group: 'validate' | 'extract';
  text: string;
  state: 'ok' | 'bad' | 'note';
}
interface MaskRow {
  label: string;
  raw: string;
  masked: string;
}
interface Run {
  label: string;
  filename: string;
  card: CardView;
  kind: DocKind;
  fields: Field[];
  overall: number;
  threshold: number;
  checks: Check[];
  valid: boolean;
  review: boolean;
  masks: MaskRow[];
  ciphers: { label: string; blob: string }[];
  reply: string;
}
interface ChatMsg {
  id: number;
  from: 'user' | 'bot';
  text: string;
  doc?: { name: string; kind: DocKind };
}
interface FaqHit {
  id: string;
  title: string;
  score: number;
  answer: string;
}
interface Faq {
  id: string;
  title: string;
  answer: string;
  keywords: string;
}

// ---------- ported from the real validation / security helpers ----------
function validatePan(pan: string): { ok: boolean; errors: string[] } {
  if (!pan || pan.length !== 10) return { ok: false, errors: ['PAN must be 10 characters'] };
  if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan)) return { ok: false, errors: ['Invalid PAN format'] };
  return { ok: true, errors: [] };
}
function validateAadhaar(aadhaar: string): { ok: boolean; errors: string[] } {
  const digits = aadhaar.replace(/\D/g, '');
  if (digits.length !== 12) return { ok: false, errors: ['Aadhaar must be 12 digits'] };
  // The repo's checksum routine is a stub that always returns true, so nothing more is checked here either.
  return { ok: true, errors: [] };
}
function maskPan(pan: string): string {
  if (!pan || pan.length !== 10) return '**********';
  return pan.slice(0, 5) + '****' + pan.slice(-1);
}
function maskAadhaar(aadhaar: string): string {
  const digits = aadhaar.replace(/\D/g, '');
  if (digits.length !== 12) return '****-****-****';
  return '****-****-' + digits.slice(-4);
}
function maskPhone(phone: string): string {
  if (!phone || phone.length < 4) return '**********';
  if (phone.startsWith('+')) return phone.slice(0, 3) + '*****' + phone.slice(-4);
  return '*****' + phone.slice(-4);
}
function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return '***@***.***';
  const at = email.indexOf('@');
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  return (local.length <= 1 ? '*' : local[0] + '***') + '@' + domain;
}
/** Same four patterns, same order, as the real PII scrubber that every reply passes through. */
function detectAndMaskPii(text: string): string {
  let t = text.replace(/\b[A-Z]{5}[0-9]{4}[A-Z]\b/g, (m) => maskPan(m));
  t = t.replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, (m) => maskAadhaar(m));
  t = t.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, (m) => maskEmail(m));
  t = t.replace(/\+91\d{10}|\b\d{10}\b/g, (m) => maskPhone(m));
  return t;
}
/** Harmless scramble that only LOOKS like a ciphertext blob. It is a hash-style mix, not encryption. */
function demoCipher(text: string, salt: number): string {
  const alpha = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  const src = text + '|' + salt;
  let h = (2166136261 ^ (salt * 7919)) >>> 0;
  let out = '';
  const n = Math.max(src.length * 3, 64);
  for (let i = 0; i < n; i++) {
    h ^= src.charCodeAt(i % src.length) + i;
    h = Math.imul(h, 16777619) >>> 0;
    out += alpha[h & 63];
  }
  return 'demo~' + out;
}

// ---------- synthetic samples (all values invented) ----------
const SAMPLES: Sample[] = [
  {
    id: 'pan-ok',
    title: 'PAN-style card, clear',
    blurbs: 'Sharp photo, valid format',
    kind: 'pan',
    filename: 'sample_pan_clear.jpg',
    card: {
      kind: 'pan',
      title: 'PERMANENT ACCOUNT NUMBER CARD',
      number: 'ABCDE1234F',
      rows: [
        { label: 'Name', value: 'TEST USER ONE' },
        { label: "Father's name", value: 'TEST FATHER ONE' },
        { label: 'Date of birth', value: '01/01/1990' },
      ],
      blurry: false,
    },
    fields: [
      { key: 'pan_number', label: 'PAN number', value: 'ABCDE1234F', conf: 97 },
      { key: 'name', label: 'Name', value: 'TEST USER ONE', conf: 95 },
      { key: 'father_name', label: "Father's name", value: 'TEST FATHER ONE', conf: 93 },
      { key: 'date_of_birth', label: 'Date of birth', value: '01/01/1990', conf: 96 },
    ],
  },
  {
    id: 'id-ok',
    title: '12-digit ID card, clear',
    blurbs: 'Sharp photo, 12 digits',
    kind: 'aadhaar',
    filename: 'sample_id_clear.jpg',
    card: {
      kind: 'aadhaar',
      title: 'IDENTITY CARD, 12-DIGIT NUMBER',
      number: '1234 5678 9012',
      rows: [
        { label: 'Name', value: 'TEST USER TWO' },
        { label: 'Date of birth', value: '15/08/1985' },
        { label: 'Gender', value: 'Female' },
      ],
      blurry: false,
    },
    fields: [
      { key: 'aadhaar_number', label: 'ID number', value: '1234 5678 9012', conf: 94 },
      { key: 'name', label: 'Name', value: 'TEST USER TWO', conf: 92 },
      { key: 'date_of_birth', label: 'Date of birth', value: '15/08/1985', conf: 95 },
      { key: 'gender', label: 'Gender', value: 'Female', conf: 91 },
    ],
  },
  {
    id: 'pan-blur',
    title: 'PAN-style card, blurry',
    blurbs: 'Low-confidence read',
    kind: 'pan',
    filename: 'sample_pan_blurry.jpg',
    card: {
      kind: 'pan',
      title: 'PERMANENT ACCOUNT NUMBER CARD',
      number: 'ABCDE1234F',
      rows: [
        { label: 'Name', value: 'TEST USER THREE' },
        { label: "Father's name", value: 'TEST FATHER THREE' },
        { label: 'Date of birth', value: '05/12/1992' },
      ],
      blurry: true,
    },
    fields: [
      { key: 'pan_number', label: 'PAN number', value: 'ABCDE12S4F', conf: 58 },
      { key: 'name', label: 'Name', value: 'TEST USER THREE', conf: 66 },
      { key: 'father_name', label: "Father's name", value: 'TEST FATHER THRFE', conf: 61 },
      { key: 'date_of_birth', label: 'Date of birth', value: '05/12/1992', conf: 64 },
    ],
  },
];

const FAQS: Faq[] = [
  {
    id: 'docs',
    title: 'Accepted documents',
    answer: 'You can send a photo of a PAN-style card or a 12-digit ID card. Keep the whole card in frame and the text sharp.',
    keywords: 'documents accepted send photo upload which type pan card id aadhaar identity',
  },
  {
    id: 'storage',
    title: 'Storage and security',
    answer:
      'Your photo is encrypted as soon as it is saved and the plain copy is deleted. Sensitive fields such as ID numbers are encrypted too, and replies only ever show masked values.',
    keywords: 'stored storage secure security safe encrypted encryption privacy data protect delete',
  },
  {
    id: 'masking',
    title: 'Masked numbers',
    answer: 'We never send your full ID number back. A PAN shows its first five characters and the last one, and a 12-digit ID shows only its last four digits.',
    keywords: 'masked masking hidden stars asterisks full number shown reply echo',
  },
  {
    id: 'review',
    title: 'Manual review',
    answer:
      'If the text could not be read with enough confidence, the document goes to manual review instead of being auto-verified. A clearer, well-lit photo usually fixes this.',
    keywords: 'review manual why rejected failed confidence unclear blurry low sent',
  },
  {
    id: 'tips',
    title: 'Photo tips',
    answer: 'Place the card on a flat, dark surface, avoid glare and shadows, and hold the camera steady so the text is sharp.',
    keywords: 'photo tips picture camera lighting glare shadow blur sharp better clearer',
  },
  {
    id: 'time',
    title: 'Processing time',
    answer: 'Most documents are processed within a few seconds. Manual reviews take longer.',
    keywords: 'time long fast quick seconds wait processing how soon',
  },
];
const STOP = new Set(['the', 'is', 'a', 'an', 'my', 'to', 'of', 'and', 'i', 'you', 'can', 'how', 'do', 'does', 'what', 'why', 'in', 'it', 'for', 'are', 'be', 'we', 'with', 'on', 'me', 'this', 'that', 'was', 'will']);
const toks = (s: string): string[] =>
  (s.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((w) => w.length > 1 && !STOP.has(w)).map((w) => (w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w));

const STAGES: { name: string; sub: string }[] = [
  { name: 'Received', sub: 'webhook gets the photo' },
  { name: 'Preprocess', sub: 'grayscale, denoise, threshold, deskew' },
  { name: 'OCR', sub: 'Tesseract reads the text' },
  { name: 'Validate', sub: 'format rules' },
  { name: 'Mask + encrypt', sub: 'before anything is stored or sent' },
  { name: 'Reply', sub: 'masked data only' },
];
const PRE_STEPS = ['Grayscale', 'Denoise', 'Threshold', 'Deskew'];
const QUESTIONS = ['How is my data stored?', 'Why was a document sent for review?', 'Any tips for a better photo?'];

@Component({
  selector: 'app-whatsapp-demo',
  standalone: true,
  imports: [NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-template #cardTpl let-c>
      <div class="idcard" [class.idcard--blur]="c.blurry">
        <div class="idcard__body">
          <div class="idcard__title">{{ c.title }}</div>
          <div class="idcard__main">
            <div class="idcard__photo"></div>
            <div class="idcard__rows">
              @for (r of c.rows; track r.label) {
                <div>
                  <small>{{ r.label }}</small>
                  <span>{{ r.value }}</span>
                </div>
              }
              <div class="idcard__num">{{ c.number }}</div>
            </div>
          </div>
        </div>
        <div class="idcard__wm">SAMPLE &ndash; FAKE DATA</div>
      </div>
    </ng-template>

    <section class="demo" aria-label="Interactive document verification bot demo">
      <div class="demo__bar">
        <strong class="demo__title">Document bot: from photo to masked reply</strong>
        <span class="demo__tag">Interactive &middot; runs in your browser</span>
      </div>

      <div class="demo__body">
        <p class="hint">
          &ldquo;Send&rdquo; one of three invented sample cards, or type the extracted fields yourself, and follow the document through every stage the real
          webhook runs. The bot's reply only ever contains masked values.
        </p>

        <div class="samples" role="group" aria-label="Sample documents to send">
          @for (s of samples; track s.id) {
            <button type="button" class="sample" [disabled]="busy()" (click)="sendSample(s)" [attr.aria-label]="'Send sample: ' + s.title + '. ' + s.blurbs">
              <span class="sample__thumb" aria-hidden="true">
                <ng-container *ngTemplateOutlet="cardTpl; context: { $implicit: s.card }"></ng-container>
              </span>
              <span class="sample__t">{{ s.title }}</span>
              <span class="sample__s">{{ s.blurbs }}</span>
            </button>
          }
        </div>

        <div class="row">
          <button type="button" class="dbtn dbtn--sm" [attr.aria-expanded]="manual()" aria-controls="wa-manual" (click)="manual.set(!manual())">
            {{ manual() ? 'Hide' : 'Or type the extracted fields by hand' }}
          </button>
          <label class="field thr">
            <span>OCR confidence threshold (configurable): {{ threshold().toFixed(2) }}</span>
            <input type="range" name="threshold" min="0.5" max="0.95" step="0.01" [value]="threshold()" (input)="onThreshold($event)" />
          </label>
        </div>

        @if (manual()) {
          <form id="wa-manual" class="mform" (submit)="onManual($event)">
            <label class="field">
              <span>Document type</span>
              <select name="kind" [value]="mKind()" (change)="mKind.set(sel($event))">
                <option value="pan">PAN-style card (10 characters)</option>
                <option value="aadhaar">12-digit ID card</option>
              </select>
            </label>
            <label class="field">
              <span>{{ mKind() === 'pan' ? 'PAN number' : 'ID number' }}</span>
              <input
                type="text"
                name="number"
                autocomplete="off"
                maxlength="20"
                [placeholder]="mKind() === 'pan' ? 'ABCDE1234F' : '1234 5678 9012'"
                [value]="mNumber()"
                (input)="mNumber.set(val($event))" />
            </label>
            <label class="field">
              <span>Name</span>
              <input type="text" name="name" autocomplete="off" maxlength="40" placeholder="TEST USER" [value]="mName()" (input)="mName.set(val($event))" />
            </label>
            <label class="field">
              <span>Date of birth</span>
              <input type="text" name="dob" autocomplete="off" maxlength="10" placeholder="DD/MM/YYYY" [value]="mDob()" (input)="mDob.set(val($event))" />
            </label>
            <label class="field">
              <span>Overall OCR confidence: {{ mConf() }}%</span>
              <input type="range" name="conf" min="30" max="99" step="1" [value]="mConf()" (input)="onConf($event)" />
            </label>
            <div class="row mform__go">
              <button type="submit" class="dbtn dbtn--primary" [disabled]="busy()">Send these fields to the bot</button>
            </div>
          </form>
        }

        <div class="pipe" role="list" aria-label="Pipeline stages">
          @for (s of stages; track s.name; let i = $index) {
            <div class="stage" role="listitem" [class.active]="stageIdx() === i" [class.done]="stageIdx() > i">
              <span class="stage__n" aria-hidden="true">{{ i + 1 }}</span>
              <strong class="stage__name">{{ s.name }}</strong>
              <span class="stage__sub">{{ s.sub }}</span>
            </div>
          }
        </div>

        <div class="grid-2">
          <div class="col">
            <div class="phone">
              <div class="phone__head">
                <span class="avatar" aria-hidden="true">D</span>
                <div class="phone__who">
                  <strong>Document bot</strong>
                  <small>chat demo, not a real number</small>
                </div>
              </div>
              <ol class="msgs" role="log" aria-live="polite" aria-label="Chat with the document bot" #msgs>
                @for (m of messages(); track m.id) {
                  <li class="msg" [class.msg--user]="m.from === 'user'">
                    @if (m.doc) {
                      <span class="msg__doc"><span class="msg__ic" aria-hidden="true"></span>Photo: {{ m.doc.name }}</span>
                    }
                    <span class="msg__text">{{ m.text }}</span>
                  </li>
                }
                @if (typing()) {
                  <li class="msg typing"><span class="sr-only">The bot is typing</span><span class="dot" aria-hidden="true"></span><span class="dot" aria-hidden="true"></span><span class="dot" aria-hidden="true"></span></li>
                }
              </ol>
              <form class="composer" (submit)="onAsk($event)">
                <label class="sr-only" for="wa-ask">Ask a follow-up question</label>
                <input id="wa-ask" type="text" name="ask" autocomplete="off" maxlength="120" placeholder="Ask a follow-up, e.g. how is my data stored?" [value]="ask()" [disabled]="busy()" (input)="ask.set(val($event))" />
                <button type="submit" class="dbtn dbtn--primary" [disabled]="busy() || !ask().trim()">Ask</button>
              </form>
            </div>
            <div class="row">
              @for (q of questions; track q) {
                <button type="button" class="dbtn dbtn--sm" [disabled]="busy()" (click)="askText(q)">{{ q }}</button>
              }
              <button type="button" class="dbtn dbtn--sm" [disabled]="busy()" (click)="reset()">Reset chat</button>
            </div>
            @if (hits().length) {
              <div class="hits" aria-live="polite">
                <div class="hits__head">
                  <span>Local retrieval, no external LLM</span>
                  <span class="pill mute">token overlap</span>
                </div>
                @for (h of hits(); track h.id; let i = $index) {
                  <div class="hit" [class.hit--top]="i === 0">
                    <span class="hit__t">{{ h.title }}</span>
                    <span class="cbar"><span class="cbar__fill" [style.transform]="'scaleX(' + h.score + ')'"></span></span>
                    <span class="hit__n">{{ h.score.toFixed(2) }}</span>
                  </div>
                }
                <p class="hint hint--small">The real bot embeds the question locally and takes the nearest answer from a FAISS index. A reply counts only when it is close enough; otherwise a generic prompt is sent.</p>
              </div>
            }
          </div>

          <div class="col work" aria-live="polite">
            @if (!run()) {
              <p class="hint">Pick a sample above. Each stage's result will appear here as it runs.</p>
            }
            @if (run(); as r) {
              @if (stageIdx() >= 1) {
                <div class="blk">
                  <h4 class="sect">2 &middot; Preprocess</h4>
                  <div class="prev">
                    <div class="prev__card" [style.filter]="cardFilter()" [style.transform]="cardTransform()">
                      <ng-container *ngTemplateOutlet="cardTpl; context: { $implicit: r.card }"></ng-container>
                    </div>
                    <ol class="steps">
                      @for (p of preSteps; track p; let i = $index) {
                        <li class="step" [class.step--on]="sub() > i" [class.step--now]="sub() === i + 1">{{ p }}</li>
                      }
                    </ol>
                  </div>
                  <p class="hint hint--small">The real code applies these four steps with OpenCV, in this order. Here, CSS filters only approximate them.</p>
                </div>
              }
              @if (stageIdx() >= 2) {
                <div class="blk">
                  <h4 class="sect">3 &middot; OCR, confidence per field</h4>
                  <div class="ocr">
                    @for (f of r.fields; track f.key; let i = $index) {
                      <div class="ocr__row" [style.--i]="i">
                        <span class="ocr__l">{{ f.label }}</span>
                        <span class="ocr__v">{{ f.value || '(not found)' }}</span>
                        <span class="cbar"><span class="cbar__fill" [class.low]="f.conf < r.threshold * 100" [style.--w]="f.conf / 100"></span></span>
                        <span class="ocr__n">{{ f.conf }}%</span>
                      </div>
                    }
                  </div>
                  <p class="hint">
                    Overall confidence <strong>{{ (r.overall / 100).toFixed(2) }}</strong>
                    <span class="pill" [class.ok]="!r.review" [class.warn]="r.review">{{ r.review ? 'below threshold ' + r.threshold.toFixed(2) : 'meets threshold ' + r.threshold.toFixed(2) }}</span>
                  </p>
                </div>
              }
              @if (stageIdx() >= 3) {
                <div class="blk">
                  <h4 class="sect">4 &middot; Validate</h4>
                  <ul class="checks">
                    @for (c of r.checks; track $index) {
                      <li>
                        <span class="pill" [class.ok]="c.state === 'ok'" [class.bad]="c.state === 'bad'" [class.mute]="c.state === 'note'">{{ c.state === 'ok' ? '✓ ok' : c.state === 'bad' ? '✗ fail' : 'note' }}</span>
                        <span>{{ c.text }}</span>
                      </li>
                    }
                  </ul>
                </div>
              }
              @if (stageIdx() >= 4) {
                <div class="blk">
                  <h4 class="sect">5 &middot; Mask + encrypt</h4>
                  <div class="tbl">
                    <table>
                      <thead>
                        <tr><th scope="col">Field</th><th scope="col">Inside the server</th><th scope="col">In any reply or log</th></tr>
                      </thead>
                      <tbody>
                        @for (m of r.masks; track m.label) {
                          <tr><td>{{ m.label }}</td><td class="mono">{{ m.raw }}</td><td class="mono"><strong>{{ m.masked }}</strong></td></tr>
                        }
                      </tbody>
                    </table>
                  </div>
                  @for (c of r.ciphers; track c.label) {
                    <div class="cipher">
                      <span class="cipher__l">{{ c.label }}, encrypted at rest</span>
                      <code class="cipher__b">{{ c.blob }}</code>
                    </div>
                  }
                  <p class="hint hint--small">Illustrative scramble, not real encryption: the real system encrypts with Fernet. The plain-text copy is deleted after encryption.</p>
                </div>
              }
              @if (stageIdx() >= 5) {
                <div class="blk">
                  <h4 class="sect">6 &middot; Reply sent to the chat</h4>
                  <p class="hint">
                    <span class="pill" [class.ok]="r.valid && !r.review" [class.warn]="r.review" [class.bad]="!r.valid && !r.review">{{ r.review ? 'manual review' : r.valid ? 'verified' : 'verification failed' }}</span>
                    The reply is the bubble in the chat, built only from masked values.
                  </p>
                </div>
              }
            }
          </div>
        </div>
      </div>

      <p class="demo__note">
        All documents and values here are invented samples; nothing you type leaves your browser. Simplified: the real bot runs OpenCV and Tesseract on a server,
        the ciphertext shown is an illustrative scramble rather than Fernet, and the follow-up answers use word overlap instead of local embeddings with FAISS.
        The ID checksum is not verified (the checksum routine in the source is an unfinished stub), so only length and format rules are shown. Per-field confidence is
        illustrative; the real system averages Tesseract word scores into one number, and its default threshold is set in configuration. In the source, a PAN reply
        also echoes the name as read, and the ID reply does not echo the number; this demo shows its masked form as well.
      </p>
    </section>
  `,
  styles: [
    DEMO_STYLES,
    `
      .hint--small { font-size: 0.78rem; color: var(--text-3); }
      .sect { margin: 0 0 8px; font-family: var(--font-mono); font-size: 0.68rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-3); font-weight: 500; }
      .mono { font-family: var(--font-mono); font-size: 0.8rem; }

      /* paper-like documents keep their own colours in both themes */
      .idcard { position: relative; width: 100%; aspect-ratio: 1.6; border-radius: 0.9em; overflow: hidden; border: 1px solid rgba(0,0,0,.18);
        background: linear-gradient(135deg, #f4efe0, #e4ddc8); color: #1c1c1c; font-size: 11px; line-height: 1.35; }
      .idcard__body { position: absolute; inset: 0; padding: 1em 1.1em; display: grid; grid-template-rows: auto 1fr; gap: .6em; }
      .idcard--blur .idcard__body { filter: blur(0.14em); }
      .idcard--blur::after { content: ''; position: absolute; inset: 0; background: repeating-linear-gradient(0deg, rgba(0,0,0,.06) 0 1px, transparent 1px 3px); }
      .idcard__title { font-size: .72em; font-weight: 800; letter-spacing: .14em; color: #3a3a3a; }
      .idcard__main { display: grid; grid-template-columns: 5em 1fr; gap: .9em; align-items: start; }
      .idcard__photo { aspect-ratio: .8; border-radius: .4em; background: linear-gradient(160deg, #b8b19c, #8f8a78); }
      .idcard__rows { display: grid; gap: .35em; min-width: 0; }
      .idcard__rows small { display: block; font-size: .62em; text-transform: uppercase; letter-spacing: .08em; color: #5a5a5a; }
      .idcard__rows span { font-weight: 600; font-size: .9em; }
      .idcard__num { font-family: var(--font-mono); font-weight: 800; font-size: 1.35em; letter-spacing: .08em; margin-top: .15em; }
      .idcard__wm { position: absolute; left: -8%; right: -8%; bottom: 14%; transform: rotate(-11deg); text-align: center; font-weight: 800; font-size: 1.2em; letter-spacing: .18em; color: rgba(190, 40, 30, .55); border-block: 2px solid rgba(190, 40, 30, .4); background: rgba(255, 255, 255, .35); padding: .15em 0; }

      .samples { display: grid; gap: 10px; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); }
      .sample { display: grid; gap: 6px; padding: 10px; text-align: left; border: 1px solid var(--line-2); border-radius: var(--r-md); background: var(--bg-2); color: var(--text); font: inherit; cursor: pointer;
        min-height: 44px; transition: border-color .2s ease, transform .3s var(--ease-out); }
      .sample:hover:not(:disabled) { border-color: var(--accent-text); transform: translateY(-2px); }
      .sample:focus-visible { outline: 2px solid var(--accent-text); outline-offset: 2px; }
      .sample:disabled { opacity: .5; cursor: not-allowed; }
      .sample__thumb { display: block; pointer-events: none; font-size: 6px; }
      .sample__thumb .idcard { font-size: 6px; }
      .sample__t { font-weight: 600; font-size: 0.88rem; }
      .sample__s { font-size: 0.76rem; color: var(--text-3); }
      .thr { flex: 1 1 240px; }
      .mform { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); padding: 14px; border: 1px solid var(--line); border-radius: var(--r-sm); background: var(--bg-2); }
      .mform__go { grid-column: 1 / -1; }

      .pipe { display: grid; gap: 8px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
      @media (min-width: 560px) { .pipe { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
      @media (min-width: 900px) { .pipe { grid-template-columns: repeat(6, minmax(0, 1fr)); } }
      .stage { display: grid; gap: 3px; align-content: start; min-width: 0; padding: 10px 12px; border: 1px solid var(--line); border-radius: var(--r-sm); background: var(--bg-2); color: var(--text-3);
        transition: border-color .35s ease, background-color .35s ease, color .35s ease, transform .35s var(--ease-out); }
      .stage__n { font-family: var(--font-mono); font-size: 0.66rem; }
      .stage__name { font-size: 0.86rem; line-height: 1.2; color: var(--text-2); }
      .stage__sub { font-size: 0.72rem; line-height: 1.3; }
      .stage.active { border-color: var(--accent-text); background: var(--accent-soft); color: var(--text); transform: translateY(-2px); }
      .stage.active .stage__name { color: var(--text); }
      .stage.done { border-color: var(--line-2); color: var(--text-2); }
      .stage.done .stage__n::after { content: ' \\2713'; color: var(--mint); }

      .phone { display: grid; grid-template-rows: auto 1fr auto; border: 1px solid var(--line-2); border-radius: 24px; background: var(--bg-2); overflow: hidden; max-width: 440px; width: 100%; margin-inline: auto; }
      .phone__head { display: flex; align-items: center; gap: 12px; padding: 12px 16px; background: var(--surface-2); border-bottom: 1px solid var(--line); }
      .avatar { display: grid; place-items: center; width: 36px; height: 36px; border-radius: 50%; background: color-mix(in srgb, var(--mint) 20%, transparent); border: 1px solid color-mix(in srgb, var(--mint) 50%, transparent); font-weight: 700; }
      .phone__who { display: grid; line-height: 1.25; }
      .phone__who small { color: var(--text-3); font-size: 0.74rem; }
      .msgs { margin: 0; padding: 14px 12px; list-style: none; display: flex; flex-direction: column; gap: 8px; height: 400px; overflow-y: auto; overscroll-behavior: contain; }
      .msg { max-width: 86%; align-self: flex-start; display: grid; gap: 6px; padding: 9px 13px; border-radius: 16px 16px 16px 4px; background: var(--surface-2); border: 1px solid var(--line);
        font-size: 0.9rem; line-height: 1.45; white-space: pre-line; overflow-wrap: anywhere; animation: pop .3s var(--ease-out); }
      .msg--user { align-self: flex-end; border-radius: 16px 16px 4px 16px; background: color-mix(in srgb, var(--mint) 16%, var(--surface-2)); border-color: color-mix(in srgb, var(--mint) 40%, transparent); }
      .msg__doc { display: flex; align-items: center; gap: 8px; font-size: 0.8rem; color: var(--text-2); }
      .msg__ic { width: 22px; height: 16px; border-radius: 3px; background: linear-gradient(135deg, #f4efe0, #cfc7ae); border: 1px solid var(--line-2); flex: none; }
      .typing { display: inline-flex; gap: 5px; align-items: center; padding: 12px 14px; }
      .dot { width: 7px; height: 7px; border-radius: 50%; background: var(--text-3); animation: bounce 1s ease-in-out infinite; }
      .dot:nth-child(3) { animation-delay: .15s; }
      .dot:nth-child(4) { animation-delay: .3s; }
      @keyframes bounce { 0%, 80%, 100% { transform: translateY(0); opacity: .5; } 40% { transform: translateY(-5px); opacity: 1; } }
      @keyframes pop { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
      .composer { display: flex; gap: 8px; padding: 10px 12px; border-top: 1px solid var(--line); background: var(--surface-2); }
      .composer input { flex: 1 1 auto; min-width: 0; min-height: 44px; padding: 8px 14px; border: 1px solid var(--line-2); border-radius: var(--r-pill); background: var(--bg-2); color: var(--text); font: inherit; font-size: 0.95rem; }
      .composer input:focus-visible { outline: 2px solid var(--accent-text); outline-offset: 2px; }

      .hits { display: grid; gap: 8px; padding: 12px 14px; border: 1px solid var(--line); border-radius: var(--r-sm); background: var(--bg-2); }
      .hits__head { display: flex; justify-content: space-between; gap: 8px; flex-wrap: wrap; align-items: center; font-family: var(--font-mono); font-size: 0.68rem; letter-spacing: .08em; text-transform: uppercase; color: var(--text-3); }
      .hit { display: grid; grid-template-columns: minmax(0, 9em) 1fr 2.6em; gap: 10px; align-items: center; font-size: 0.82rem; color: var(--text-3); }
      .hit--top { color: var(--text); font-weight: 600; }
      .hit__n { font-family: var(--font-mono); font-variant-numeric: tabular-nums; text-align: right; }

      .cbar { display: block; height: 7px; border-radius: 999px; background: var(--line); overflow: hidden; }
      .cbar__fill { display: block; height: 100%; background: var(--mint); transform-origin: left center; transition: transform .5s var(--ease-out); }
      .ocr .cbar__fill { transform: scaleX(0); animation: grow .8s var(--ease-out) both; animation-delay: calc(var(--i, 0) * 160ms + 120ms); }
      .ocr__row { animation: pop .4s var(--ease-out) both; animation-delay: calc(var(--i, 0) * 160ms); }
      .cbar__fill.low { background: var(--amber); }
      @keyframes grow { from { transform: scaleX(0); } to { transform: scaleX(var(--w, 1)); } }

      .work { align-content: start; }
      .blk { padding: 12px 14px; border: 1px solid var(--line); border-radius: var(--r-sm); background: var(--bg-2); animation: pop .4s var(--ease-out); }
      .prev { display: grid; gap: 12px; grid-template-columns: minmax(0, 1fr); align-items: center; }
      @media (min-width: 520px) { .prev { grid-template-columns: minmax(0, 1fr) auto; } }
      .prev__card { max-width: 300px; transition: filter .45s ease, transform .6s var(--ease-out); }
      .prev__card .idcard { font-size: 11px; }
      .steps { margin: 0; padding: 0; list-style: none; display: grid; gap: 6px; }
      .step { padding: 6px 12px; border: 1px solid var(--line); border-radius: var(--r-pill); font-family: var(--font-mono); font-size: 0.74rem; color: var(--text-3); transition: color .3s ease, border-color .3s ease, background-color .3s ease; }
      .step--on { color: var(--text); border-color: var(--line-2); }
      .step--on::before { content: '\\2713 '; color: var(--mint); }
      .step--now { background: var(--accent-soft); border-color: var(--accent-line); }

      .ocr { display: grid; gap: 8px; }
      .ocr__row { display: grid; grid-template-columns: minmax(0, 7.5em) minmax(0, 1fr); gap: 4px 10px; align-items: center; font-size: 0.84rem; }
      .ocr__l { color: var(--text-3); }
      .ocr__v { font-family: var(--font-mono); font-size: 0.8rem; overflow-wrap: anywhere; }
      .ocr__row .cbar { grid-column: 1 / 2; }
      .ocr__n { font-family: var(--font-mono); font-size: 0.74rem; color: var(--text-3); font-variant-numeric: tabular-nums; }
      .checks { margin: 0; padding: 0; list-style: none; display: grid; gap: 8px; }
      .checks li { display: flex; gap: 10px; align-items: flex-start; font-size: 0.84rem; line-height: 1.4; }
      .checks .pill { flex: none; }
      .cipher { display: grid; gap: 4px; margin-top: 10px; }
      .cipher__l { font-size: 0.74rem; color: var(--text-3); }
      .cipher__b { display: block; padding: 8px 10px; border-radius: var(--r-sm); background: var(--surface-2); border: 1px dashed var(--line-2); font-family: var(--font-mono); font-size: 0.7rem; color: var(--text-2); overflow-wrap: anywhere; }
    `,
  ],
})
export class WhatsappDemoComponent {
  private readonly device = inject(DeviceService);
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();
  @ViewChild('msgs') private msgsEl?: ElementRef<HTMLElement>;

  readonly samples = SAMPLES;
  readonly stages = STAGES;
  readonly preSteps = PRE_STEPS;
  readonly questions = QUESTIONS;

  readonly messages = signal<ChatMsg[]>([]);
  readonly typing = signal(false);
  readonly busy = signal(false);
  readonly run = signal<Run | null>(null);
  readonly stageIdx = signal(-1);
  readonly sub = signal(0);
  readonly threshold = signal(0.8);
  readonly manual = signal(false);
  readonly mKind = signal<DocKind>('pan');
  readonly mNumber = signal('');
  readonly mName = signal('');
  readonly mDob = signal('');
  readonly mConf = signal(90);
  readonly ask = signal('');
  readonly hits = signal<FaqHit[]>([]);

  readonly cardFilter = computed(() => {
    const s = this.sub();
    if (s <= 0) return 'none';
    if (s === 1) return 'grayscale(1)';
    if (s === 2) return 'grayscale(1) blur(0.6px)';
    return 'grayscale(1) contrast(2.6) brightness(1.1)';
  });
  readonly cardTransform = computed(() => (this.sub() >= 4 ? 'rotate(0deg)' : 'rotate(-2.4deg)'));

  private nextId = 1;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.clearTimers());
    this.seed();
  }

  // ---------- template helpers ----------
  val(ev: Event): string {
    return (ev.target as HTMLInputElement).value;
  }
  sel(ev: Event): DocKind {
    return (ev.target as HTMLSelectElement).value === 'aadhaar' ? 'aadhaar' : 'pan';
  }
  onThreshold(ev: Event): void {
    this.threshold.set(+this.val(ev));
  }
  onConf(ev: Event): void {
    this.mConf.set(Number(this.val(ev)));
  }
  onManual(ev: Event): void {
    ev.preventDefault();
    this.sendManual();
  }
  onAsk(ev: Event): void {
    ev.preventDefault();
    this.askText(this.ask());
  }

  // ---------- chat setup ----------
  private seed(): void {
    this.messages.set([{ id: this.nextId++, from: 'bot', text: 'Welcome! Send me your PAN or Aadhaar card image for verification.' }]);
  }
  reset(): void {
    this.clearTimers();
    this.busy.set(false);
    this.typing.set(false);
    this.run.set(null);
    this.stageIdx.set(-1);
    this.sub.set(0);
    this.hits.set([]);
    this.ask.set('');
    this.nextId = 1;
    this.seed();
  }

  // ---------- sending a document ----------
  sendSample(s: Sample): void {
    this.start({ label: s.title, filename: s.filename, kind: s.kind, card: s.card, fields: s.fields });
  }

  private sendManual(): void {
    const kind = this.mKind();
    const conf = this.mConf();
    const offsets = [3, -1, -2, 0];
    const clamp = (n: number): number => Math.max(5, Math.min(99, n));
    const num = this.mNumber().trim();
    const name = this.mName().trim();
    const dob = this.mDob().trim();
    const fields: Field[] = [
      { key: kind === 'pan' ? 'pan_number' : 'aadhaar_number', label: kind === 'pan' ? 'PAN number' : 'ID number', value: num, conf: num ? clamp(conf + offsets[0]) : 0 },
      { key: 'name', label: 'Name', value: name, conf: name ? clamp(conf + offsets[1]) : 0 },
      { key: 'date_of_birth', label: 'Date of birth', value: dob, conf: dob ? clamp(conf + offsets[2]) : 0 },
    ];
    const card: CardView = {
      kind,
      title: kind === 'pan' ? 'PERMANENT ACCOUNT NUMBER CARD' : 'IDENTITY CARD, 12-DIGIT NUMBER',
      number: num || '(blank)',
      rows: [
        { label: 'Name', value: name || '(blank)' },
        { label: 'Date of birth', value: dob || '(blank)' },
      ],
      blurry: conf < 70,
    };
    this.start({ label: 'Typed fields', filename: 'typed_fields.jpg', kind, card, fields }, conf);
  }

  private start(src: { label: string; filename: string; kind: DocKind; card: CardView; fields: Field[] }, forcedOverall?: number): void {
    if (this.busy()) return;
    const found = src.fields.filter((f) => f.value);
    const overall = forcedOverall ?? (found.length ? Math.round((found.reduce((a, f) => a + f.conf, 0) / found.length) * 10) / 10 : 0);
    const run = this.buildRun(src, overall);
    this.run.set(run);
    this.hits.set([]);
    this.messages.update((m) => [...m, { id: this.nextId++, from: 'user', text: 'Please verify this document.', doc: { name: src.filename, kind: src.kind } }]);
    this.scroll();
    this.busy.set(true);
    this.stageIdx.set(0);
    this.sub.set(0);

    const botReply = (): void => {
      this.typing.set(false);
      this.messages.update((m) => [...m, { id: this.nextId++, from: 'bot', text: run.reply }]);
      this.scroll();
    };

    if (this.device.reducedMotion) {
      this.sub.set(4);
      this.stageIdx.set(6);
      botReply();
      this.busy.set(false);
      return;
    }

    const go = (steps: Array<[() => void, number]>, i = 0): void => {
      if (i >= steps.length) return;
      steps[i][0]();
      this.later(() => go(steps, i + 1), steps[i][1]);
    };
    go([
      [() => this.stageIdx.set(0), 750],
      [() => { this.stageIdx.set(1); this.sub.set(0); }, 480],
      [() => this.sub.set(1), 480],
      [() => this.sub.set(2), 480],
      [() => this.sub.set(3), 480],
      [() => this.sub.set(4), 800],
      [() => this.stageIdx.set(2), 1500],
      [() => this.stageIdx.set(3), 1200],
      [() => this.stageIdx.set(4), 1500],
      [() => { this.stageIdx.set(5); this.typing.set(true); this.scroll(); }, 900],
      [() => { botReply(); this.stageIdx.set(6); this.busy.set(false); }, 0],
    ]);
  }

  private buildRun(src: { label: string; filename: string; kind: DocKind; card: CardView; fields: Field[] }, overall: number): Run {
    const kind = src.kind;
    const threshold = this.threshold();
    const get = (k: string): string => src.fields.find((f) => f.key === k)?.value ?? '';
    const numKey = kind === 'pan' ? 'pan_number' : 'aadhaar_number';
    const raw = get(numKey);
    const idName = kind === 'pan' ? 'PAN' : 'Aadhaar-style ID';
    const checks: Check[] = [];

    // extraction, as the real field extractor does it (pattern search over the OCR text)
    let extracted: string | null = null;
    if (kind === 'pan') {
      const m = /\b[A-Z]{5}[0-9]{4}[A-Z]\b/.exec(raw.toUpperCase());
      extracted = m ? m[0] : null;
    } else {
      const m = /\b(\d{4}\s?\d{4}\s?\d{4})\b/.exec(raw);
      extracted = m ? m[1].replace(/ /g, '') : null;
    }

    let valid = false;
    if (extracted) {
      const v = kind === 'pan' ? validatePan(extracted) : validateAadhaar(extracted);
      valid = v.ok;
      checks.push({
        group: 'validate',
        state: v.ok ? 'ok' : 'bad',
        text: v.ok
          ? kind === 'pan'
            ? 'PAN is 10 characters in the form 5 letters, 4 digits, 1 letter'
            : 'ID number is exactly 12 digits'
          : v.errors.join(', '),
      });
      if (kind === 'aadhaar') {
        checks.push({ group: 'validate', state: 'note', text: 'Checksum not verified. The checksum routine in the source is an unfinished stub that always passes, so the demo does not claim it.' });
      }
    } else {
      checks.push({ group: 'validate', state: 'bad', text: idName + ' number not found in document' });
      const v = kind === 'pan' ? validatePan(raw.toUpperCase()) : validateAadhaar(raw);
      if (raw && !v.ok) checks.push({ group: 'validate', state: 'note', text: 'Validator on the raw text "' + raw + '": ' + v.errors.join(', ') });
    }
    const name = get('name');
    const dob = get('date_of_birth');
    checks.push({ group: 'extract', state: name && /^[A-Za-z\s]+$/.test(name) ? 'ok' : 'bad', text: 'Name matches the extraction pattern (letters and spaces)' });
    checks.push({ group: 'extract', state: /^\d{2}[-/]\d{2}[-/]\d{4}$/.test(dob) ? 'ok' : 'bad', text: 'Date of birth matches DD/MM/YYYY or DD-MM-YYYY' });

    const review = overall < threshold * 100 - 1e-9;
    const masked = kind === 'pan' ? maskPan(extracted ?? raw) : maskAadhaar(extracted ?? raw);
    const masks: MaskRow[] = [{ label: kind === 'pan' ? 'PAN number' : 'ID number', raw: raw || '(blank)', masked }];

    let reply: string;
    if (review) {
      reply =
        'Sent to manual review (confidence ' + (overall / 100).toFixed(2) + ' < threshold ' + threshold.toFixed(2) + '). A clearer, well-lit photo may let us verify it automatically.';
    } else if (valid) {
      reply = kind === 'pan' ? 'PAN verified: ' + masked + '\nName: ' + (name || 'N/A') : 'Aadhaar verified successfully\nID: ' + masked;
    } else {
      const errs = checks.filter((c) => c.group === 'validate' && c.state === 'bad').map((c) => c.text);
      reply = 'Verification failed: ' + errs.join(', ');
    }
    reply = detectAndMaskPii(reply);

    return {
      label: src.label,
      filename: src.filename,
      card: src.card,
      kind,
      fields: src.fields,
      overall,
      threshold,
      checks,
      valid,
      review,
      masks,
      ciphers: [
        { label: 'Image file ' + src.filename, blob: demoCipher(src.filename, 1) },
        { label: 'ID number field', blob: demoCipher(extracted ?? raw, 2) },
      ],
      reply,
    };
  }

  // ---------- follow-up questions: local retrieval, no external model ----------
  askText(text: string): void {
    const q = text.trim();
    if (!q || this.busy()) return;
    this.ask.set('');
    const shown = detectAndMaskPii(q);
    this.messages.update((m) => [...m, { id: this.nextId++, from: 'user', text: shown }]);
    this.scroll();

    let reply: string;
    if (['hi', 'hello', 'help'].includes(q.toLowerCase())) {
      reply = 'Welcome! Send me your PAN or Aadhaar card image for verification.';
      this.hits.set([]);
    } else {
      const qt = new Set(toks(q));
      const scored: FaqHit[] = FAQS.map((f) => {
        const dt = new Set(toks(f.answer + ' ' + f.keywords + ' ' + f.title));
        let overlap = 0;
        qt.forEach((t) => {
          if (dt.has(t)) overlap++;
        });
        return { id: f.id, title: f.title, answer: f.answer, score: qt.size ? overlap / qt.size : 0 };
      }).sort((a, b) => b.score - a.score);
      this.hits.set(scored.slice(0, 3));
      const top = scored[0];
      reply = top && top.score >= 0.34 ? detectAndMaskPii(top.answer) : 'I can help you with document verification. Please upload your PAN or Aadhaar card.';
    }

    const answer = (): void => {
      this.typing.set(false);
      this.messages.update((m) => [...m, { id: this.nextId++, from: 'bot', text: reply }]);
      this.scroll();
    };
    if (this.device.reducedMotion) {
      answer();
      return;
    }
    this.typing.set(true);
    this.scroll();
    this.later(answer, 650);
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
