import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { DeviceService } from './device.service';

/**
 * The one way the site scrolls to a home-page section (hero buttons, nav,
 * footer, command palette…).
 *
 * Why not just `routerLink fragment`? A same-page fragment navigation goes
 * through the router → anchor scroll → a second, competing scroll that ignores
 * the sticky-nav offset, and a long smooth scroll makes the browser paint every
 * section it flies past (a visible hitch on phones and modest laptops).
 *
 * Here: scroll directly, land below the floating nav, and for long trips teleport
 * to just short of the target and glide the last stretch — the in-between
 * sections are never rendered at speed, so it feels instant and never sticks.
 */
@Injectable({ providedIn: 'root' })
export class SectionScrollService {
  private readonly router = inject(Router);
  private readonly device = inject(DeviceService);

  /** Gap kept above a section's top edge (matches `scroll-padding-top`). */
  private static readonly NAV_OFFSET = 96;

  go(id: string): void {
    const onHome = this.router.url.split(/[?#]/)[0] === '/';
    if (!onHome) {
      // Router handles the cross-page trip (and its own anchor scroll).
      void this.router.navigate(['/'], { fragment: id === 'top' ? undefined : id });
      return;
    }
    this.scrollToSection(id);
    history.replaceState(history.state, '', id === 'top' ? '/' : `/#${id}`);
  }

  private scrollToSection(id: string): void {
    const target = id === 'top' ? null : document.getElementById(id);
    if (id !== 'top' && !target) return;

    const top = target ? Math.max(0, target.getBoundingClientRect().top + window.scrollY - SectionScrollService.NAV_OFFSET) : 0;
    const distance = top - window.scrollY;
    if (Math.abs(distance) < 2) return;

    if (this.device.reducedMotion) {
      window.scrollTo({ top, behavior: 'auto' });
      return;
    }

    const vh = window.innerHeight;
    if (Math.abs(distance) > vh * 1.5) {
      const approach = top - Math.sign(distance) * vh * 1.1;
      window.scrollTo({ top: approach, behavior: 'instant' });
      requestAnimationFrame(() => window.scrollTo({ top, behavior: 'smooth' }));
    } else {
      window.scrollTo({ top, behavior: 'smooth' });
    }
  }
}
