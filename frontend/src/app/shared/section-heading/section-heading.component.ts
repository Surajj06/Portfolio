import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RevealDirective } from '../reveal/reveal.directive';

@Component({
  selector: 'app-section-heading',
  standalone: true,
  imports: [CommonModule, RevealDirective],
  templateUrl: './section-heading.component.html',
  styleUrl: './section-heading.component.scss'
})
export class SectionHeadingComponent {
  @Input({ required: true }) title!: string;
  @Input() lede?: string;
  @Input() align: 'left' | 'center' = 'left';
  /** Small uppercase kicker above the title — a distinct "label" type role,
   * separate from the heading and body text roles. */
  @Input() eyebrow?: string;
}
