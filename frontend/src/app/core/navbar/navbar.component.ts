import { Component, NgZone, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../../shared/icons/icon.component';
import { PortfolioDataService } from '../../services/portfolio-data.service';
import { ThemeService } from '../../services/theme.service';

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

  private readonly onScroll = (): void => {
    const scrolled = window.scrollY > 12;
    const atTop = window.scrollY < 40;
    if (scrolled === this.isScrolled && !(atTop && this.activeFragment !== 'top')) return;
    this.zone.run(() => {
      this.isScrolled = scrolled;
      if (atTop) this.activeFragment = 'top';
    });
  };

  constructor(readonly data: PortfolioDataService, readonly theme: ThemeService, private readonly zone: NgZone) {}

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

    if (typeof IntersectionObserver === 'undefined') return;

    // Only observe fragments that exist on the current route (home page sections).
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
  }
}
