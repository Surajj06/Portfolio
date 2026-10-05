import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { SectionLinkDirective } from '../../shared/section-link/section-link.directive';
import { IconComponent } from '../../shared/icons/icon.component';
import { ClockComponent } from '../../shared/clock/clock.component';
import { CopyDirective } from '../../shared/copy/copy.directive';
import { PortfolioDataService } from '../../services/portfolio-data.service';
import { DeviceService } from '../../services/device.service';

@Component({
  selector: 'app-footer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SectionLinkDirective, IconComponent, ClockComponent, CopyDirective],
  templateUrl: './footer.component.html',
  styleUrl: './footer.component.scss'
})
export class FooterComponent {
  readonly data = inject(PortfolioDataService);
  private readonly device = inject(DeviceService);
  readonly year = new Date().getFullYear();

  readonly links = this.data.nav.filter((n) => n.desktop);

  toTop(): void {
    window.scrollTo({ top: 0, behavior: this.device.reducedMotion ? 'auto' : 'smooth' });
  }
}
