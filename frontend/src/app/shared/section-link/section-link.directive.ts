import { Directive, Input, inject } from '@angular/core';
import { DeviceService } from '../../services/device.service';
import { SectionScrollService } from '../../services/section-scroll.service';

/**
 * `<a appSection="projects">` — a real link (`href="/#projects"`, so it works
 * before the app boots, with JavaScript off, and when opened in a new tab) that
 * scrolls smoothly in place once the app is running. See SectionScrollService.
 */
@Directive({
  selector: 'a[appSection]',
  standalone: true,
  host: {
    '[attr.href]': 'href',
    '(click)': 'onClick($event)'
  }
})
export class SectionLinkDirective {
  @Input('appSection') id = 'top';

  private readonly scroller = inject(SectionScrollService);
  private readonly device = inject(DeviceService);

  get href(): string {
    return this.id === 'top' ? '/' : `/#${this.id}`;
  }

  onClick(event: MouseEvent): void {
    // Let the browser handle new-tab / download / modified clicks.
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    this.device.haptic(8);
    this.scroller.go(this.id);
  }
}
