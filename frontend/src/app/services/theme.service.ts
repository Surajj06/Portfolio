import { Injectable, effect, signal } from '@angular/core';

export type Theme = 'dark' | 'light';

const STORAGE_KEY = 'portfolio-theme';

// View Transitions API isn't yet in TypeScript's bundled DOM lib.
declare global {
  interface Document {
    startViewTransition?(callback: () => void): { ready: Promise<void>; finished: Promise<void> };
  }
}

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly theme = signal<Theme>(this.readInitial());

  constructor() {
    effect(() => {
      const value = this.theme();
      document.documentElement.setAttribute('data-theme', value);
      localStorage.setItem(STORAGE_KEY, value);
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

  private readInitial(): Theme {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
    return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
}
