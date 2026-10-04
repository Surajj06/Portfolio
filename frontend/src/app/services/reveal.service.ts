import { Injectable, NgZone } from '@angular/core';
import { DeviceService } from './device.service';

/**
 * Scroll-reveal with ONE shared IntersectionObserver for every element (the
 * previous version created an observer per element and called matchMedia in
 * each). An element gets `.in` once, as it nears the viewport, then is
 * released — no replay churn while scrolling.
 */
@Injectable({ providedIn: 'root' })
export class RevealService {
  private io?: IntersectionObserver;

  constructor(
    private readonly device: DeviceService,
    private readonly zone: NgZone
  ) {}

  observe(el: Element): void {
    if (!this.device.isBrowser) return;
    if (this.device.reducedMotion || typeof IntersectionObserver === 'undefined') {
      el.classList.add('in');
      return;
    }
    if (!this.io) {
      this.io = this.zone.runOutsideAngular(
        () =>
          new IntersectionObserver(
            (entries) => {
              for (const entry of entries) {
                if (!entry.isIntersecting) continue;
                entry.target.classList.add('in');
                this.io?.unobserve(entry.target);
              }
            },
            { rootMargin: '0px 0px -6% 0px', threshold: 0.08 }
          )
      );
    }
    this.io.observe(el);
  }

  unobserve(el: Element): void {
    this.io?.unobserve(el);
  }
}
