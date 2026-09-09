import { Component, NgZone, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter } from 'rxjs/operators';
import { Subscription } from 'rxjs';
import { IconComponent } from '../../shared/icons/icon.component';
import { PortfolioDataService } from '../../services/portfolio-data.service';
import { ThemeService } from '../../services/theme.service';
import { CommandPaletteService } from '../../shared/command-palette/command-palette.service';

interface NavLink {
  label: string;
  fragment: string;
}

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterLink, IconComponent],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss'
})
export class NavbarComponent implements OnInit, OnDestroy {
  readonly links: NavLink[] = [
    { label: 'Home', fragment: 'top' },
    { label: 'About', fragment: 'about' },
    { label: 'Experience', fragment: 'experience' },
    { label: 'Projects', fragment: 'projects' },
    { label: 'Skills', fragment: 'skills' },
    { label: 'Systems', fragment: 'systems' },
    { label: 'Contact', fragment: 'contact' }
  ];

  isScrolled = false;
  isMenuOpen = false;
  activeFragment = 'top';

  private observer?: IntersectionObserver;
  private readonly visibleRatios = new Map<string, number>();
  private navigationSubscription?: Subscription;

  private readonly onScroll = (): void => {
    const scrolled = window.scrollY > 12;
    const atTop = window.scrollY < 40;
    if (scrolled === this.isScrolled && !(atTop && this.activeFragment !== 'top')) return;
    this.zone.run(() => {
      this.isScrolled = scrolled;
      if (atTop) this.activeFragment = 'top';
    });
  };

  constructor(
    readonly data: PortfolioDataService,
    readonly theme: ThemeService,
    readonly commandPalette: CommandPaletteService,
    private readonly zone: NgZone,
    private readonly router: Router
  ) {}

  /** First name plain, rest of the name in the accent — the brand mark
   * (replaces the old "</>" icon lockup). */
  get firstName(): string {
    return this.data.profile.name.split(' ')[0];
  }

  get restOfName(): string {
    return this.data.profile.name.split(' ').slice(1).join(' ');
  }

  ngOnInit(): void {
    this.zone.runOutsideAngular(() => window.addEventListener('scroll', this.onScroll, { passive: true }));

    // This component (declared directly in AppComponent's template) finishes
    // its own ngOnInit synchronously during the app's initial render, which
    // is BEFORE the router-outlet's content activates -- Router navigation
    // resolves asynchronously even for an eager-loaded route. Querying
    // document.getElementById('projects') etc. here would always return
    // null, so section observation is (re)built after every completed
    // navigation instead, once the section elements actually exist.
    this.setupSectionObserver();
    this.navigationSubscription = this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      // A macrotask tick after NavigationEnd, rather than calling this
      // synchronously in the subscription, to be sure the activated route's
      // view has actually flushed to the DOM before we go looking for it.
      .subscribe(() => setTimeout(() => this.setupSectionObserver()));
  }

  private setupSectionObserver(): void {
    if (typeof IntersectionObserver === 'undefined') return;

    this.observer?.disconnect();
    this.visibleRatios.clear();

    const sections = this.links
      .map((link) => document.getElementById(link.fragment))
      .filter((el): el is HTMLElement => !!el);

    if (!sections.length) return;

    this.zone.runOutsideAngular(() => {
      this.observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            this.visibleRatios.set(entry.target.id, entry.isIntersecting ? entry.intersectionRatio : 0);
          }
          let topId = this.activeFragment;
          let topRatio = 0;
          for (const [id, ratio] of this.visibleRatios) {
            if (ratio > topRatio) {
              topRatio = ratio;
              topId = id;
            }
          }
          if (topRatio > 0 && topId !== this.activeFragment) {
            this.zone.run(() => (this.activeFragment = topId));
          }
        },
        { threshold: [0, 0.25, 0.5, 0.75, 1], rootMargin: '-15% 0px -55% 0px' }
      );

      sections.forEach((el) => this.observer!.observe(el));
    });
  }

  toggleMenu(): void {
    this.isMenuOpen = !this.isMenuOpen;
  }

  closeMenu(): void {
    this.isMenuOpen = false;
  }

  ngOnDestroy(): void {
    window.removeEventListener('scroll', this.onScroll);
    this.observer?.disconnect();
    this.navigationSubscription?.unsubscribe();
  }
}
