/**
 * Thin, SSR-safe wrappers around the browser's built-in speech features, used by
 * the voice-agent demo. Nothing here runs on the server, and nothing is loaded
 * until a visitor presses a button.
 *
 *  - Speech OUT: `speechSynthesis` (the voices installed in the visitor's browser/OS —
 *    on Edge/Windows these include natural neural voices, on Chrome the Google voices).
 *  - Speech IN: `SpeechRecognition` (Chrome, Edge, Safari). The browser vendor's
 *    service transcribes the audio, so the demo says so next to the mic button.
 */

export interface SpeakHandlers {
  onStart?: () => void;
  onEnd?: () => void;
}

const female = /neerja|heera|veena|aditi|raveena|priya|zira|samantha|susan|hazel|sonia|libby|natasha|clara|female/i;

/** Higher is better. Prefers Indian English (the demo speaks Indian English and Hinglish), then other English. */
function score(v: SpeechSynthesisVoice, devanagari: boolean): number {
  const lang = v.lang.replace('_', '-').toLowerCase();
  let s = 0;
  if (devanagari) {
    if (lang.startsWith('hi')) s += 100;
  } else if (lang === 'en-in') s += 100;
  else if (lang.startsWith('en-gb') || lang.startsWith('en-au')) s += 40;
  else if (lang.startsWith('en-us')) s += 30;
  else if (lang.startsWith('en')) s += 20;
  if (/natural|neural|online/i.test(v.name)) s += 30;
  else if (/google/i.test(v.name)) s += 10;
  if (female.test(v.name)) s += 12;
  if (v.localService) s += 2;
  return s;
}

export function pickVoice(voices: SpeechSynthesisVoice[], text: string): SpeechSynthesisVoice | null {
  const devanagari = /[ऀ-ॿ]/.test(text);
  let best: SpeechSynthesisVoice | null = null;
  let bestScore = 0;
  for (const v of voices) {
    const s = score(v, devanagari);
    if (s > bestScore) {
      best = v;
      bestScore = s;
    }
  }
  return best;
}

export class SpeechOut {
  private voices: SpeechSynthesisVoice[] = [];
  private current: SpeechSynthesisUtterance | null = null;
  private guard: ReturnType<typeof setTimeout> | undefined;

  /** True when this browser can speak. Safe to call during SSR (returns false). */
  get supported(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
  }

  /** Voices load asynchronously in Chrome; call once from the browser, then they are cached. */
  init(): void {
    if (!this.supported) return;
    const load = () => (this.voices = window.speechSynthesis.getVoices());
    load();
    window.speechSynthesis.addEventListener?.('voiceschanged', load);
  }

  /** The voice that would be used for this text (for display). */
  voiceName(text = 'Hello'): string | null {
    return pickVoice(this.voices, text)?.name ?? null;
  }

  speak(text: string, handlers: SpeakHandlers = {}): void {
    if (!this.supported || !text.trim()) {
      handlers.onEnd?.();
      return;
    }
    const synth = window.speechSynthesis;
    this.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const voice = pickVoice(this.voices.length ? this.voices : synth.getVoices(), text);
    if (voice) {
      u.voice = voice;
      u.lang = voice.lang;
    } else {
      u.lang = 'en-IN';
    }
    u.rate = 1.02;
    u.pitch = 1;
    let started = false;
    let finished = false;
    const end = () => {
      if (finished) return;
      finished = true;
      clearTimeout(this.guard);
      if (this.current === u) this.current = null;
      handlers.onEnd?.();
    };
    u.onstart = () => {
      started = true;
      clearTimeout(this.guard);
      handlers.onStart?.();
    };
    u.onend = end;
    u.onerror = end;
    this.current = u;
    // Some browsers drop a speak() issued in the same tick as cancel(), and some never fire
    // `start` for a blocked utterance: fail open so the demo never waits on audio that won't come.
    setTimeout(() => synth.speak(u), 30);
    this.guard = setTimeout(() => {
      if (!started) {
        synth.cancel();
        end();
      }
    }, 4000);
  }

  cancel(): void {
    if (!this.supported) return;
    clearTimeout(this.guard);
    const u = this.current;
    this.current = null;
    window.speechSynthesis.cancel();
    if (u) u.onend?.(new Event('end') as SpeechSynthesisEvent);
  }
}

// ---------------------------------------------------------------- listening ---

interface RecognitionResultLike {
  isFinal: boolean;
  0: { transcript: string };
}
interface RecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<RecognitionResultLike>;
}
interface RecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onresult: ((e: RecognitionEventLike) => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type RecognitionCtor = new () => RecognitionLike;

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function recognitionSupported(): boolean {
  return recognitionCtor() !== null;
}

export interface ListenHandlers {
  onInterim: (text: string) => void;
  onFinal: (text: string) => void;
  /** Coarse reason: 'denied' | 'no-speech' | 'unavailable'. */
  onError: (reason: string) => void;
  onEnd: () => void;
}

/** Starts one utterance of recognition. Returns a function that stops it, or null if unsupported. */
export function listenOnce(lang: string, h: ListenHandlers): (() => void) | null {
  const Ctor = recognitionCtor();
  if (!Ctor) return null;
  const rec = new Ctor();
  rec.lang = lang;
  rec.interimResults = true;
  rec.continuous = false;
  rec.maxAlternatives = 1;
  let delivered = false;
  rec.onresult = (e) => {
    let interim = '';
    let final = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) final += r[0].transcript;
      else interim += r[0].transcript;
    }
    if (final.trim() && !delivered) {
      delivered = true;
      h.onFinal(final.trim());
    } else if (interim.trim()) h.onInterim(interim.trim());
  };
  rec.onerror = (e) => {
    const code = e.error ?? '';
    h.onError(code === 'not-allowed' || code === 'service-not-allowed' ? 'denied' : code === 'no-speech' || code === 'aborted' ? 'no-speech' : 'unavailable');
  };
  rec.onend = () => h.onEnd();
  try {
    rec.start();
  } catch {
    h.onError('unavailable');
    h.onEnd();
    return null;
  }
  return () => {
    try {
      rec.stop();
    } catch {
      /* already stopped */
    }
  };
}
