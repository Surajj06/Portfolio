import { DestroyRef, Directive, ElementRef, Input, NgZone, afterNextRender, inject } from '@angular/core';
import { DeviceService } from '../../services/device.service';

/**
 * Counts the host's number up from 0 when it scrolls into view, once. Parses
 * the digits out of `appCountUp` and keeps whatever surrounds them ("20,000+",
 * "74+"). The server (and no-JS / reduced-motion visitors) get the real final
 * value straight from the template; the decision to animate is made from the
 * IntersectionObserver's first callback, so no layout is read to decide it.
 */
@Directive({ selector: '[appCountUp]', standalone: true })
export class CountUpDirective {
  @Input({ alias: 'appCountUp', required: true }) value = '';
  @Input() countDuration = 1600;

  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly zone = inject(NgZone);
  private readonly device = inject(DeviceService);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    afterNextRender(() => {
      if (this.device.reducedMotion || typeof IntersectionObserver === 'undefined') return;

      const digits = this.value.replace(/[^0-9]/g, '');
      const target = parseInt(digits, 10);
      if (!Number.isFinite(target) || target < 2) return;
      const prefix = this.value.match(/^[^0-9]*/)?.[0] ?? '';
      const suffix = this.value.match(/[^0-9]*$/)?.[0] ?? '';
      const host = this.el.nativeElement;
      let raf = 0;

      const run = () => {
        const start = performance.now();
        const step = (now: number) => {
          const t = Math.min(1, (now - start) / this.countDuration);
          const eased = 1 - Math.pow(1 - t, 4); // easeOutQuart
          host.textContent = `${prefix}${Math.round(target * eased).toLocaleString('en-IN')}${suffix}`;
          if (t < 1) raf = requestAnimationFrame(step);
        };
        raf = requestAnimationFrame(step);
      };

      this.zone.runOutsideAngular(() => {
        const io = new IntersectionObserver(
          ([entry]) => {
            if (entry.isIntersecting) {
              run();
              io.disconnect();
            } else {
              host.textContent = `${prefix}0${suffix}`; // below the fold: arm at zero
            }
          },
          { threshold: 0.6 }
        );
        io.observe(host);
        this.destroyRef.onDestroy(() => {
          io.disconnect();
          cancelAnimationFrame(raf);
        });
      });
    });
  }
}
