import { Injectable, NgZone, signal } from '@angular/core';
import { DeviceService } from './device.service';
import { ScrollService } from './scroll.service';

/**
 * Adaptive quality. If a device can't keep up, the page quietly drops its
 * purely decorative effects (ambient drifting glows, floating stickers,
 * backdrop blur, spotlight, custom cursor, canvas waveform) so scrolling and
 * taps stay smooth. Content, layout and interactivity never change.
 *
 * - Known-weak hardware / data-saver: starts in lite mode.
 * - Everyone else: frame pacing is sampled once after load and once during the
 *   first scroll; a sustained miss flips to lite mode for the session.
 * - `?lite=1` forces lite on, `?lite=0` forces the full experience (handy for
 *   comparing / debugging).
 */
@Injectable({ providedIn: 'root' })
export class PerfGuardService {
  /** True once lite mode is on. Safe to read from rAF loops. */
  readonly lite = signal(false);

  private forced: boolean | null = null;
  private started = false;

  constructor(
    private readonly device: DeviceService,
    private readonly scroll: ScrollService,
    private readonly zone: NgZone
  ) {}

  start(): void {
    if (this.started || !this.device.isBrowser) return;
    this.started = true;

    const param = new URLSearchParams(location.search).get('lite');
    if (param === '1') this.forced = true;
    if (param === '0') this.forced = false;

    if (this.forced === true || (this.forced === null && (this.device.saveData || this.device.lowEnd))) {
      this.enable('start');
      return;
    }
    if (this.forced === false || this.device.reducedMotion) return;

    this.zone.runOutsideAngular(() => {
      // 1) idle pacing, once the page has settled
      const afterLoad = () => this.whenIdle(() => this.sample(1500, 'idle'));
      if (document.readyState === 'complete') afterLoad();
      else window.addEventListener('load', afterLoad, { once: true });

      // 2) pacing while actually scrolling, on the first real scroll
      let scrolled = 0;
      const off = this.scroll.subscribe(({ delta }) => {
        scrolled += Math.abs(delta);
        if (scrolled > 300) {
          off();
          this.sample(1200, 'scroll');
        }
      });
    });
  }

  private whenIdle(fn: () => void): void {
    const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => void }).requestIdleCallback;
    setTimeout(() => (ric ? ric(fn, { timeout: 2500 }) : fn()), 1200);
  }

  /** Measures rAF-to-rAF time for `ms`; flips to lite if pacing is clearly poor. */
  private sample(ms: number, _label: string): void {
    if (this.lite() || document.hidden) return;
    const deltas: number[] = [];
    let last = performance.now();
    const t0 = last;

    const tick = (now: number) => {
      deltas.push(now - last);
      last = now;
      if (now - t0 < ms && !document.hidden) {
        requestAnimationFrame(tick);
        return;
      }
      // Too few samples means the tab was backgrounded — don't judge it.
      if (deltas.length < 18 || document.hidden) return;
      const body = deltas.slice(2).sort((a, b) => a - b); // skip warm-up frames
      const median = body[Math.floor(body.length / 2)];
      const slow = body.filter((d) => d > 40).length / body.length;
      if (median > 26 || slow > 0.35) this.enable('runtime');
    };
    requestAnimationFrame(tick);
  }

  private enable(_reason: 'start' | 'runtime'): void {
    if (this.lite()) return;
    document.documentElement.setAttribute('data-lite', '');
    this.zone.run(() => this.lite.set(true));
  }
}
