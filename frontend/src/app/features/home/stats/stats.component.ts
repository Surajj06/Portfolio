import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RevealDirective } from '../../../shared/reveal/reveal.directive';
import { CountUpDirective } from '../../../shared/count-up/count-up.directive';
import { PortfolioDataService } from '../../../services/portfolio-data.service';

interface Stat {
  value: string;
  label: string;
}

/**
 * A quiet "by the numbers" strip between the hero and About. Every figure
 * here is pulled directly from real, already-published project copy — see
 * PortfolioDataService — nothing here is invented for effect.
 */
@Component({
  selector: 'app-stats',
  standalone: true,
  imports: [CommonModule, RevealDirective, CountUpDirective],
  templateUrl: './stats.component.html',
  styleUrl: './stats.component.scss'
})
export class StatsComponent {
  constructor(readonly data: PortfolioDataService) {}

  get stats(): Stat[] {
    return [
      { value: '20,000+', label: 'Outbound calls/day handled by the voice platform' },
      { value: '74+', label: 'Partner APIs monitored in real time' },
      { value: '15+', label: 'Insurance partners integrated in the matching engine' },
      { value: `${this.data.projects.length}`, label: 'Production AI systems shipped' }
    ];
  }
}
