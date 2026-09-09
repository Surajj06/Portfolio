import { AfterViewInit, Component, ElementRef, NgZone, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Thin fixed progress bar tracking scroll depth through the whole page.
 * Sits above the navbar (z-index higher) so it's always visible while
 * scrolling. Purely decorative — updates the DOM directly on every scroll
 * frame outside Angular's zone, since routing this through a signal/template
 * binding would trigger a full change-detection pass on every pixel scrolled.
 */
@Component({
  selector: 'app-scroll-progress',
  standalone: true,
  imports: [CommonModule],
  template: `<div #bar class="scroll-progress" aria-hidden="true"></div>`,
  styleUrl: './scroll-progress.component.scss'
})
export class ScrollProgressComponent implements AfterViewInit, OnDestroy {
  @ViewChild('bar', { static: true }) barRef!: ElementRef<HTMLElement>;

  private readonly onScroll = (): void => {
    const doc = document.documentElement;
    const scrollable = doc.scrollHeight - doc.clientHeight;
    const progress = scrollable > 0 ? Math.min(doc.scrollTop / scrollable, 1) : 0;
    this.barRef.nativeElement.style.transform = `scaleX(${progress})`;
  };

  constructor(private readonly zone: NgZone) {}

  ngAfterViewInit(): void {
    this.zone.runOutsideAngular(() => window.addEventListener('scroll', this.onScroll, { passive: true }));
  }

  ngOnDestroy(): void {
    window.removeEventListener('scroll', this.onScroll);
  }
}
