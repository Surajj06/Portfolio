import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { SectionLinkDirective } from '../../../shared/section-link/section-link.directive';
import { SectionHeadingComponent } from '../../../shared/section-heading/section-heading.component';
import { RevealDirective } from '../../../shared/reveal/reveal.directive';
import { IconComponent } from '../../../shared/icons/icon.component';
import { ClockComponent } from '../../../shared/clock/clock.component';
import { MarqueeComponent } from '../../../shared/marquee/marquee.component';
import { PortfolioDataService } from '../../../services/portfolio-data.service';

/** About, laid out as a bento grid of small purposeful tiles. */
@Component({
  selector: 'app-about',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SectionLinkDirective, SectionHeadingComponent, RevealDirective, IconComponent, ClockComponent, MarqueeComponent],
  templateUrl: './about.component.html',
  styleUrl: './about.component.scss'
})
export class AboutComponent {
  readonly data = inject(PortfolioDataService);

  /** One-sentence version of the current role, taken from the experience entry. */
  readonly nowText = this.data.experience[0].description;

  // The full tech list, split across two ticker rows that run in opposite directions.
  private readonly allTech = Array.from(new Set(this.data.techStack.flatMap((c) => c.items)));
  readonly stackTop = this.allTech.filter((_, i) => i % 2 === 0);
  readonly stackBottom = this.allTech.filter((_, i) => i % 2 === 1);

  readonly pipeNodes = [
    { label: 'Call', icon: 'phone' },
    { label: 'STT', icon: 'mic' },
    { label: 'LLM', icon: 'brain' },
    { label: 'TTS', icon: 'sparkles' }
  ] as const;
}
