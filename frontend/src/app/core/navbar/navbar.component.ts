import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, NgZone, ViewChild, afterNextRender, inject, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { IconComponent } from '../../shared/icons/icon.component';
import { ScrambleDirective } from '../../shared/scramble/scramble.directive';
import { PortfolioDataService } from '../../services/portfolio-data.service';
import { ThemeService } from '../../services/theme.service';
import { ScrollService } from '../../services/scroll.service';
import { SectionScrollService } from '../../services/section-scroll.service';
import { DeviceService } from '../../services/device.service';
import { CommandPaletteService } from '../../shared/command-palette/command-palette.service';

/**
 * Site navigation. Desktop: a floating glass pill with a sliding active
 * indicator that tucks away while scrolling down and returns on scroll-up.
 * Phones: a thumb-reach bottom dock plus a "More" bottom sheet.
 *
 * Scroll work goes through the shared ScrollService (no layout reads), active
 * section tracking uses one IntersectionObserver, and template state is only
 * touched (inside the zone) when something actually changes.
 */
@Component({
  selector: 'app-navbar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, ScrambleDirective],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss'
})
export class NavbarComponent {
  @ViewChild('pill', { static: true }) private readonly pillRef!: ElementRef<HTMLElement>;
  @ViewChild('ind', { static: true }) private readonly indRef!: ElementRef<HTMLElement>;
  @ViewChild('dock', { static: true }) private readonly dockRef!: ElementRef<HTMLElement>;
  @ViewChild('sheet', { static: true }) private readonly sheetRef!: ElementRef<HTMLDialogElement>;

  readonly data = inject(PortfolioDataService);
  readonly theme = inject(ThemeService);
  readonly palette = inject(CommandPaletteService);
  private readonly router = inject(Router);
  private readonly zone = inject(NgZone);
  private readonly scroll = inject(ScrollService);
  private readonly sections = inject(SectionScrollService);
  private readonly device = inject(DeviceService);
  private readonly destroyRef = inject(DestroyRef);

  readonly desktopLinks = this.data.nav.filter((n) => n.desktop);
  readonly dockLinks = this.data.nav.filter((n) => n.dock);

  readonly active = signal('top');
  readonly scrolled = signal(false);
  readonly hidden = signal(false);

  private observer?: IntersectionObserver;

  constructor() {
    afterNextRender(() => {
      this.zone.runOutsideAngular(() => {
        this.trackScroll();
        this.keepDockClearOfKeyboard();
        this.watchPillSize();
      });

      // Sections only exist once the route has rendered, and again after
      // every navigation back to the home page.
      this.observeSections();
      const sub = this.router.events.subscribe((event) => {
        if (event instanceof NavigationEnd) setTimeout(() => this.observeSections());
      });
      this.destroyRef.onDestroy(() => {
        sub.unsubscribe();
        this.observer?.disconnect();
      });
    });
  }

  /** In-page section navigation (see SectionScrollService). */
  go(id: string, event: Event): void {
    event.preventDefault();
    this.closeMenu();
    this.device.haptic(8);
    this.sections.go(id);
  }

  openMenu(): void {
    this.sheetRef.nativeElement.showModal();
  }

  closeMenu(): void {
    const sheet = this.sheetRef.nativeElement;
    if (sheet.open) sheet.close();
  }

  onSheetClick(event: MouseEvent): void {
    if (event.target === this.sheetRef.nativeElement) this.closeMenu();
  }

  private trackScroll(): void {
    const off = this.scroll.subscribe(({ y, dir, delta }) => {
      const scrolled = y > 24;
      let hide = this.hidden();
      if (y < 240) hide = false;
      else if (dir === 1 && delta > 6) hide = true;
      else if (dir === -1 && delta < -6) hide = false;

      if (scrolled !== this.scrolled() || hide !== this.hidden()) {
        this.zone.run(() => {
          this.scrolled.set(scrolled);
          this.hidden.set(hide);
        });
      }
    });
    this.destroyRef.onDestroy(off);
  }

  private observeSections(): void {
    if (typeof IntersectionObserver === 'undefined') return;
    this.observer?.disconnect();

    const sections = this.data.nav
      .map((n) => document.getElementById(n.id))
      .filter((el): el is HTMLElement => !!el);
    if (!sections.length) return;

    this.zone.runOutsideAngular(() => {
      // A thin band across the middle of the viewport: whichever section is
      // under it is the "current" one.
      this.observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) if (entry.isIntersecting) this.setActive(entry.target.id);
        },
        { rootMargin: '-45% 0px -50% 0px' }
      );
      sections.forEach((el) => this.observer!.observe(el));
    });
  }

  private setActive(id: string): void {
    if (id === this.active()) return;
    this.zone.run(() => this.active.set(id));
    this.moveIndicator();
  }

  private moveIndicator(): void {
    const pill = this.pillRef.nativeElement;
    const ind = this.indRef.nativeElement;
    const link = pill.querySelector<HTMLElement>(`[data-id="${this.active()}"]`);
    if (!link) {
      ind.style.opacity = '0';
      return;
    }
    ind.style.opacity = '1';
    ind.style.width = `${link.offsetWidth}px`;
    ind.style.transform = `translate3d(${link.offsetLeft}px, 0, 0)`;
  }

  /** Re-seat the indicator when the pill changes size (webfont swap, resize). */
  private watchPillSize(): void {
    const observer = new ResizeObserver(() => this.moveIndicator());
    observer.observe(this.pillRef.nativeElement);
    this.destroyRef.onDestroy(() => observer.disconnect());
  }

  /** The bottom dock steps aside while a text field has focus (on-screen keyboard). */
  private keepDockClearOfKeyboard(): void {
    const dock = this.dockRef.nativeElement;
    const isField = (e: Event) => (e.target as Element | null)?.matches?.('input, textarea');
    const hide = (e: Event) => isField(e) && dock.classList.add('is-away');
    const show = (e: Event) => isField(e) && dock.classList.remove('is-away');
    document.addEventListener('focusin', hide);
    document.addEventListener('focusout', show);
    this.destroyRef.onDestroy(() => {
      document.removeEventListener('focusin', hide);
      document.removeEventListener('focusout', show);
    });
  }
}
