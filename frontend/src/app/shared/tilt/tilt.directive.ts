import { Directive, ElementRef, HostListener, Input, OnDestroy, Renderer2 } from '@angular/core';

/**
 * Subtle cursor-tracking 3D tilt, used on grid cards (tech stack, etc).
 * Skipped entirely on touch/coarse-pointer devices and when the user has
 * prefers-reduced-motion set — it's a hover accent, not a core interaction.
 */
@Directive({
  selector: '[appTilt]',
  standalone: true
})
export class TiltDirective implements OnDestroy {
  @Input() tiltMax = 6;

  private readonly enabled: boolean;
  private frame?: number;

  constructor(private readonly el: ElementRef<HTMLElement>, private readonly renderer: Renderer2) {
    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const isFinePointer = window.matchMedia?.('(hover: hover) and (pointer: fine)').matches;
    this.enabled = !prefersReducedMotion && !!isFinePointer;

    if (this.enabled) {
      this.renderer.setStyle(this.el.nativeElement, 'transition', 'transform 0.15s ease, box-shadow 0.2s ease');
      this.renderer.setStyle(this.el.nativeElement, 'will-change', 'transform');
    }
  }

  @HostListener('mousemove', ['$event'])
  onMouseMove(event: MouseEvent): void {
    if (!this.enabled) return;

    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = requestAnimationFrame(() => {
      const rect = this.el.nativeElement.getBoundingClientRect();
      const px = (event.clientX - rect.left) / rect.width;
      const py = (event.clientY - rect.top) / rect.height;
      const rotateX = (0.5 - py) * this.tiltMax;
      const rotateY = (px - 0.5) * this.tiltMax;

      this.renderer.setStyle(
        this.el.nativeElement,
        'transform',
        `perspective(700px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-2px)`
      );
    });
  }

  @HostListener('mouseleave')
  onMouseLeave(): void {
    if (!this.enabled) return;
    this.renderer.setStyle(this.el.nativeElement, 'transform', 'perspective(700px) rotateX(0) rotateY(0)');
  }

  ngOnDestroy(): void {
    if (this.frame) cancelAnimationFrame(this.frame);
  }
}
