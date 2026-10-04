import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SectionHeadingComponent } from '../../../shared/section-heading/section-heading.component';
import { RevealDirective } from '../../../shared/reveal/reveal.directive';
import { IconComponent } from '../../../shared/icons/icon.component';
import { TopSkillsComponent } from './top-skills/top-skills.component';
import { PortfolioDataService } from '../../../services/portfolio-data.service';
import { TechCategory } from '../../../models/tech.model';
import { Project } from '../../../models/project.model';

interface Selection {
  category: string;
  item: string;
}

/**
 * Skills as an explorer: each category lists its tools as buttons; tapping
 * one reveals which of the real case studies used it (cross-referenced from
 * each project's techStack). Tools that appear in projects carry a small
 * count badge. There are deliberately no percentage ratings — this content
 * doesn't carry the precision a score would imply.
 */
@Component({
  selector: 'app-skills',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, SectionHeadingComponent, RevealDirective, IconComponent, TopSkillsComponent],
  templateUrl: './skills.component.html',
  styleUrl: './skills.component.scss'
})
export class SkillsComponent {
  readonly data = inject(PortfolioDataService);
  readonly selected = signal<Selection | null>(null);

  /** tool name → projects that list it, computed once. */
  private readonly usageMap = new Map<string, Project[]>();

  constructor() {
    for (const category of this.data.techStack) {
      for (const item of category.items) {
        this.usageMap.set(item, this.data.projects.filter((p) => p.techStack.includes(item)));
      }
    }
  }

  usage(item: string): Project[] {
    return this.usageMap.get(item) ?? [];
  }

  isActive(category: TechCategory, item: string): boolean {
    const s = this.selected();
    return s?.category === category.name && s.item === item;
  }

  select(category: TechCategory, item: string): void {
    this.selected.set(this.isActive(category, item) ? null : { category: category.name, item });
  }

  isOpenCategory(category: TechCategory): boolean {
    return this.selected()?.category === category.name;
  }
}
