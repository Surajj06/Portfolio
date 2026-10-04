import { DestroyRef, Directive, ElementRef, Input, afterNextRender, booleanAttribute, inject } from '@angular/core';
import { MotionService } from '../../services/motion.service';

/**
 * Scroll-linked drift as an element's section scrolls away:
 * `<div [appParallax]="-70" parallaxFade>` moves it up 70px (and optionally
 * fades it) over the section's exit.
 *
 * Built on Motion's `scroll()` + `animate()`, which hands the animation to the
 * browser's native ScrollTimeline — the work happens on the compositor with no
 * JavaScript per scroll frame. Browsers without ScrollTimeline get no
 * parallax at all (never a JS-per-frame fallback), so it can't cost smoothness.
 */
@Directive({ selector: '[appParallax]', standalone: true })
export class ParallaxDirective {
  /** Pixels to travel over the section's exit (negative = up). */
  @Input({ alias: 'appParallax', required: true }) distance = -60;
  @Input({ transform: booleanAttribute }) parallaxFade = false;

  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly motion = inject(MotionService);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    afterNextRender(() => {
      this.motion.motion().then((m) => {
        if (!m || !m.supportsScrollTimeline()) return;
        const host = this.el.nativeElement;
        const section = host.closest<HTMLElement>('section') ?? host.parentElement;
        if (!section) return;

        const stop = this.motion.run(() => {
          const keyframes: Record<string, string[] | number[]> = {
            transform: ['translateY(0px)', `translateY(${this.distance}px)`]
          };
          if (this.parallaxFade) keyframes['opacity'] = [1, 0.25];
          return m.scroll(m.animate(host, keyframes, { ease: 'linear' }), {
            target: section,
            offset: ['start start', 'end start']
          });
        });
        this.destroyRef.onDestroy(() => stop());
      });
    });
  }
}
