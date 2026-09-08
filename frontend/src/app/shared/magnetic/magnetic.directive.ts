import { Directive, ElementRef, HostListener, Input, OnDestroy, Renderer2 } from '@angular/core';

/**
 * Makes a button/link drift slightly toward the cursor while hovered, then
 * spring back on leave — a small, tasteful "magnetic" nudge for primary
 * calls to action. Desktop fine-pointer only; inert under
 * prefers-reduced-motion.
 */
@Directive({
  selector: '[appMagnetic]',
  standalone: true
})
export class MagneticDirective implements OnDestroy {
  @Input() magneticStrength = 0.35;

  private readonly enabled: boolean;
  private frame?: number;

  constructor(private readonly el: ElementRef<HTMLElement>, private readonly renderer: Renderer2) {
    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const isFinePointer = window.matchMedia?.('(hover: hover) and (pointer: fine)').matches;
    this.enabled = !prefersReducedMotion && !!isFinePointer;
  }

  @HostListener('mousemove', ['$event'])
  onMouseMove(event: MouseEvent): void {
    if (!this.enabled) return;
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
  }

  @HostListener('mouseleave')
  onMouseLeave(): void {
    if (!this.enabled) return;
    this.renderer.setStyle(this.el.nativeElement, 'transform', 'translate(0, 0)');
  }

  ngOnDestroy(): void {
    if (this.frame) cancelAnimationFrame(this.frame);
  }
}
