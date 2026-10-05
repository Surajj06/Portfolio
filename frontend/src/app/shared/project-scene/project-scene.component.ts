import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, HostBinding, Input, NgZone, afterNextRender, inject } from '@angular/core';
import { ProjectAccent } from '../../models/project.model';

/** Scenes that read best head-on (UI-like) rather than isometric. */
const FRONT_VIEW = new Set(['conversational-quote-assistant', 'whatsapp-document-verification-bot']);

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Equaliser bars fanned around the voice hub (south half-circle). */
const VOICE_BARS = Array.from({ length: 15 }, (_, i) => {
  const a = Math.PI * (0.06 + (0.88 * i) / 14);
  return { i, x: r2(Math.cos(a) * 10.5 - 0.65), y: r2(Math.sin(a) * 9 + 1.5), h: r2(3 + 6.4 * Math.abs(Math.sin(i * 0.72 + 0.5))) };
});

/** Provider nodes riding the orbit ring. */
const VOICE_NODES = [
  { label: 'STT', a: 200 },
  { label: 'LLM', a: 320 },
  { label: 'TTS', a: 80 }
].map((n) => ({ label: n.label, x: r2(Math.cos((n.a * Math.PI) / 180) * 13.5), y: r2(Math.sin((n.a * Math.PI) / 180) * 13.5) }));

/** Records falling through the matching pipeline; `no` ones fail a rule gate. */
const MATCH_PACKETS = [
  { i: 0, x: -6.6, y: -3, no: false },
  { i: 1, x: 3.4, y: 2.4, no: true },
  { i: 2, x: -1.2, y: -4, no: false },
  { i: 3, x: 6.2, y: -1.4, no: false },
  { i: 4, x: -5.4, y: 3.4, no: true },
  { i: 5, x: 0.8, y: 3.6, no: false },
  { i: 6, x: -3, y: 0, no: false },
  { i: 7, x: 4.4, y: -4.4, no: true }
];

/** Podium bars for the leaderboard: position and how tall each one swings. */
const BOARD_BARS = [
  { i: 0, x: -11.4, h: 6, lo: 0.7, hi: 1.25 },
  { i: 1, x: -5.7, h: 8.4, lo: 0.8, hi: 1.15 },
  { i: 2, x: 0, h: 10.6, lo: 0.6, hi: 1.1 },
  { i: 3, x: 5.7, h: 7.2, lo: 0.85, hi: 1.45 },
  { i: 4, x: 11.4, h: 4.6, lo: 0.8, hi: 1.7 }
];

/** Candles: low/high of the wick and open/close of the body (world units). */
const CANDLES = [
  { i: 0, lo: 1.2, hi: 5.4, o: 2.0, c: 4.2 },
  { i: 1, lo: 2.6, hi: 6.2, o: 4.2, c: 3.1 },
  { i: 2, lo: 2.2, hi: 7.4, o: 3.1, c: 6.4 },
  { i: 3, lo: 4.6, hi: 8.6, o: 6.4, c: 5.4 },
  { i: 4, lo: 4.4, hi: 10.2, o: 5.4, c: 9.0 },
  { i: 5, lo: 7.0, hi: 11.6, o: 9.0, c: 8.0 },
  { i: 6, lo: 7.4, hi: 13.4, o: 8.0, c: 12.2 }
].map((c) => ({
  i: c.i,
  x: r2(-12.6 + c.i * 4.2),
  lo: c.lo,
  wick: r2(c.hi - c.lo),
  body: r2(Math.abs(c.c - c.o)),
  bodyLift: r2(Math.min(c.o, c.c) - c.lo),
  up: c.c >= c.o
}));
const VOLUME = [1.4, 2.2, 1.7, 2.6, 2.1, 3.0, 2.4].map((h, i) => ({ i, x: r2(-12.6 + i * 4.2), h }));

