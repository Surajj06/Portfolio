import { Injectable, NgZone } from '@angular/core';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SmoothScrollService } from './smooth-scroll.service';

/**
 * Registers ScrollTrigger once for the whole app and keeps its cached
 * positions in sync with Lenis (SmoothScrollService already owns Lenis's own
 * rAF loop — this only forwards Lenis's scroll position to ScrollTrigger, it
 * never drives Lenis itself, so there's a single source of truth for scroll
 * physics instead of two competing rAF loops).
 */
@Injectable({ providedIn: 'root' })
export class GsapService {
  private initialized = false;

  constructor(
    private readonly zone: NgZone,
    private readonly smoothScroll: SmoothScrollService
  ) {}

  init(): void {
    if (this.initialized || typeof window === 'undefined') return;
    this.initialized = true;

    this.zone.runOutsideAngular(() => {
      gsap.registerPlugin(ScrollTrigger);
      this.smoothScroll.onScroll(() => ScrollTrigger.update());
    });
  }

  /** Runs work with GSAP's Angular-zone patches applied — use for any code
   * that creates tweens/timelines/ScrollTriggers so change detection isn't
   * triggered on every animation frame. */
  run<T>(fn: () => T): T {
    return this.zone.runOutsideAngular(fn);
  }
}
