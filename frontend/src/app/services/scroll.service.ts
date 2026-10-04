import { Injectable, NgZone } from '@angular/core';
import { DeviceService } from './device.service';

export interface ScrollState {
  y: number;
  /** Direction of the most recent movement: 1 down, -1 up. */
  dir: 1 | -1;
  /** Pixels moved since the previous callback. */
  delta: number;
}

type ScrollSubscriber = (state: ScrollState) => void;

/**
 * One passive scroll listener for the whole app, coalesced to animation
 * frames and run outside Angular's zone. Subscribers only receive a number
 * (never a layout read), so scrolling can't trigger forced reflows or change
 * detection. A subscriber that needs to update template state should enter
 * the zone itself, and only when its state actually changes.
 */
@Injectable({ providedIn: 'root' })
export class ScrollService {
  private readonly subscribers = new Set<ScrollSubscriber>();
  private started = false;
  private ticking = false;
  private lastY = 0;
  private dir: 1 | -1 = 1;

  /** Latest scroll offset (updated every frame while scrolling). */
  y = 0;

  constructor(
    private readonly zone: NgZone,
    private readonly device: DeviceService
  ) {}

  /** Idempotent — safe to call from any component on the browser. */
  start(): void {
    if (this.started || !this.device.isBrowser) return;
    this.started = true;
    this.lastY = this.y = window.scrollY;
    this.zone.runOutsideAngular(() => window.addEventListener('scroll', this.onScroll, { passive: true }));
  }

  subscribe(fn: ScrollSubscriber): () => void {
    this.start();
    this.subscribers.add(fn);
    return () => this.subscribers.delete(fn);
  }

  private readonly onScroll = (): void => {
    if (this.ticking) return;
    this.ticking = true;
    requestAnimationFrame(() => {
      this.ticking = false;
      const y = window.scrollY;
      const delta = y - this.lastY;
      if (delta !== 0) this.dir = delta > 0 ? 1 : -1;
      this.lastY = this.y = y;
      const state: ScrollState = { y, dir: this.dir, delta };
      for (const fn of this.subscribers) fn(state);
    });
  };
}