/** Status tiles for the API monitor: 6 × 4 grid, a few not-so-healthy. */
const STATUS_TILES = Array.from({ length: 24 }, (_, n) => {
  const col = n % 6;
  const row = Math.floor(n / 6);
  const key = `${col}-${row}`;
  return { n, x: r2(-10.2 + col * 3.4), y: r2(-6.8 + row * 3.4), state: key === '4-1' ? 'bad' : key === '1-2' || key === '5-3' ? 'warn' : 'ok' };
});

/** Nine ECG-style beats (80 units each) for the API monitor's heartbeat strip. */
const BEAT_PATH = 'M0 26' + ' h14 q4,-8 8,0 h6 l3,3 l5,-26 l5,34 l3,-11 h8 q6,-9 12,0 h16'.repeat(9);

/**
 * Live 3D cover for each project: a small CSS-3D scene (planes and boxes in
 * `preserve-3d`, one camera) that hints at what the system does. Everything is
 * driven by compositor-only animation (`transform` / `opacity`), sized in `em`
 * from the container so it scales to any card, paused off-screen by the
 * wrapper (ProjectVisualComponent) and gently tilted by the pointer.
 */
@Component({
  selector: 'app-project-scene',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[attr.data-accent]': 'accent', '[attr.data-scene]': 'id' },
  templateUrl: './project-scene.component.html',
  styleUrl: './project-scene.component.scss'
})
export class ProjectSceneComponent {
  @Input({ required: true }) id!: string;
  @Input() accent: ProjectAccent = 'lime';
  /** Reduced-motion: keep the 3D pose, drop the animation. */
  @Input() @HostBinding('class.is-still') still = false;

  readonly voiceBars = VOICE_BARS;
  readonly voiceNodes = VOICE_NODES;
  readonly matchPackets = MATCH_PACKETS;
  readonly boardBars = BOARD_BARS;
  readonly candles = CANDLES;
  readonly volume = VOLUME;
  readonly tiles = STATUS_TILES;
  readonly beatPath = BEAT_PATH;
  readonly confetti = Array.from({ length: 9 }, (_, i) => ({ i, x: r2(-12 + ((i * 7) % 9) * 3), y: r2(-3 + ((i * 5) % 7) * 1.1) }));

  get view(): 'front' | 'iso' {
    return FRONT_VIEW.has(this.id) ? 'front' : 'iso';
  }

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly zone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    // Pointer parallax: the whole scene leans a few degrees toward the cursor.
    // Fine-pointer devices only; one rect read on enter, then rAF-throttled
    // custom-property writes (the CSS transition smooths them).
    afterNextRender(() => {
      if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
      const el = this.host.nativeElement;
      let rect: DOMRect | undefined;
      let raf = 0;
      let px = 0;
      let py = 0;
      const apply = () => {
        raf = 0;
        el.style.setProperty('--px', px.toFixed(3));
        el.style.setProperty('--py', py.toFixed(3));
      };
      const move = (e: PointerEvent) => {
        if (!rect) return;
        px = Math.max(-1, Math.min(1, ((e.clientX - rect.left) / rect.width) * 2 - 1));
        py = Math.max(-1, Math.min(1, ((e.clientY - rect.top) / rect.height) * 2 - 1));
        if (!raf) raf = requestAnimationFrame(apply);
      };
      const enter = () => (rect = el.getBoundingClientRect());
      const leave = () => {
        rect = undefined;
        px = py = 0;
        if (!raf) raf = requestAnimationFrame(apply);
      };
      this.zone.runOutsideAngular(() => {
        el.addEventListener('pointerenter', enter, { passive: true });
        el.addEventListener('pointermove', move, { passive: true });
        el.addEventListener('pointerleave', leave, { passive: true });
      });
      this.destroyRef.onDestroy(() => {
        cancelAnimationFrame(raf);
        el.removeEventListener('pointerenter', enter);
        el.removeEventListener('pointermove', move);
        el.removeEventListener('pointerleave', leave);
      });
    });
  }
}
