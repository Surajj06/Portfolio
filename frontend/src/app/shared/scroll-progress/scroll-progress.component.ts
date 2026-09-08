import { Component, HostListener, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Thin fixed progress bar tracking scroll depth through the whole page.
 * Sits above the navbar (z-index higher) so it's always visible while
 * scrolling. Purely decorative — width is a plain CSS var, no layout thrash.
 */
@Component({
  selector: 'app-scroll-progress',
  standalone: true,
  imports: [CommonModule],
  template: `<div class="scroll-progress" [style.transform]="'scaleX(' + progress() + ')'" aria-hidden="true"></div>`,
  styleUrl: './scroll-progress.component.scss'
})
export class ScrollProgressComponent {
  readonly progress = signal(0);

  @HostListener('window:scroll')
  onScroll(): void {
    const doc = document.documentElement;
    const scrollable = doc.scrollHeight - doc.clientHeight;
    this.progress.set(scrollable > 0 ? Math.min(doc.scrollTop / scrollable, 1) : 0);
  }
}
