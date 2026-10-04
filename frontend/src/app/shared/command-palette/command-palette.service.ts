import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/**
 * Open/closed state for the Ctrl/Cmd+K palette. The palette *component* is
 * lazy-loaded (see app.component.html) and only requested the first time it's
 * opened, so this tiny service owns the global shortcut and `wanted` flag.
 */
@Injectable({ providedIn: 'root' })
export class CommandPaletteService {
  readonly isOpen = signal(false);
  /** Flips true on first open — that's what triggers the lazy chunk to load. */
  readonly wanted = signal(false);

  constructor() {
    if (!isPlatformBrowser(inject(PLATFORM_ID))) return;
    window.addEventListener('keydown', (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        this.toggle();
      }
    });
  }

  open(): void {
    this.wanted.set(true);
    this.isOpen.set(true);
  }

  close(): void {
    this.isOpen.set(false);
  }

  toggle(): void {
    this.isOpen() ? this.close() : this.open();
  }
}
