import { Directive, ElementRef, Input, NgZone, OnDestroy, OnInit, Renderer2 } from '@angular/core';

/**
 * Subtle cursor-tracking 3D tilt, used on grid cards (tech stack, etc).
 * Skipped entirely on touch/coarse-pointer devices and when the user has
 * prefers-reduced-motion set — it's a hover accent, not a core interaction.
 * Listens outside Angular's zone since it only ever mutates styles directly
 * (via Renderer2), never anything change-detection needs to know about.
 */
@Directive({
  selector: '[appTilt]',
  standalone: true
})
export class TiltDirective implements OnInit, OnDestroy {
  @Input() tiltMax = 6;

  private readonly enabled: boolean;
  private frame?: number;

  private readonly onMouseMove = (event: MouseEvent): void => {
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
  };

  private readonly onMouseLeave = (): void => {
    this.renderer.setStyle(this.el.nativeElement, 'transform', 'perspective(700px) rotateX(0) rotateY(0)');
  };

  constructor(
    private readonly el: ElementRef<HTMLElement>,
    private readonly renderer: Renderer2,
    private readonly zone: NgZone
  ) {
    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const isFinePointer = window.matchMedia?.('(hover: hover) and (pointer: fine)').matches;
    this.enabled = !prefersReducedMotion && !!isFinePointer;

    if (this.enabled) {
      this.renderer.setStyle(this.el.nativeElement, 'transition', 'transform 0.15s ease, box-shadow 0.2s ease');
      this.renderer.setStyle(this.el.nativeElement, 'will-change', 'transform');
    }
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
