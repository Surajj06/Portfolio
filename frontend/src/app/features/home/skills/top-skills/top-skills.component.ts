import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RevealDirective } from '../../../../shared/reveal/reveal.directive';
import { SpotlightDirective } from '../../../../shared/spotlight/spotlight.directive';
import { PortfolioDataService } from '../../../../services/portfolio-data.service';

interface SkillUsage {
  name: string;
  projectCount: number;
  /** Bar fill, relative to the most-used skill — a real usage count, not an
   * invented proficiency score (see skill-graph.component.ts's design note
   * on the same principle). */
  pct: number;
}

/**
 * "Most shipped with" bars alongside the skill graph — ranks technologies by
 * how many real, listed projects actually use them (PortfolioDataService),
 * rather than a self-rated skill percentage.
 */
@Component({
  selector: 'app-top-skills',
  standalone: true,
  imports: [CommonModule, RevealDirective, SpotlightDirective],
  templateUrl: './top-skills.component.html',
  styleUrl: './top-skills.component.scss'
})
export class TopSkillsComponent {
  readonly topSkills: SkillUsage[];

  constructor(data: PortfolioDataService) {
    const allItems = new Set(data.techStack.flatMap((category) => category.items));
    const counted = Array.from(allItems)
      .map((name) => ({
        name,
        projectCount: data.projects.filter((project) => project.techStack.includes(name)).length
      }))
      .filter((entry) => entry.projectCount > 0)
      .sort((a, b) => b.projectCount - a.projectCount)
      .slice(0, 8);

    const max = counted[0]?.projectCount ?? 1;
    this.topSkills = counted.map((entry) => ({ ...entry, pct: (entry.projectCount / max) * 100 }));
  }
}
