import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { IconComponent } from '../icons/icon.component';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  styles: [
    `
      :host {
        position: fixed;
        z-index: 150;
        left: 50%;
        bottom: calc(28px + env(safe-area-inset-bottom, 0px));
        transform: translateX(-50%);
        pointer-events: none;
      }
      @media (max-width: 899.98px) {
        :host {
          bottom: calc(var(--dock-h) + 36px + env(safe-area-inset-bottom, 0px));
        }
      }
      .toast {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        padding: 12px 20px 12px 16px;
        border-radius: var(--r-pill);
        background: var(--cta-bg);
        color: var(--cta-ink);
        font-size: 0.92rem;
        font-weight: 600;
        white-space: nowrap;
        box-shadow: 0 18px 40px -16px rgba(0, 0, 0, 0.6);
        animation: pop 0.45s var(--ease-spring) both;
      }
    `
  ],
  template: `
    <div role="status" aria-live="polite">
      @if (toast.message(); as message) {
        <p class="toast"><app-icon name="check" [size]="18" [stroke]="2.2" /> {{ message }}</p>
      }
    </div>
  `
})
export class ToastComponent {
  readonly toast = inject(ToastService);
}
