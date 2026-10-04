import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RevealDirective } from '../../../shared/reveal/reveal.directive';
import { IconComponent } from '../../../shared/icons/icon.component';
import { MagneticDirective } from '../../../shared/magnetic/magnetic.directive';
import { PortfolioDataService } from '../../../services/portfolio-data.service';

@Component({
  selector: 'app-resume',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RevealDirective, IconComponent, MagneticDirective],
  templateUrl: './resume.component.html',
  styleUrl: './resume.component.scss'
})
export class ResumeComponent {
  readonly data = inject(PortfolioDataService);
}
