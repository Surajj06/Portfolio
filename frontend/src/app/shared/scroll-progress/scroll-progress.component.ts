import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, ViewChild, afterNextRender, inject } from '@angular/core';
import { ScrollService } from '../../services/scroll.service';

/**
 * Thin reading-progress bar. Where the browser supports scroll-driven CSS
 * animations it runs with no JavaScript at all; elsewhere it falls back to the
 * shared ScrollService, using a cached max-scroll value (refreshed by a
 * ResizeObserver) so no layout is read while scrolling.
 */
@Component({
  selector: 'app-scroll-progress',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div #bar class="bar" aria-hidden="true"></div>`,
  styleUrl: './scroll-progress.component.scss'
})
export class ScrollProgressComponent {
  @ViewChild('bar', { static: true }) private readonly barRef!: ElementRef<HTMLElement>;

  private readonly scroll = inject(ScrollService);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    afterNextRender(() => {
      const bar = this.barRef.nativeElement;

      if (typeof CSS !== 'undefined' && CSS.supports('animation-timeline: scroll()')) {
        bar.classList.add('native');
        return;
      }

      let max = 1;
      const measure = () => (max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight));
      measure();
      const resizeObserver = new ResizeObserver(measure);
      resizeObserver.observe(document.body);

      const unsubscribe = this.scroll.subscribe(({ y }) => {
        bar.style.transform = `scaleX(${Math.min(1, y / max)})`;
      });

      this.destroyRef.onDestroy(() => {
        resizeObserver.disconnect();
        unsubscribe();
      });
    });
  }
}
