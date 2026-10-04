import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

// Tiny helpers so shapes can live in one data map as plain path strings.
const circle = (cx: number, cy: number, r: number) =>
  `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;
const rect = (x: number, y: number, w: number, h: number, r = 0) =>
  r
    ? `M${x + r} ${y}h${w - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${h - 2 * r}a${r} ${r} 0 0 1 ${-r} ${r}h${-(w - 2 * r)}a${r} ${r} 0 0 1 ${-r} ${-r}v${-(h - 2 * r)}a${r} ${r} 0 0 1 ${r} ${-r}z`
    : `M${x} ${y}h${w}v${h}h${-w}z`;

/** Every icon is a list of stroked paths on a 24×24 grid and inherits currentColor. */
const ICONS = {
  github: [
    'M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.52 2.34 1.09 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.56-1.11-4.56-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02a9.4 9.4 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85v2.74c0 .26.18.58.69.48A10 10 0 0 0 12 2Z'
  ],
  linkedin: [rect(3, 3, 18, 18, 2.5), 'M7.5 10.5v6M7.5 7.75v.01M11.5 16.5v-3.5c0-1.4 1-2.5 2.5-2.5s2.5 1.1 2.5 2.5v3.5M11.5 10.5v6'],
  instagram: [rect(3, 3, 18, 18, 5), circle(12, 12, 4), 'M17.2 6.8h.01'],
  mail: [rect(3, 5, 18, 14, 2), 'm3.5 6 8.5 6.5L20.5 6'],
  phone: ['M5.5 4h3l1.5 4.5-2 1.5a11 11 0 0 0 5.5 5.5l1.5-2 4.5 1.5v3a1.5 1.5 0 0 1-1.6 1.5A16.5 16.5 0 0 1 4 5.6 1.5 1.5 0 0 1 5.5 4Z'],
  'file-text': ['M7 3.5h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-16a1 1 0 0 1 1-1Z', 'M14 3.5V8h4', 'M9 12.5h6M9 16h6'],
  download: ['M12 3v13M7 11.5 12 16l5-4.5M4.5 19.5h15'],
  external: ['M9 6H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3M14 4h6v6M20 4l-9.5 9.5'],
  'arrow-right': ['M4.5 12h15M13.5 5.5 20 12l-6.5 6.5'],
  'arrow-up': ['M12 19.5v-15M5.5 10.5 12 4l6.5 6.5'],
  'arrow-down': ['M12 4.5v15M5.5 13.5 12 20l6.5-6.5'],
  'arrow-up-right': ['M7 17 17 7M8.5 7H17v8.5'],
  'chevron-down': ['m5.5 8.5 6.5 7 6.5-7'],
  plus: ['M12 5v14M5 12h14'],
  minus: ['M5 12h14'],
  check: ['m5 12.5 4.5 4.5L19 7.5'],
  close: ['M5.5 5.5l13 13M18.5 5.5l-13 13'],
  menu: ['M4 7h16M4 12h16M4 17h16'],
  more: [circle(5.5, 12, 1.1), circle(12, 12, 1.1), circle(18.5, 12, 1.1)],
  search: [circle(10.5, 10.5, 6.5), 'm20 20-4.85-4.85'],
  command: ['M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3'],
  copy: [rect(8.5, 8.5, 11, 11, 2), 'M15.5 8.5V6.5a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2'],
  sun: [circle(12, 12, 4.2), 'M12 2.5v3M12 18.5v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2.5 12h3M18.5 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1'],
  moon: ['M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z'],
  home: ['M3.5 11 12 4l8.5 7M5.5 9.8V20h13V9.8M10 20v-5.5h4V20'],
  user: [circle(12, 8, 4), 'M4.5 20.5a7.5 7.5 0 0 1 15 0'],
  briefcase: [rect(3.5, 7.5, 17, 12, 2), 'M9 7.5V6a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 6v1.5M3.5 13h17'],
  grid: [rect(4, 4, 6.5, 6.5, 1.5), rect(13.5, 4, 6.5, 6.5, 1.5), rect(4, 13.5, 6.5, 6.5, 1.5), rect(13.5, 13.5, 6.5, 6.5, 1.5)],
  send: ['M21 3 10.5 13.5M21 3l-6.5 18-4-7.5L3 9.5 21 3Z'],
  layers: ['m12 3.5 8 4.5-8 4.5-8-4.5Z', 'm4 12 8 4.5 8-4.5M4 15.8l8 4.5 8-4.5'],
  cpu: [rect(7, 7, 10, 10, 1.5), rect(10, 10, 4, 4), 'M9 3.5v2M15 3.5v2M9 18.5v2M15 18.5v2M3.5 9h2M3.5 15h2M18.5 9h2M18.5 15h2'],
  brain: [
    'M9.5 4a2.8 2.8 0 0 0-2.8 2.8 2.6 2.6 0 0 0-1.7 4.4A2.8 2.8 0 0 0 6.5 16a2.8 2.8 0 0 0 3 2.8V6.5A2.5 2.5 0 0 0 9.5 4Z',
    'M14.5 4a2.8 2.8 0 0 1 2.8 2.8 2.6 2.6 0 0 1 1.7 4.4A2.8 2.8 0 0 1 17.5 16a2.8 2.8 0 0 1-3 2.8V6.5A2.5 2.5 0 0 1 14.5 4Z',
    'M9.5 10.2h1.8M12.7 10.2h1.8M9.5 14.2h1.8M12.7 14.2h1.8'
  ],
  mic: [rect(9, 3.5, 6, 11, 3), 'M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5v3M8.5 20.5h7'],
  sparkles: ['M12 3.5 13.3 8l4.5 1.3-4.5 1.3L12 15l-1.3-4.4L6.2 9.3l4.5-1.3Z', 'M18 15.5l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7Z'],
  server: [rect(3.5, 4.5, 17, 6, 1.5), rect(3.5, 13.5, 17, 6, 1.5), 'M7 7.5h.01M7 16.5h.01'],
  database: ['M4.5 6a7.5 3 0 1 0 15 0a7.5 3 0 1 0-15 0', 'M4.5 6v6c0 1.66 3.36 3 7.5 3s7.5-1.34 7.5-3V6', 'M4.5 12v6c0 1.66 3.36 3 7.5 3s7.5-1.34 7.5-3v-6'],
  code: ['m9 7-5 5 5 5M15 7l5 5-5 5'],
  terminal: [rect(3, 4.5, 18, 15, 2.5), 'm7 9.5 3 2.5-3 2.5M12.5 15h4.5'],
  wave: ['M4 10v4M8 6v12M12 3v18M16 8v8M20 10.5v3'],
  star: ['m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9l-5.2 2.8 1-5.9-4.3-4.1 5.9-.8Z'],
  zap: ['M13 3 5 13.5h6L10 21l8-10.5h-6Z'],
  shield: ['M12 3.5 5 6v5.5c0 4.2 2.9 7.6 7 9 4.1-1.4 7-4.8 7-9V6Z', 'm9 12 2.2 2.2L15.5 10'],
  clock: [circle(12, 12, 8.5), 'M12 7.5V12l3 2'],
  pin: ['M12 21s6.5-5.6 6.5-11a6.5 6.5 0 0 0-13 0C5.5 15.4 12 21 12 21Z', circle(12, 10, 2.3)],
  globe: [circle(12, 12, 8.5), 'M3.5 12h17M12 3.5c2.4 2.4 3.6 5.2 3.6 8.5s-1.2 6.1-3.6 8.5c-2.4-2.4-3.6-5.2-3.6-8.5S9.6 5.9 12 3.5Z'],
  play: ['M8 5.5v13l11-6.5Z'],
  pause: ['M8.5 5.5v13M15.5 5.5v13'],
  link: ['M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1']
} satisfies Record<string, string[]>;

export type IconName = keyof typeof ICONS;

/**
 * Dependency-free SVG icon set. Every icon inherits currentColor so it themes
 * for free, and ships as path data in this one file — no icon font, no
 * package, no extra request.
 */
@Component({
  selector: 'app-icon',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [':host{display:inline-flex;flex:none;line-height:0}'],
  template: `
    <svg
      class="icon"
      [attr.width]="size"
      [attr.height]="size"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      [attr.stroke-width]="stroke"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      @for (d of paths; track $index) {
        <path [attr.d]="d" />
      }
    </svg>
  `
})
export class IconComponent {
  @Input({ required: true }) name!: IconName;
  @Input() size = 20;
  @Input() stroke = 1.7;

  get paths(): readonly string[] {
    return ICONS[this.name] ?? [];
  }
}
