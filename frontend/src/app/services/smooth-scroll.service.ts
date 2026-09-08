import { Injectable, NgZone, OnDestroy } from '@angular/core';
import Lenis from 'lenis';

/**
 * Buttery inertia scrolling (Lenis) layered on top of native scroll — same
 * technique used by most "premium feel" sites. Runs entirely outside
 * Angular's change detection (the rAF loop would otherwise trigger a tick on
 * every frame). Fully skipped under prefers-reduced-motion, in which case
 * the page just keeps its native/CSS smooth scroll.
 */
@Injectable({ providedIn: 'root' })
export class SmoothScrollService implements OnDestroy {
  private lenis?: Lenis;
  private rafId?: number;

  constructor(private readonly zone: NgZone) {}

  init(): void {
    if (typeof window === 'undefined' || this.lenis) return;

    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    this.zone.runOutsideAngular(() => {
      this.lenis = new Lenis({
        duration: 1.05,
        smoothWheel: true,
        wheelMultiplier: 1
      });

      const raf = (time: number) => {
        this.lenis?.raf(time);
        this.rafId = requestAnimationFrame(raf);
      };
      this.rafId = requestAnimationFrame(raf);
    });
  }

  /** Registers a callback fired on every Lenis scroll tick (e.g. to keep GSAP
   * ScrollTrigger's cached positions in sync with Lenis's virtual scroll).
   * No-ops when Lenis is off (reduced motion) — callers relying on native
   * scroll events don't need this. */
  onScroll(callback: () => void): void {
    this.lenis?.on('scroll', callback);
  }

  /** Smoothly scroll to a target (selector, element, or Y offset). Falls back to native when Lenis is off. */
  scrollTo(target: string | HTMLElement | number, options?: { offset?: number }): void {
    if (this.lenis) {
      this.lenis.scrollTo(target, { offset: options?.offset ?? 0 });
      return;
    }
    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const top = typeof target === 'number' ? target : 0;
    window.scrollTo({ top, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
  }

  ngOnDestroy(): void {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.lenis?.destroy();
  }
}
