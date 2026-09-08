import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export type IconName =
  | 'github'
  | 'linkedin'
  | 'mail'
  | 'arrow-right'
  | 'arrow-up'
  | 'external'
  | 'download'
  | 'menu'
  | 'close'
  | 'node'
  | 'instagram'
  | 'file-text'
  | 'phone'
  | 'code'
  | 'sun'
  | 'moon'
  | 'chevron-down'
  | 'brain'
  | 'mic'
  | 'sparkles'
  | 'server'
  | 'layers'
  | 'database'
  | 'cpu';

/**
 * Minimal, dependency-free SVG icon set. Every icon inherits currentColor so
 * it themes for free, and ships as inline markup rather than an icon-font
 * or a third-party package — one less dependency for the build.
 */
@Component({
  selector: 'app-icon',
  standalone: true,
  imports: [CommonModule],
  template: `
    <svg
      [attr.width]="size"
      [attr.height]="size"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.6"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <ng-container [ngSwitch]="name">
        <ng-container *ngSwitchCase="'github'">
          <path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.52 2.34 1.09 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.56-1.11-4.56-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02a9.4 9.4 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85v2.74c0 .26.18.58.69.48A10 10 0 0 0 12 2Z"/>
        </ng-container>
        <ng-container *ngSwitchCase="'linkedin'">
          <rect x="3" y="3" width="18" height="18" rx="2.5"/>
          <path d="M7.5 10.5v6M7.5 7.75v.01M11.5 16.5v-3.5c0-1.4 1-2.5 2.5-2.5s2.5 1.1 2.5 2.5v3.5M11.5 10.5v6"/>
        </ng-container>
        <ng-container *ngSwitchCase="'mail'">
          <rect x="3" y="5" width="18" height="14" rx="2"/>
          <path d="m3.5 6 8.5 6.5L20.5 6"/>
        </ng-container>
        <ng-container *ngSwitchCase="'arrow-right'">
          <path d="M4.5 12h15M13.5 5.5 20 12l-6.5 6.5"/>
        </ng-container>
        <ng-container *ngSwitchCase="'arrow-up'">
          <path d="M12 19.5v-15M5.5 10.5 12 4l6.5 6.5"/>
        </ng-container>
        <ng-container *ngSwitchCase="'external'">
          <path d="M9 6H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3M14 4h6v6M20 4l-9.5 9.5"/>
        </ng-container>
        <ng-container *ngSwitchCase="'download'">
          <path d="M12 3v13M7 11.5 12 16l5-4.5M4.5 19.5h15"/>
        </ng-container>
        <ng-container *ngSwitchCase="'menu'">
          <path d="M4 7h16M4 12h16M4 17h16"/>
        </ng-container>
        <ng-container *ngSwitchCase="'close'">
          <path d="M5 5l14 14M19 5 5 19"/>
        </ng-container>
        <ng-container *ngSwitchCase="'node'">
          <circle cx="12" cy="12" r="3.2"/>
        </ng-container>
        <ng-container *ngSwitchCase="'instagram'">
          <rect x="3" y="3" width="18" height="18" rx="5"/>
          <circle cx="12" cy="12" r="4"/>
          <circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" stroke="none"/>
        </ng-container>
        <ng-container *ngSwitchCase="'file-text'">
          <path d="M7 3.5h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-16a1 1 0 0 1 1-1Z"/>
          <path d="M14 3.5V8h4"/>
          <path d="M9 12.5h6M9 16h6"/>
        </ng-container>
        <ng-container *ngSwitchCase="'phone'">
          <path d="M5.5 4h3l1.5 4.5-2 1.5a11 11 0 0 0 5.5 5.5l1.5-2 4.5 1.5v3a1.5 1.5 0 0 1-1.6 1.5A16.5 16.5 0 0 1 4 5.6 1.5 1.5 0 0 1 5.5 4Z"/>
        </ng-container>
        <ng-container *ngSwitchCase="'code'">
          <path d="m9 7-5 5 5 5M15 7l5 5-5 5"/>
        </ng-container>
        <ng-container *ngSwitchCase="'sun'">
          <circle cx="12" cy="12" r="4.2"/>
          <path d="M12 2.5v3M12 18.5v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2.5 12h3M18.5 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>
        </ng-container>
        <ng-container *ngSwitchCase="'moon'">
          <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z"/>
        </ng-container>
        <ng-container *ngSwitchCase="'chevron-down'">
          <path d="m5.5 8.5 6.5 7 6.5-7"/>
        </ng-container>
        <ng-container *ngSwitchCase="'brain'">
          <path d="M9.5 4a2.8 2.8 0 0 0-2.8 2.8 2.6 2.6 0 0 0-1.7 4.4A2.8 2.8 0 0 0 6.5 16a2.8 2.8 0 0 0 3 2.8V6.5A2.5 2.5 0 0 0 9.5 4Z"/>
          <path d="M14.5 4a2.8 2.8 0 0 1 2.8 2.8 2.6 2.6 0 0 1 1.7 4.4A2.8 2.8 0 0 1 17.5 16a2.8 2.8 0 0 1-3 2.8V6.5A2.5 2.5 0 0 1 14.5 4Z"/>
          <path d="M9.5 10.2h1.8M12.7 10.2h1.8M9.5 14.2h1.8M12.7 14.2h1.8"/>
        </ng-container>
        <ng-container *ngSwitchCase="'mic'">
          <rect x="9" y="3.5" width="6" height="11" rx="3"/>
          <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5v3M8.5 20.5h7"/>
        </ng-container>
        <ng-container *ngSwitchCase="'sparkles'">
          <path d="M12 3.5 13.3 8l4.5 1.3-4.5 1.3L12 15l-1.3-4.4L6.2 9.3l4.5-1.3Z"/>
          <path d="M18 15.5l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7Z"/>
        </ng-container>
        <ng-container *ngSwitchCase="'server'">
          <rect x="3.5" y="4.5" width="17" height="6" rx="1.5"/>
          <rect x="3.5" y="13.5" width="17" height="6" rx="1.5"/>
          <path d="M7 7.5h.01M7 16.5h.01"/>
        </ng-container>
        <ng-container *ngSwitchCase="'layers'">
          <path d="m12 3.5 8 4.5-8 4.5-8-4.5Z"/>
          <path d="m4 12 8 4.5 8-4.5M4 15.8 12 20.3l8-4.5"/>
        </ng-container>
        <ng-container *ngSwitchCase="'database'">
          <ellipse cx="12" cy="6" rx="7.5" ry="3"/>
          <path d="M4.5 6v6c0 1.66 3.36 3 7.5 3s7.5-1.34 7.5-3V6"/>
          <path d="M4.5 12v6c0 1.66 3.36 3 7.5 3s7.5-1.34 7.5-3v-6"/>
        </ng-container>
        <ng-container *ngSwitchCase="'cpu'">
          <rect x="7" y="7" width="10" height="10" rx="1.5"/>
          <rect x="10" y="10" width="4" height="4"/>
          <path d="M9 3.5v2M15 3.5v2M9 18.5v2M15 18.5v2M3.5 9h2M3.5 15h2M18.5 9h2M18.5 15h2"/>
        </ng-container>
      </ng-container>
    </svg>
  `
})
export class IconComponent {
  @Input({ required: true }) name!: IconName;
  @Input() size = 20;
}
