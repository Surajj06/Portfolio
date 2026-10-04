import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RevealDirective } from '../../../shared/reveal/reveal.directive';
import { CountUpDirective } from '../../../shared/count-up/count-up.directive';
import { PortfolioDataService } from '../../../services/portfolio-data.service';

/**
 * Big-number strip right under the hero. Every figure is quoted from a real,
 * already-published case study (see PortfolioDataService.stats) — nothing
 * here is invented for effect.
 */
@Component({
  selector: 'app-stats',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RevealDirective, CountUpDirective],
  templateUrl: './stats.component.html',
  styleUrl: './stats.component.scss'
})
export class StatsComponent {
  readonly data = inject(PortfolioDataService);
}
