import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RevealDirective } from '../../../shared/reveal/reveal.directive';
import { PortfolioDataService } from '../../../services/portfolio-data.service';

@Component({
  selector: 'app-dotnet',
  standalone: true,
  imports: [CommonModule, RevealDirective],
  templateUrl: './dotnet.component.html',
  styleUrl: './dotnet.component.scss'
})
export class DotnetComponent {
  readonly equation = ['AI / LLM', 'Angular', 'ASP.NET Core', 'C#', 'APIs', 'Data'];

  constructor(readonly data: PortfolioDataService) {}
}
