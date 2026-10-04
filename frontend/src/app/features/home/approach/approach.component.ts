import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { SectionHeadingComponent } from '../../../shared/section-heading/section-heading.component';
import { RevealDirective } from '../../../shared/reveal/reveal.directive';
import { PortfolioDataService } from '../../../services/portfolio-data.service';

@Component({
  selector: 'app-approach',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SectionHeadingComponent, RevealDirective],
  templateUrl: './approach.component.html',
  styleUrl: './approach.component.scss'
})
export class ApproachComponent {
  readonly data = inject(PortfolioDataService);
}
