import { Injectable, NgZone, inject } from '@angular/core';
import { DeviceService } from './device.service';
import { PerfGuardService } from './perf-guard.service';

/** The GSAP pieces this site uses, registered once. */
export interface GsapKit {
  gsap: typeof import('gsap').gsap;
  SplitText: typeof import('gsap/SplitText').SplitText;
  Flip: typeof import('gsap/Flip').Flip;
  ScrambleTextPlugin: typeof import('gsap/ScrambleTextPlugin').ScrambleTextPlugin;
}

export type MotionKit = typeof import('motion');

/**
 * Lazy gateway to the two animation libraries.
 *
 * - **Motion** (`motion`, the library formerly known as Framer Motion): small,
 *   WAAPI-based — used for scroll-linked effects (runs on the compositor via
 *   native ScrollTimeline where supported) and springs.
 * - **GSAP** (+ SplitText, Flip, ScrambleText — all free since 3.13): used where
 *   CSS can't — kinetic text, layout (FLIP) transitions, scramble. (Not
 *   ScrollTrigger: it keeps a requestAnimationFrame loop alive forever.)
 *
 * Both are code-split and only fetched after the page has loaded and gone
 * idle, so they add nothing to first paint. They resolve to `null` where
 * decorative motion isn't wanted (server, reduced-motion, lite mode) — callers
 * must treat that as "leave the CSS baseline alone".
 *
 * IMPORTANT: GSAP/Motion drive rAF loops. Always create animations inside
 * `run()` (outside Angular's zone) or every frame would trigger change detection.
 */
@Injectable({ providedIn: 'root' })
export class MotionService {
  private readonly device = inject(DeviceService);
  private readonly perf = inject(PerfGuardService);
  private readonly zone = inject(NgZone);

  private gsapKit?: Promise<GsapKit | null>;
  private motionKit?: Promise<MotionKit | null>;

  /** Whether decorative, JS-driven motion is currently allowed. */
  get allowed(): boolean {
    return this.device.ambientMotion && !this.perf.lite();
  }

  /** Runs `fn` outside Angular's zone. Use for every GSAP / Motion call. */
  run<T>(fn: () => T): T {
    return this.zone.runOutsideAngular(fn);
  }

  gsap(): Promise<GsapKit | null> {
    if (!this.allowed) return Promise.resolve(null);
    return (this.gsapKit ??= this.afterLoadAndIdle().then(() =>
      this.run(async () => {
        const [{ gsap }, { SplitText }, { Flip }, { ScrambleTextPlugin }] = await Promise.all([
          import('gsap'),
          import('gsap/SplitText'),
          import('gsap/Flip'),
          import('gsap/ScrambleTextPlugin')
        ]);
        gsap.registerPlugin(SplitText, Flip, ScrambleTextPlugin);
        gsap.defaults({ ease: 'power3.out', duration: 0.8 });
        // GSAP's ticker keeps requesting frames until it has been idle for this many
        // ticks (default 120 ≈ 2s at 60fps, far longer on a slow phone). It wakes up
        // again by itself the moment something is animated.
        gsap.config({ autoSleep: 30 });
        return { gsap, SplitText, Flip, ScrambleTextPlugin };
      })
    ));
  }

  motion(): Promise<MotionKit | null> {
    if (!this.allowed) return Promise.resolve(null);
    return (this.motionKit ??= this.afterLoadAndIdle().then(() => this.run(() => import('motion'))));
  }

  /** Resolves once the window has loaded and the main thread has a quiet moment. */
  private afterLoadAndIdle(): Promise<void> {
    return new Promise((resolve) => {
      const idle = () => {
        const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => void }).requestIdleCallback;
        ric ? ric(() => resolve(), { timeout: 1800 }) : setTimeout(resolve, 400);
      };
      if (document.readyState === 'complete') idle();
      else window.addEventListener('load', idle, { once: true });
    });
  }
}
