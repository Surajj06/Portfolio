import { Component, OnInit } from '@angular/core';
import { SeoService } from '../../services/seo.service';
import { HeroComponent } from './hero/hero.component';
import { MarqueeComponent } from '../../shared/marquee/marquee.component';
import { StatsComponent } from './stats/stats.component';
import { AboutComponent } from './about/about.component';
import { ApproachComponent } from './approach/approach.component';
import { ExperienceComponent } from './experience/experience.component';
import { ProjectsComponent } from './projects/projects.component';
import { SkillsComponent } from './skills/skills.component';
import { SystemsComponent } from './systems/systems.component';
import { DotnetComponent } from './dotnet/dotnet.component';
import { ResumeComponent } from './resume/resume.component';
import { ContactComponent } from './contact/contact.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    HeroComponent,
    MarqueeComponent,
    StatsComponent,
    AboutComponent,
    ApproachComponent,
    ExperienceComponent,
    ProjectsComponent,
    SkillsComponent,
    SystemsComponent,
    DotnetComponent,
    ResumeComponent,
    ContactComponent
  ],
  templateUrl: './home.component.html'
})
export class HomeComponent implements OnInit {
  // A curated, high-signal slice of the full stack (see PortfolioDataService.techStack
  // for the complete list) — enough variety for the ticker without it feeling padded.
  readonly marqueeItems = [
    'Generative AI', 'LLM Orchestration', 'RAG', 'Agentic AI', 'Real-Time Voice AI',
    'Python', 'FastAPI', 'C# / .NET', 'Angular', 'PostgreSQL', 'Redis', 'Docker',
    'OpenAI', 'Anthropic Claude', 'Google Gemini', 'MCP', 'n8n', 'Prometheus + Grafana'
  ];

  constructor(private readonly seo: SeoService) {}

  ngOnInit(): void {
    // Restores the homepage's own title/description/canonical/OG tags in case
    // the user arrived here via client-side navigation from a project page,
    // which overwrites those tags with its own (see SeoService).
    this.seo.update({
      title: 'Suraj Jha — AI Engineer',
      description:
        'AI Engineer specializing in Generative AI, LLM systems, and real-time Voice AI, with production experience building scalable AI applications for the insurance domain.',
      path: ''
    });
  }
}
