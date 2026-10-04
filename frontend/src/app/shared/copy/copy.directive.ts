import { Directive, HostListener, Input, inject } from '@angular/core';
import { ToastService } from '../../services/toast.service';
import { DeviceService } from '../../services/device.service';

/**
 * Click-to-copy. `<button [appCopy]="email" copyMessage="Email copied">` copies
 * the text and confirms with a toast; the host element also gets a brief
 * `is-copied` class for local feedback. Falls back to a hidden textarea where
 * the async Clipboard API isn't available.
 */
@Directive({ selector: '[appCopy]', standalone: true })
export class CopyDirective {
  @Input({ required: true }) appCopy = '';
  @Input() copyMessage = 'Copied to clipboard';

  private readonly toast = inject(ToastService);
  private readonly device = inject(DeviceService);

  @HostListener('click', ['$event'])
  async onClick(event: Event): Promise<void> {
    const host = event.currentTarget as HTMLElement;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(this.appCopy);
      } else {
        const area = document.createElement('textarea');
        area.value = this.appCopy;
        area.setAttribute('readonly', '');
        area.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
        document.body.appendChild(area);
        area.select();
        document.execCommand('copy');
        area.remove();
      }
    } catch {
      return;
    }
    this.device.haptic(10);
    this.toast.show(this.copyMessage);
    host.classList.add('is-copied');
    setTimeout(() => host.classList.remove('is-copied'), 1600);
  }
}
