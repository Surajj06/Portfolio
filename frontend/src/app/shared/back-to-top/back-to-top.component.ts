import { Component, HostListener, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../icons/icon.component';
import { SmoothScrollService } from '../../services/smooth-scroll.service';

/**
 * Floating scroll-to-top control. Hidden until the visitor has scrolled
 * past roughly one viewport, so it never competes with the hero.
 */
@Component({
  selector: 'app-back-to-top',
  standalone: true,
  imports: [CommonModule, IconComponent],
  template: `
    <button
      type="button"
      class="back-to-top"
      [class.back-to-top-visible]="visible()"
      (click)="scrollToTop()"
      aria-label="Back to top"
      tabindex="0"
    >
      <app-icon name="arrow-up" [size]="18"></app-icon>
    </button>
  `,
  styleUrl: './back-to-top.component.scss'
})
export class BackToTopComponent {
  readonly visible = signal(false);

  constructor(private readonly smoothScroll: SmoothScrollService) {}

  @HostListener('window:scroll')
  onScroll(): void {
    this.visible.set(window.scrollY > window.innerHeight * 0.8);
  }

  scrollToTop(): void {
    this.smoothScroll.scrollTo(0);
  }
}
