import { Directive, ElementRef, Input, OnDestroy, OnInit, Renderer2 } from '@angular/core';

/**
 * Lightweight scroll-reveal directive backed by IntersectionObserver.
 * Used sparingly (section openers, not every card) so motion stays purposeful.
 * Fully inert when prefers-reduced-motion is set, or if IntersectionObserver
 * is unavailable (SSR / very old browsers) — content just renders visible.
 */
@Directive({
  selector: '[appReveal]',
  standalone: true
})
export class RevealDirective implements OnInit, OnDestroy {
  @Input() revealDelay = 0;

  private observer?: IntersectionObserver;

  constructor(private readonly el: ElementRef<HTMLElement>, private readonly renderer: Renderer2) {}

  ngOnInit(): void {
    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const supportsObserver = typeof IntersectionObserver !== 'undefined';

    this.renderer.addClass(this.el.nativeElement, 'reveal');

    if (prefersReducedMotion || !supportsObserver) {
      this.renderer.addClass(this.el.nativeElement, 'reveal-visible');
      return;
    }

    // Anchor-link navigation (e.g. clicking "About" in the navbar) can jump
    // straight past an earlier section without it ever crossing the
    // viewport, so its IntersectionObserver never fires and it stays
    // invisible forever. If we're initializing already scrolled past this
    // element, just show it — there's no scroll-into-view moment coming.
    const rect = this.el.nativeElement.getBoundingClientRect();
    if (rect.bottom < 0) {
      this.renderer.addClass(this.el.nativeElement, 'reveal-visible');
      return;
    }

    if (this.revealDelay) {
      this.el.nativeElement.style.setProperty('--reveal-delay', `${this.revealDelay}ms`);
    }

    this.observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            this.renderer.addClass(this.el.nativeElement, 'reveal-visible');
            this.observer?.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -60px 0px' }
    );

    this.observer.observe(this.el.nativeElement);
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }
}
