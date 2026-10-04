import { DestroyRef, Directive, ElementRef, Input, NgZone, afterNextRender, inject } from '@angular/core';
import { DeviceService } from '../../services/device.service';
import { PerfGuardService } from '../../services/perf-guard.service';

/**
 * Buttons drift slightly toward the pointer and spring back on leave. Uses
 * the standalone CSS `translate` property so it never fights a button's own
 * `transform` (hover lift, press-scale). Fine-pointer devices only; the rect
 * is measured once on enter, not on every move.
 */
@Directive({ selector: '[appMagnetic]', standalone: true })
export class MagneticDirective {
  @Input() magneticStrength = 0.28;

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
      let x = 0;
      let y = 0;

      const apply = () => {
        raf = 0;
        el.style.translate = `${x}px ${y}px`;
      };
      const onEnter = () => {
        rect = el.getBoundingClientRect();
        el.style.transition = 'translate 0.12s linear';
      };
      const onMove = (e: PointerEvent) => {
        if (!rect || this.perf.lite()) return;
        x = (e.clientX - (rect.left + rect.width / 2)) * this.magneticStrength;
        y = (e.clientY - (rect.top + rect.height / 2)) * this.magneticStrength;
        if (!raf) raf = requestAnimationFrame(apply);
      };
      const onLeave = () => {
        cancelAnimationFrame(raf);
        raf = 0;
        rect = undefined;
        el.style.transition = 'translate 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)';
        el.style.translate = '0px 0px';
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
