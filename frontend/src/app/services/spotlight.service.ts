import { Injectable, NgZone } from '@angular/core';
import { DeviceService } from './device.service';
import { PerfGuardService } from './perf-guard.service';

/**
 * Cursor spotlight on `.card` surfaces via ONE delegated pointer listener —
 * no per-card listeners, and only the hovered card's two CSS variables are
 * written (once per frame). The glow itself is a gradient layer defined in
 * styles/_ui.scss. Fine-pointer devices only.
 */
@Injectable({ providedIn: 'root' })
export class SpotlightService {
  private started = false;
  private raf = 0;
  private pending?: PointerEvent;

  constructor(
    private readonly device: DeviceService,
    private readonly perf: PerfGuardService,
    private readonly zone: NgZone
  ) {}

  start(): void {
    if (this.started || !this.device.isBrowser || !this.device.finePointer || this.device.reducedMotion) return;
    this.started = true;
    this.zone.runOutsideAngular(() => document.addEventListener('pointermove', this.onMove, { passive: true }));
  }

  private readonly onMove = (event: PointerEvent): void => {
    if (this.perf.lite()) return;
    this.pending = event;
    if (this.raf) return;
    this.raf = requestAnimationFrame(() => {
      this.raf = 0;
      const e = this.pending;
      const card = (e?.target as Element | null)?.closest?.<HTMLElement>('.card');
      if (!e || !card) return;
      const rect = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${e.clientX - rect.left}px`);
      card.style.setProperty('--my', `${e.clientY - rect.top}px`);
    });
  };
}
