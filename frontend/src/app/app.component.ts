import { Component, OnInit, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from './core/navbar/navbar.component';
import { FooterComponent } from './core/footer/footer.component';
import { ScrollProgressComponent } from './shared/scroll-progress/scroll-progress.component';
import { BackToTopComponent } from './shared/back-to-top/back-to-top.component';
import { CustomCursorComponent } from './shared/custom-cursor/custom-cursor.component';
import { CommandPaletteComponent } from './shared/command-palette/command-palette.component';
import { SmoothScrollService } from './services/smooth-scroll.service';
import { GsapService } from './services/gsap.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    NavbarComponent,
    FooterComponent,
    ScrollProgressComponent,
    BackToTopComponent,
    CustomCursorComponent,
    CommandPaletteComponent
  ],
  templateUrl: './app.component.html'
})
export class AppComponent implements OnInit {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  constructor(
    private readonly smoothScroll: SmoothScrollService,
    private readonly gsapService: GsapService
  ) {}

  ngOnInit(): void {
    if (!this.isBrowser) return;

    // Without this, the browser's own scroll restoration re-applies your
    // last scroll offset on every hard reload (e.g. a dev-server live
    // reload while scrolled mid-page) instead of starting fresh at the top.
    if ('scrollRestoration' in history) {
      history.scrollRestoration = 'manual';
    }

    // Force top-of-page on every fresh load, unconditionally — run now, and
    // again once every image/font has actually finished loading, since a
    // late-loading image resizing the hero can itself nudge the scroll
    // position after our first call already ran.
    window.scrollTo(0, 0);
    window.addEventListener('load', () => window.scrollTo(0, 0), { once: true });

    this.smoothScroll.init();
    this.gsapService.init();
  }
}
