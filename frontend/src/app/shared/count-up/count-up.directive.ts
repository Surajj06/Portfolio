import { Directive, ElementRef, Input, NgZone, OnDestroy, OnInit } from '@angular/core';

/**
 * Animates the host element's text from 0 up to a target number when it
 * scrolls into view, once. Parses a leading integer out of `appCountUp` and
 * preserves whatever prefix/suffix surrounds it (e.g. "20,000+", "74+").
 * Inert (renders the final value immediately) under prefers-reduced-motion
 * or without IntersectionObserver support.
 */
@Directive({
  selector: '[appCountUp]',
  standalone: true
})
export class CountUpDirective implements OnInit, OnDestroy {
  @Input('appCountUp') value = '';
  @Input() countDuration = 1400;

  private observer?: IntersectionObserver;
  private raf?: number;

  constructor(private readonly el: ElementRef<HTMLElement>, private readonly zone: NgZone) {}

  ngOnInit(): void {
    const target = parseInt(this.value.replace(/[^0-9]/g, ''), 10);
    const prefix = this.value.match(/^[^0-9]*/)?.[0] ?? '';
    const suffix = this.value.match(/[^0-9]*$/)?.[0] ?? '';

    if (!Number.isFinite(target)) {
      this.el.nativeElement.textContent = this.value;
      return;
    }

    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const supportsObserver = typeof IntersectionObserver !== 'undefined';

    if (prefersReducedMotion || !supportsObserver) {
      this.el.nativeElement.textContent = this.value;
      return;
    }

    // Same anchor-jump edge case as RevealDirective: if we're already
    // scrolled past this element when it initializes, it'll never intersect,
    // so counting up from 0 would leave it stuck at 0 forever.
    if (this.el.nativeElement.getBoundingClientRect().bottom < 0) {
      this.el.nativeElement.textContent = this.value;
      return;
    }

    this.el.nativeElement.textContent = `${prefix}0${suffix}`;

    this.zone.runOutsideAngular(() => {
      this.observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              this.animate(target, prefix, suffix);
              this.observer?.unobserve(entry.target);
            }
          }
        },
        { threshold: 0.4 }
      );
      this.observer.observe(this.el.nativeElement);
    });
  }

  private animate(target: number, prefix: string, suffix: string): void {
    const start = performance.now();
    const easeOutQuad = (t: number) => t * (2 - t);

    const step = (now: number) => {
      const progress = Math.min((now - start) / this.countDuration, 1);
      const current = Math.round(target * easeOutQuad(progress));
      this.el.nativeElement.textContent = `${prefix}${current.toLocaleString('en-IN')}${suffix}`;

      if (progress < 1) {
        this.raf = requestAnimationFrame(step);
      }
    };

    this.raf = requestAnimationFrame(step);
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    if (this.raf) cancelAnimationFrame(this.raf);
  }
}
