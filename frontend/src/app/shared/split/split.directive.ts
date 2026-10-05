import { DestroyRef, Directive, ElementRef, Input, NgZone, afterNextRender, inject } from '@angular/core';
import { MotionService, GsapKit } from '../../services/motion.service';
import { RevealService } from '../../services/reveal.service';

/**
 * Kinetic text: `<h2 appSplit>` — once GSAP is available the heading is split
 * into lines (each in an overflow mask) that slide up in sequence as it
 * scrolls into view. `appSplit="words"` splits by word instead.
 *
 * Progressive enhancement: the CSS baseline (styles/_motion.scss) fades the
 * heading in via the shared IntersectionObserver, so with no JS, reduced
 * motion, lite mode, or before GSAP has loaded, the text still appears — just
 * without the line-by-line choreography. If GSAP only arrives after the
 * heading is already visible, it is simply left alone (no replay flash).
 *
 * Splitting measures layout, so it is deferred until a heading is within
 * ~1.5 screens of the viewport — never all headings at once after load.
 */
@Directive({
  selector: '[appSplit]',
  standalone: true,
  host: { '[attr.data-split]': 'mode' }
})
export class SplitDirective {
  @Input('appSplit') set kind(value: '' | 'lines' | 'words') {
    this.mode = value === 'words' ? 'words' : 'lines';
  }
  mode: 'lines' | 'words' = 'lines';

  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly motion = inject(MotionService);
  private readonly reveal = inject(RevealService);
  private readonly zone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    afterNextRender(() => {
      const host = this.el.nativeElement;
      this.reveal.observe(host); // baseline: IntersectionObserver adds `.in`

      let ctx: { revert(): void } | undefined;
      let near: IntersectionObserver | undefined;

      if (typeof IntersectionObserver !== 'undefined' && this.motion.allowed) {
        this.zone.runOutsideAngular(() => {
          near = new IntersectionObserver(
            ([entry]) => {
              if (!entry.isIntersecting) return;
              near?.disconnect();
              this.motion.gsap().then((kit) => {
                if (!kit || !host.isConnected || host.classList.contains('in')) return;
                ctx = this.motion.run(() => kit.gsap.context(() => this.split(kit, host), host));
              });
            },
            { rootMargin: '150% 0px 150% 0px' }
          );
          near.observe(host);
        });
      }

      this.destroyRef.onDestroy(() => {
        near?.disconnect();
        this.reveal.unobserve(host);
        ctx?.revert();
      });
    });
  }

  private split(kit: GsapKit, host: HTMLElement): void {
    const unit = this.mode;
    // Plays once, when the heading's top crosses ~90% of the viewport height.
    // (A plain IntersectionObserver — GSAP's ScrollTrigger runs a permanent
    // requestAnimationFrame loop, which is not worth it for this.)
    let played = false;
    let tween: { play(): unknown; progress(value: number): unknown } | undefined;
    let io: IntersectionObserver | undefined;

    kit.SplitText.create(host, {
      type: unit,
      mask: unit,
      linesClass: 'split-line',
      wordsClass: 'split-word',
      // Re-splits on font load / width change so line breaks are always right.
      autoSplit: true,
      onSplit: (self) => {
        const targets = unit === 'words' ? self.words : self.lines;
        kit.gsap.set(targets, { yPercent: 118 });
        host.classList.add('is-split'); // host becomes visible; the lines are still masked
        const next = kit.gsap.to(targets, {
          yPercent: 0,
          duration: 1.1,
          ease: 'power4.out',
          stagger: unit === 'words' ? 0.05 : 0.09,
          paused: true
        });
        tween = next;
        if (played) {
          next.progress(1); // a re-split after the reveal must not replay it
        } else if (!io) {
          io = new IntersectionObserver(
            ([entry]) => {
              if (!entry.isIntersecting) return;
              played = true;
              io?.disconnect();
              tween?.play();
            },
            { rootMargin: '0px 0px -10% 0px' }
          );
          io.observe(host);
        }
        return next;
      }
    });
  }
}
