import { Component, NgZone, OnDestroy, OnInit, signal } from '@angular/core';
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
export class BackToTopComponent implements OnInit, OnDestroy {
  readonly visible = signal(false);

  private readonly onScroll = (): void => {
    const shouldShow = window.scrollY > window.innerHeight * 0.8;
    if (shouldShow !== this.visible()) {
      this.zone.run(() => this.visible.set(shouldShow));
    }
  };

  constructor(private readonly smoothScroll: SmoothScrollService, private readonly zone: NgZone) {}

  ngOnInit(): void {
    // Runs on every scroll frame — only re-enters the zone when the visible
    // state actually flips, since that's the only case that needs a re-render.
    this.zone.runOutsideAngular(() => window.addEventListener('scroll', this.onScroll, { passive: true }));
  }

  ngOnDestroy(): void {
    window.removeEventListener('scroll', this.onScroll);
  }

  scrollToTop(): void {
    this.smoothScroll.scrollTo(0);
  }
}
