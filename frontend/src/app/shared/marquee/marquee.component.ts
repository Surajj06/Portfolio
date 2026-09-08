import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Infinite horizontal ticker of short labels — a quick, high-energy visual
 * beat right under the hero. The item list is duplicated once so the CSS
 * animation can loop seamlessly at -50%; content is real (skills/tech from
 * PortfolioDataService), not decoration. Pure CSS animation, no JS per frame.
 */
@Component({
  selector: 'app-marquee',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './marquee.component.html',
  styleUrl: './marquee.component.scss'
})
export class MarqueeComponent {
  @Input({ required: true }) items: string[] = [];

  get loopItems(): string[] {
    return [...this.items, ...this.items];
  }
}
