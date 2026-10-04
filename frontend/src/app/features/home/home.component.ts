import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { SeoService } from '../../services/seo.service';
import { PortfolioDataService } from '../../services/portfolio-data.service';
import { MarqueeComponent } from '../../shared/marquee/marquee.component';
import { HeroComponent } from './hero/hero.component';
import { StatsComponent } from './stats/stats.component';
import { AboutComponent } from './about/about.component';
import { ExperienceComponent } from './experience/experience.component';
import { ProjectsComponent } from './projects/projects.component';
import { SkillsComponent } from './skills/skills.component';
import { SystemsComponent } from './systems/systems.component';
import { ApproachComponent } from './approach/approach.component';
import { DotnetComponent } from './dotnet/dotnet.component';
import { ResumeComponent } from './resume/resume.component';
import { ContactComponent } from './contact/contact.component';

@Component({
  selector: 'app-home',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    HeroComponent,
    MarqueeComponent,
    StatsComponent,
    AboutComponent,
    ExperienceComponent,
    ProjectsComponent,
    SkillsComponent,
    SystemsComponent,
    ApproachComponent,
    DotnetComponent,
    ResumeComponent,
    ContactComponent
  ],
  templateUrl: './home.component.html'
})
export class HomeComponent implements OnInit {
  readonly data = inject(PortfolioDataService);
  private readonly seo = inject(SeoService);

  ngOnInit(): void {
    // Restores the homepage's own title/description/canonical/OG tags in case
    // the user arrived via client-side navigation from a project page, which
    // overwrites those tags with its own (see SeoService).
    this.seo.update({
      title: 'Suraj Jha — AI Engineer',
      description:
        'AI Engineer specializing in Generative AI, LLM systems, and real-time Voice AI, with production experience building scalable AI applications for the insurance domain.',
      path: ''
    });
  }
}
