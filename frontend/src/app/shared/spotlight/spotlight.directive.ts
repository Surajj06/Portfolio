import { Directive, ElementRef, NgZone, OnDestroy, OnInit } from '@angular/core';

/**
 * Cursor-reactive spotlight for glass-panel surfaces (cards, form panels) —
 * a soft radial glow that follows the pointer while hovering, via CSS custom
 * properties consumed by `.glass-panel::after` (see styles.scss). Desktop
 * fine-pointer only, inert under prefers-reduced-motion, and — like
 * tilt/magnetic — listens outside Angular's zone since it only ever mutates
 * styles directly.
 */
@Directive({
  selector: '[appSpotlight]',
  standalone: true
})
export class SpotlightDirective implements OnInit, OnDestroy {
  private readonly enabled: boolean;

  private readonly onMouseMove = (event: MouseEvent): void => {
    const rect = this.el.nativeElement.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    const style = this.el.nativeElement.style;
    style.setProperty('--spotlight-x', `${x}%`);
    style.setProperty('--spotlight-y', `${y}%`);
  };

  private readonly onMouseEnter = (): void => {
    this.el.nativeElement.style.setProperty('--spotlight-opacity', '1');
  };

  private readonly onMouseLeave = (): void => {
    this.el.nativeElement.style.setProperty('--spotlight-opacity', '0');
  };

  constructor(private readonly el: ElementRef<HTMLElement>, private readonly zone: NgZone) {
    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const isFinePointer = window.matchMedia?.('(hover: hover) and (pointer: fine)').matches;
    this.enabled = !prefersReducedMotion && !!isFinePointer;
  }

  ngOnInit(): void {
    if (!this.enabled) return;
    this.zone.runOutsideAngular(() => {
      this.el.nativeElement.addEventListener('mousemove', this.onMouseMove);
      this.el.nativeElement.addEventListener('mouseenter', this.onMouseEnter);
      this.el.nativeElement.addEventListener('mouseleave', this.onMouseLeave);
    });
  }

  ngOnDestroy(): void {
    if (!this.enabled) return;
    this.el.nativeElement.removeEventListener('mousemove', this.onMouseMove);
    this.el.nativeElement.removeEventListener('mouseenter', this.onMouseEnter);
    this.el.nativeElement.removeEventListener('mouseleave', this.onMouseLeave);
  }
}
