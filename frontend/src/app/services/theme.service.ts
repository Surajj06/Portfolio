import { Injectable, NgZone, inject, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { DeviceService } from './device.service';
import { PerfGuardService } from './perf-guard.service';

export type Theme = 'dark' | 'light';

// View Transitions API isn't yet in TypeScript's bundled DOM lib.
declare global {
  interface Document {
    startViewTransition?(callback: () => void): { ready: Promise<void>; finished: Promise<void> };
  }
}

const THEME_COLOR: Record<Theme, string> = { dark: '#09090a', light: '#f4f2ea' };

@Injectable({ providedIn: 'root' })
export class ThemeService {
  // Every fresh page load starts dark regardless of system preference or any
  // earlier toggle — the toggle switches the current session only (a product
  // decision carried over from the previous version).
  readonly theme = signal<Theme>('dark');

  private readonly doc = inject(DOCUMENT);
  private readonly zone = inject(NgZone);
  private readonly device = inject(DeviceService);
  private readonly perf = inject(PerfGuardService);

  /**
   * Flips the theme. When the browser supports View Transitions the new theme
   * is revealed as an expanding circle from `origin` (usually the toggle).
   */
  toggle(origin?: { x: number; y: number }): void {
    const next: Theme = this.theme() === 'dark' ? 'light' : 'dark';
    const apply = () =>
      this.zone.run(() => {
        this.theme.set(next);
        const root = this.doc.documentElement;
        root.setAttribute('data-theme', next);
        this.doc.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[next]);
      });

    const startTransition = this.doc.startViewTransition?.bind(this.doc);
    if (!startTransition || this.device.reducedMotion || this.perf.lite()) {
      apply();
      return;
    }

    const x = origin?.x ?? window.innerWidth - 48;
    const y = origin?.y ?? 40;
    const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));

    const transition = startTransition(apply);
    transition.ready
      .then(() =>
        this.doc.documentElement.animate(
          { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
          { duration: 650, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', pseudoElement: '::view-transition-new(root)' }
        )
      )
      .catch(() => undefined);
  }
}
