import { DestroyRef, Directive, ElementRef, Input, NgZone, afterNextRender, inject } from '@angular/core';
import { DeviceService } from '../../services/device.service';
import { PerfGuardService } from '../../services/perf-guard.service';

/**
 * Subtle 3D tilt toward the pointer, for one hero element (the portrait).
 * Fine-pointer only. Uses the standalone `rotate`-free approach of writing a
 * single `transform` per frame; geometry is measured once on enter.
 */
@Directive({ selector: '[appTilt]', standalone: true })
export class TiltDirective {
  /** Max rotation in degrees. */
  @Input() tiltMax = 7;

  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly zone = inject(NgZone);
  private readonly device = inject(DeviceService);
  private readonly perf = inject(PerfGuardService);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    afterNextRender(() => {
      if (!this.device.finePointer || this.device.reducedMotion) return;
      const el = this.el.nativeElement;
      let rect: DOMRect | undefined;
      let raf = 0;
      let transform = '';

      const apply = () => {
        raf = 0;
        el.style.transform = transform;
      };
      const onEnter = () => {
        rect = el.getBoundingClientRect();
        el.style.transition = 'transform 0.18s ease-out';
      };
      const onMove = (e: PointerEvent) => {
        if (!rect || this.perf.lite()) return;
        const px = (e.clientX - rect.left) / rect.width - 0.5;
        const py = (e.clientY - rect.top) / rect.height - 0.5;
        transform = `perspective(900px) rotateX(${(-py * this.tiltMax).toFixed(2)}deg) rotateY(${(px * this.tiltMax).toFixed(2)}deg)`;
        if (!raf) raf = requestAnimationFrame(apply);
      };
      const onLeave = () => {
        cancelAnimationFrame(raf);
        raf = 0;
        rect = undefined;
        el.style.transition = 'transform 0.7s cubic-bezier(0.22, 1, 0.36, 1)';
        el.style.transform = '';
      };

      this.zone.runOutsideAngular(() => {
        el.addEventListener('pointerenter', onEnter, { passive: true });
        el.addEventListener('pointermove', onMove, { passive: true });
        el.addEventListener('pointerleave', onLeave, { passive: true });
      });
      this.destroyRef.onDestroy(() => {
        cancelAnimationFrame(raf);
        el.removeEventListener('pointerenter', onEnter);
        el.removeEventListener('pointermove', onMove);
        el.removeEventListener('pointerleave', onLeave);
      });
    });
  }
}
