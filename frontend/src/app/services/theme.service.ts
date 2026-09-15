import { Injectable, effect, signal } from '@angular/core';

export type Theme = 'dark' | 'light';

// View Transitions API isn't yet in TypeScript's bundled DOM lib.
declare global {
  interface Document {
    startViewTransition?(callback: () => void): { ready: Promise<void>; finished: Promise<void> };
  }
}

@Injectable({ providedIn: 'root' })
export class ThemeService {
  // Every fresh page load always starts dark, regardless of system
  // preference or any previously toggled choice — the toggle can still
  // switch to light for the current session, but it isn't persisted.
  readonly theme = signal<Theme>('dark');

  constructor() {
    // `document` doesn't exist under SSR at all (platform-server never puts
    // it on the global scope), so this effect is a no-op server-side and
    // only ever applies the attribute in the browser.
    effect(() => {
      if (typeof document === 'undefined') return;
      document.documentElement.setAttribute('data-theme', this.theme());
    });
  }

  toggle(): void {
    const next = this.theme() === 'dark' ? 'light' : 'dark';
    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    // View Transitions gives a free crossfade between the old and new theme
    // screenshots — this is a single synchronous attribute flip with nothing
    // async inside it, unlike router navigation, so it settles immediately
    // rather than waiting on anything.
    if (!prefersReducedMotion && document.startViewTransition) {
      document.startViewTransition(() => this.theme.set(next));
    } else {
      this.theme.set(next);
    }
  }
}
