import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, Input, NgZone, ViewChild, afterNextRender, inject } from '@angular/core';
import { DeviceService } from '../../services/device.service';
import { PerfGuardService } from '../../services/perf-guard.service';

/**
 * A voice-style bar waveform on a small 2D canvas — the visual shorthand for
 * "voice AI" used in the hero and the live-call demo.
 *
 * Deliberately cheap: all bars are one batched path / one fill call, drawn at
 * ~30fps, only while on-screen and the tab is visible; a single static frame
 * under reduced motion or lite mode. Colour follows the element's CSS `color`.
 */
@Component({
  selector: 'app-waveform',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [':host{display:block;width:100%;height:100%} canvas{width:100%;height:100%}'],
  template: `<canvas #cv aria-hidden="true"></canvas>`
})
export class WaveformComponent {
  @ViewChild('cv', { static: true }) private readonly cvRef!: ElementRef<HTMLCanvasElement>;

  @Input() bars = 32;
  /** Fraction of each bar slot left empty (0–0.8). */
  @Input() gap = 0.5;
  /** Speed multiplier. */
  @Input() speed = 1;
  /** Treat the wave as "speaking" (taller) or idle (low amplitude). */
  @Input() energy = 1;

  private readonly zone = inject(NgZone);
  private readonly device = inject(DeviceService);
  private readonly perf = inject(PerfGuardService);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    afterNextRender(() => this.zone.runOutsideAngular(() => this.start()));
  }

  private start(): void {
    const canvas = this.cvRef.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let w = 0;
    let h = 0;
    let dpr = 1;
    let visible = true;
    let raf = 0;
    let last = 0;
    let frame = 0;
    let color = '#d6ff3f';
    const animate = () => this.device.ambientMotion && !this.perf.lite();

    const draw = (t: number) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const n = Math.max(4, Math.round(this.bars));
      const slot = w / n;
      const bw = Math.max(2, slot * (1 - this.gap));
      ctx.fillStyle = color;
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const p = i / (n - 1);
        const envelope = Math.pow(Math.sin(Math.PI * p), 0.7);
        const wobble = 0.5 + 0.5 * Math.sin(t * 2.3 + i * 0.62) * Math.sin(t * 1.35 + i * 0.21 + 1.7);
        const amp = (0.16 + 0.84 * wobble) * (0.22 + 0.78 * envelope) * Math.min(1, this.energy);
        const bh = Math.max(3, amp * h);
        const x = i * slot + (slot - bw) / 2;
        const y = (h - bh) / 2;
        if (ctx.roundRect) ctx.roundRect(x, y, bw, bh, bw / 2);
        else ctx.rect(x, y, bw, bh);
      }
      ctx.fill();
    };

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (!visible || document.hidden || !animate()) return;
      if (now - last < 33) return; // ~30fps is plenty for a waveform
      last = now;
      if (++frame % 60 === 0) color = getComputedStyle(canvas).color || color; // follows theme
      draw((now / 1000) * this.speed);
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = rect.width;
      h = rect.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      color = getComputedStyle(canvas).color || color;
      draw(0.9); // static frame immediately (and the only frame when motion is off)
    };

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    const io = new IntersectionObserver(([entry]) => (visible = entry.isIntersecting), { rootMargin: '80px' });
    io.observe(canvas);
    raf = requestAnimationFrame(loop);

    this.destroyRef.onDestroy(() => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
    });
  }
}
