import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { SectionLinkDirective } from '../../../shared/section-link/section-link.directive';
import { SectionHeadingComponent } from '../../../shared/section-heading/section-heading.component';
import { RevealDirective } from '../../../shared/reveal/reveal.directive';
import { IconComponent } from '../../../shared/icons/icon.component';
import { MagneticDirective } from '../../../shared/magnetic/magnetic.directive';
import { PortfolioDataService } from '../../../services/portfolio-data.service';

@Component({
  selector: 'app-experience',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SectionLinkDirective, SectionHeadingComponent, RevealDirective, IconComponent, MagneticDirective],
  templateUrl: './experience.component.html',
  styleUrl: './experience.component.scss'
})
export class ExperienceComponent {
  readonly data = inject(PortfolioDataService);

  /** How many responsibilities are visible before "show all". */
  readonly preview = 3;
  readonly expanded = signal(false);

  toggle(): void {
    this.expanded.update((v) => !v);
  }

  /** First letter of the company, used as a monogram logo. */
  initial(company: string): string {
    return company.trim().charAt(0).toUpperCase();
  }
}
