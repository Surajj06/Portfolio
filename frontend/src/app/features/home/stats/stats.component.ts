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
  // A stable array/object reference, computed once — *ngFor tracks items by
  // identity by default, so a getter rebuilding this on every CD cycle would
  // make it destroy and recreate every `.stat` node (and its directives,
  // mid-animation) on every single tick instead of just rendering it once.
  readonly stats: Stat[];

  constructor(readonly data: PortfolioDataService) {
    this.stats = [
      { value: '20,000+', label: 'Outbound calls/day handled by the voice platform' },
      { value: '74+', label: 'Partner APIs monitored in real time' },
      { value: '15+', label: 'Insurance partners integrated in the matching engine' },
      { value: `${this.data.projects.length}`, label: 'Production AI systems shipped' }
    ];
  }
}
