import { Directive, ElementRef, Input, OnDestroy, OnInit, PLATFORM_ID, Renderer2, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/**
 * Lightweight scroll-reveal directive backed by IntersectionObserver.
 * Used sparingly (section openers, not every card) so motion stays purposeful.
 * Fully inert when prefers-reduced-motion is set, or if IntersectionObserver
 * is unavailable (SSR / very old browsers) — content just renders visible.
 *
 * Replays every time the element enters/leaves the viewport (toggles the
 * class both ways) rather than revealing once and staying visible forever —
 * this also means anchor-link navigation that jumps straight to a section
 * (skipping ones above it) still gets the correct visibility immediately,
 * since the observer's first callback reports the true current state.
 */
@Directive({
  selector: '[appReveal]',
  standalone: true
})
export class RevealDirective implements OnInit, OnDestroy {
  @Input() revealDelay = 0;

  private observer?: IntersectionObserver;

  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  constructor(private readonly el: ElementRef<HTMLElement>, private readonly renderer: Renderer2) {}

  ngOnInit(): void {
    this.renderer.addClass(this.el.nativeElement, 'reveal');

    // No scroll/IntersectionObserver on the server — render content visible
    // outright so prerendered HTML never ships hidden (opacity: 0) copy.
    if (!this.isBrowser) {
      this.renderer.addClass(this.el.nativeElement, 'reveal-visible');
      return;
    }

    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const supportsObserver = typeof IntersectionObserver !== 'undefined';

    if (prefersReducedMotion || !supportsObserver) {
      this.renderer.addClass(this.el.nativeElement, 'reveal-visible');
      return;
    }

    if (this.revealDelay) {
      this.el.nativeElement.style.setProperty('--reveal-delay', `${this.revealDelay}ms`);
    }

    this.observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const method = entry.isIntersecting ? 'addClass' : 'removeClass';
          this.renderer[method](this.el.nativeElement, 'reveal-visible');
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
