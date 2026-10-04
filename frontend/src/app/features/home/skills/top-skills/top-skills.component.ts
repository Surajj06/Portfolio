import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RevealDirective } from '../../../../shared/reveal/reveal.directive';
import { PortfolioDataService } from '../../../../services/portfolio-data.service';

interface SkillUsage {
  name: string;
  projectCount: number;
  /** Bar fill relative to the most-used skill — a real usage count, never a
   * self-rated proficiency score. */
  pct: number;
}

/**
 * "Most shipped with" — ranks technologies by how many of the listed
 * projects actually use them (PortfolioDataService), rather than showing a
 * made-up percentage skill rating.
 */
@Component({
  selector: 'app-top-skills',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RevealDirective],
  templateUrl: './top-skills.component.html',
  styleUrl: './top-skills.component.scss'
})
export class TopSkillsComponent {
  readonly topSkills: SkillUsage[];

  constructor() {
    const data = inject(PortfolioDataService);
    const allItems = new Set(data.techStack.flatMap((category) => category.items));
    const counted = Array.from(allItems)
      .map((name) => ({ name, projectCount: data.projects.filter((p) => p.techStack.includes(name)).length }))
      .filter((entry) => entry.projectCount > 0)
      .sort((a, b) => b.projectCount - a.projectCount)
      .slice(0, 8);

    const max = counted[0]?.projectCount ?? 1;
    this.topSkills = counted.map((entry) => ({ ...entry, pct: (entry.projectCount / max) * 100 }));
  }
}
