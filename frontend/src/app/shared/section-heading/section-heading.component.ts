import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RevealDirective } from '../reveal/reveal.directive';
import { SplitDirective } from '../split/split.directive';

/**
 * Shared section opener: mono kicker, big heading, optional lede. The heading
 * text is projected so a section can drop an <em> serif accent word into it
 * (the heading gets the kinetic line-by-line reveal, see SplitDirective):
 *
 *   <app-section-heading kicker="About" headingId="about-title">
 *     Built to <em>ship</em>.
 *   </app-section-heading>
 */
@Component({
  selector: 'app-section-heading',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RevealDirective, SplitDirective],
  templateUrl: './section-heading.component.html',
  styleUrl: './section-heading.component.scss'
})
export class SectionHeadingComponent {
  @Input({ required: true }) kicker!: string;
  @Input() lede?: string;
  /** Lets the parent <section> point aria-labelledby at the heading. */
  @Input() headingId?: string;
}
