import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, Input, NgZone, afterNextRender, inject } from '@angular/core';
import { DeviceService } from '../../services/device.service';
import { ScrollService } from '../../services/scroll.service';

/**
 * Infinite ticker. The list is rendered twice and the track slides by exactly
 * -50%, so the loop is seamless; the second copy is aria-hidden. The loop is a
 * pure CSS `transform` animation (compositor only — zero main-thread work),
 * paused while off-screen or hovered.
 *
 * The `lime` band is also scroll-reactive: while you scroll, its animation's
 * `playbackRate` ramps up (and the type skews slightly), then eases back.
 * Changing playbackRate keeps the animation on the compositor, and the
 * decay loop only runs while the band is actually off its resting state — so
 * at rest it costs nothing, unlike a JS-driven ticker.
 *
 * Variants: `lime` (solid accent band), `plain` (large type), `chips` (small
 * pill tags — used inside bento tiles).
 */
@Component({
  selector: 'app-marquee',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './marquee.component.html',
  styleUrl: './marquee.component.scss'
})
export class MarqueeComponent {
  @Input({ required: true }) items: readonly string[] = [];
  @Input() variant: 'lime' | 'plain' | 'chips' = 'plain';
  @Input() reverse = false;
  /** Seconds for one full loop. */
  @Input() duration = 48;

  readonly copies = [0, 1];

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly zone = inject(NgZone);
  private readonly device = inject(DeviceService);
  private readonly scroll = inject(ScrollService);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    afterNextRender(() => {
      const el = this.host.nativeElement;

      if (typeof IntersectionObserver !== 'undefined') {
        this.zone.runOutsideAngular(() => {
          const io = new IntersectionObserver(([entry]) => el.classList.toggle('is-off', !entry.isIntersecting), {
            rootMargin: '120px'
          });
          io.observe(el);
          this.destroyRef.onDestroy(() => io.disconnect());
        });
      }

      if (this.variant === 'lime' && !this.device.reducedMotion) this.reactToScroll(el);
    });
  }

  private reactToScroll(el: HTMLElement): void {
    const track = el.querySelector<HTMLElement>('.track');
    if (!track) return;

    let anim: Animation | undefined;
    let rate = 1;
    let skew = 0;
    let raf = 0;

    const apply = () => {
      anim?.updatePlaybackRate(rate);
      el.style.setProperty('--skew', `${skew.toFixed(2)}deg`);
    };

    const settle = () => {
      rate += (1 - rate) * 0.07;
      skew *= 0.88;
      if (Math.abs(rate - 1) < 0.015 && Math.abs(skew) < 0.04) {
        rate = 1;
        skew = 0;
        apply();
        raf = 0;
        return; // back at rest — stop looping
      }
      apply();
      raf = requestAnimationFrame(settle);
    };

    const off = this.scroll.subscribe(({ delta }) => {
      if (el.classList.contains('is-off')) return;
      anim ??= track.getAnimations().find((a) => (a as CSSAnimation).animationName?.startsWith('marquee'));
      if (!anim) return;
      const speed = delta * 60; // px per second, roughly
      rate = Math.min(7, 1 + Math.abs(speed) / 260);
      skew = Math.max(-7, Math.min(7, speed / -420));
      apply();
      if (!raf) raf = requestAnimationFrame(settle);
    });

    this.destroyRef.onDestroy(() => {
      off();
      cancelAnimationFrame(raf);
    });
  }
}
