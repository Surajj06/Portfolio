import { Directive, ElementRef, Input, OnDestroy, OnInit, inject } from '@angular/core';
import { RevealService } from '../../services/reveal.service';

/**
 * Scroll-reveal: `<div appReveal>` (rise + fade), `appReveal="fade"`,
 * `appReveal="scale"`. `[revealDelay]` is a stagger *step* (0, 1, 2…) — each
 * step adds 80ms. Visibility is driven entirely by CSS (see styles/_motion.scss)
 * and one shared IntersectionObserver; with JS off the content is just visible.
 */
@Directive({
  selector: '[appReveal]',
  standalone: true,
  host: {
    '[attr.data-reveal]': 'mode',
    '[style.--d]': 'revealDelay'
  }
})
export class RevealDirective implements OnInit, OnDestroy {
  @Input('appReveal') mode: '' | 'fade' | 'scale' = '';
  @Input() revealDelay = 0;

  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly reveal = inject(RevealService);

  ngOnInit(): void {
    this.reveal.observe(this.el.nativeElement);
  }

  ngOnDestroy(): void {
    this.reveal.unobserve(this.el.nativeElement);
  }
}
