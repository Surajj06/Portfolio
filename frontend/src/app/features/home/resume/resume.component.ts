import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SectionHeadingComponent } from '../../../shared/section-heading/section-heading.component';
import { RevealDirective } from '../../../shared/reveal/reveal.directive';
import { IconComponent } from '../../../shared/icons/icon.component';
import { MagneticDirective } from '../../../shared/magnetic/magnetic.directive';
import { SpotlightDirective } from '../../../shared/spotlight/spotlight.directive';
import { PortfolioDataService } from '../../../services/portfolio-data.service';

@Component({
  selector: 'app-resume',
  standalone: true,
  imports: [CommonModule, SectionHeadingComponent, RevealDirective, IconComponent, MagneticDirective, SpotlightDirective],
  templateUrl: './resume.component.html',
  styleUrl: './resume.component.scss'
})
export class ResumeComponent {
  constructor(readonly data: PortfolioDataService) {}
}
