import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/**
 * One-time, cached environment checks.
 *
 * Calling `matchMedia()` from every directive's init (as the previous version
 * did) forces a synchronous style recalculation each time, in the middle of
 * rendering — measured at >1s of main-thread time on a mid-range phone. Read
 * everything once, here, and share it.
 */
@Injectable({ providedIn: 'root' })
export class DeviceService {
  readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** User asked the OS for less motion — decorative animation must stay off. */
  readonly reducedMotion: boolean;
  /** A mouse/trackpad is the primary pointer (hover + precise). */
  readonly finePointer: boolean;
  /** Primary input is touch. */
  readonly coarsePointer: boolean;
  /** Data-saver is on, or the connection is very slow. */
  readonly saveData: boolean;
  /** Heuristic for clearly weak hardware (≤2 cores or ≤2 GB memory). */
  readonly lowEnd: boolean;

  constructor() {
    if (!this.isBrowser) {
      this.reducedMotion = false;
      this.finePointer = false;
      this.coarsePointer = false;
      this.saveData = false;
      this.lowEnd = false;
      return;
    }

    const match = (query: string) => window.matchMedia(query).matches;
    const nav = navigator as Navigator & {
      deviceMemory?: number;
      connection?: { saveData?: boolean; effectiveType?: string };
    };

    this.reducedMotion = match('(prefers-reduced-motion: reduce)');
    this.finePointer = match('(hover: hover) and (pointer: fine)');
    this.coarsePointer = match('(pointer: coarse)');
    this.saveData = !!nav.connection?.saveData || /(^|-)2g$/.test(nav.connection?.effectiveType ?? '');
    // Only clearly weak hardware counts here — plenty of good phones report 4
    // cores. Everything in between is judged by measured frame pacing instead
    // (see PerfGuardService).
    this.lowEnd = (nav.hardwareConcurrency ?? 8) <= 2 || (nav.deviceMemory ?? 8) <= 2;
  }

  /** Tiny haptic tick on touch devices — only inside a real user gesture (browsers block it otherwise). */
  haptic(ms = 8): void {
    if (!this.isBrowser || !this.coarsePointer) return;
    const activation = (navigator as Navigator & { userActivation?: { isActive: boolean } }).userActivation;
    if (activation && !activation.isActive) return;
    navigator.vibrate?.(ms);
  }

  /** Whether purely decorative, continuously-running motion is allowed. */
  get ambientMotion(): boolean {
    return this.isBrowser && !this.reducedMotion;
  }
}
