import { Injectable, signal } from '@angular/core';

/** Shared open/closed state so both the palette overlay and any trigger
 * button (navbar, etc.) can control it without a parent/child wiring. */
@Injectable({ providedIn: 'root' })
export class CommandPaletteService {
  readonly isOpen = signal(false);

  open(): void {
    this.isOpen.set(true);
  }

  close(): void {
    this.isOpen.set(false);
  }

  toggle(): void {
    this.isOpen.update((value) => !value);
  }
}
