import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RevealDirective } from '../../../shared/reveal/reveal.directive';
import { SplitDirective } from '../../../shared/split/split.directive';
import { MarqueeComponent } from '../../../shared/marquee/marquee.component';
import { PortfolioDataService } from '../../../services/portfolio-data.service';

/** The "AI needs reliable software" statement band (formerly the .NET equation). */
@Component({
  selector: 'app-dotnet',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RevealDirective, SplitDirective, MarqueeComponent],
  templateUrl: './dotnet.component.html',
  styleUrl: './dotnet.component.scss'
})
export class DotnetComponent {
  readonly equation = ['AI / LLM', 'Angular', 'ASP.NET Core', 'C#', 'APIs', 'Data'];
  readonly data = inject(PortfolioDataService);
}
