import { Directive, ElementRef, Input, NgZone, OnDestroy, OnInit, Renderer2 } from '@angular/core';

/**
 * Makes a button/link drift slightly toward the cursor while hovered, then
 * spring back on leave — a small, tasteful "magnetic" nudge for primary
 * calls to action. Desktop fine-pointer only; inert under
 * prefers-reduced-motion. Listens outside Angular's zone since it only ever
 * mutates styles directly, never anything change-detection needs to know about.
 */
@Directive({
  selector: '[appMagnetic]',
  standalone: true
})
export class MagneticDirective implements OnInit, OnDestroy {
  @Input() magneticStrength = 0.35;

  private readonly enabled: boolean;
  private frame?: number;

  private readonly onMouseMove = (event: MouseEvent): void => {
    if (this.frame) cancelAnimationFrame(this.frame);

    this.frame = requestAnimationFrame(() => {
      const rect = this.el.nativeElement.getBoundingClientRect();
      const relX = event.clientX - (rect.left + rect.width / 2);
      const relY = event.clientY - (rect.top + rect.height / 2);
      this.renderer.setStyle(
        this.el.nativeElement,
        'transform',
        `translate(${relX * this.magneticStrength}px, ${relY * this.magneticStrength}px)`
      );
    });
  };

  private readonly onMouseLeave = (): void => {
    this.renderer.setStyle(this.el.nativeElement, 'transform', 'translate(0, 0)');
  };

  constructor(
    private readonly el: ElementRef<HTMLElement>,
    private readonly renderer: Renderer2,
    private readonly zone: NgZone
  ) {
    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const isFinePointer = window.matchMedia?.('(hover: hover) and (pointer: fine)').matches;
    this.enabled = !prefersReducedMotion && !!isFinePointer;
  }

  ngOnInit(): void {
    if (!this.enabled) return;
    this.zone.runOutsideAngular(() => {
      this.el.nativeElement.addEventListener('mousemove', this.onMouseMove);
      this.el.nativeElement.addEventListener('mouseleave', this.onMouseLeave);
    });
  }

  ngOnDestroy(): void {
    if (this.frame) cancelAnimationFrame(this.frame);
    if (this.enabled) {
      this.el.nativeElement.removeEventListener('mousemove', this.onMouseMove);
      this.el.nativeElement.removeEventListener('mouseleave', this.onMouseLeave);
    }
  }
}
