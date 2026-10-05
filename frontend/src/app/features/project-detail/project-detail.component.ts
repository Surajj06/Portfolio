import { ChangeDetectionStrategy, Component, DestroyRef, Injector, NgZone, Input, afterNextRender, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../../shared/icons/icon.component';
import { RevealDirective } from '../../shared/reveal/reveal.directive';
import { SplitDirective } from '../../shared/split/split.directive';
import { MagneticDirective } from '../../shared/magnetic/magnetic.directive';
import { SectionLinkDirective } from '../../shared/section-link/section-link.directive';
import { ProjectArtComponent } from '../../shared/project-art/project-art.component';
import { ProjectVisualComponent } from '../../shared/project-scene/project-visual.component';
import { WorkflowDiagramComponent } from '../../shared/workflow-diagram/workflow-diagram.component';
import { PortfolioDataService } from '../../services/portfolio-data.service';
import { SeoService } from '../../services/seo.service';
import { DeviceService } from '../../services/device.service';
import { Project } from '../../models/project.model';

interface CaseStudyRow {
  id: string;
  index: string;
  heading: string;
  body: string;
}

@Component({
  selector: 'app-project-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, SectionLinkDirective, IconComponent, RevealDirective, SplitDirective, MagneticDirective, ProjectArtComponent, ProjectVisualComponent, WorkflowDiagramComponent],
  templateUrl: './project-detail.component.html',
  styleUrl: './project-detail.component.scss'
})
export class ProjectDetailComponent {
  readonly data = inject(PortfolioDataService);
  private readonly seo = inject(SeoService);
  private readonly device = inject(DeviceService);
  private readonly zone = inject(NgZone);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);

  readonly project = signal<Project | undefined>(undefined);
  /** Section currently under the reading line (drives the contents rail). */
  readonly activeSection = signal('');

  readonly rows = computed<CaseStudyRow[]>(() => {
    const p = this.project();
    if (!p) return [];
    const cs = p.caseStudy;
    const rows: [string, string][] = [
      ['Problem', cs.problem],
      ['Why it was difficult', cs.whyItWasDifficult],
      ['Architecture', cs.architecture],
      ['Technical approach', cs.technicalApproach],
      ['Implementation', cs.implementation],
      ['Challenges', cs.challenges],
      ['Solution', cs.solution],
      ['Evaluation', cs.evaluation],
      ['Results', cs.results],
      ['Future improvements', cs.futureImprovements]
    ];
    return rows.map(([heading, body], i) => ({
      id: `s-${i + 1}`,
      index: String(i + 1).padStart(2, '0'),
      heading,
      body
    }));
  });

  /** Previous / next project, wrapping around, for the pager at the bottom. */
  readonly adjacent = computed(() => {
    const p = this.project();
    const all = this.data.projects;
    if (!p) return null;
    const i = all.findIndex((x) => x.id === p.id);
    return { prev: all[(i - 1 + all.length) % all.length], next: all[(i + 1) % all.length] };
  });

  /** Bound from the `:id` route param (withComponentInputBinding) — also fires when
   * navigating between projects, because Angular reuses this component. */
  @Input() set id(value: string | undefined) {
    const project = value ? this.data.getProjectById(value) : undefined;
    this.project.set(project);
    if (project) this.updateSeo(project);
  }

  constructor() {
    // (Re)build the scroll-spy whenever the project (and so its sections) changes.
    effect(() => {
      this.project();
      afterNextRender(() => this.observeSections(), { injector: this.injector });
    });
  }

  jump(event: Event, sectionId: string): void {
    event.preventDefault();
    const el = document.getElementById(sectionId);
    if (!el) return;
    el.scrollIntoView({ behavior: this.device.reducedMotion ? 'auto' : 'smooth', block: 'start' });
    history.replaceState(history.state, '', `${location.pathname}#${sectionId}`);
  }

  private observer?: IntersectionObserver;

  private observeSections(): void {
    this.observer?.disconnect();
    const sections = Array.from(document.querySelectorAll<HTMLElement>('[data-sec]'));
    if (!sections.length || typeof IntersectionObserver === 'undefined') return;

    this.zone.runOutsideAngular(() => {
      this.observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting && entry.target.id !== this.activeSection()) {
              this.zone.run(() => this.activeSection.set(entry.target.id));
            }
          }
        },
        { rootMargin: '-30% 0px -62% 0px' } // a thin "reading line" near the top third
      );
      sections.forEach((s) => this.observer!.observe(s));
    });
    this.destroyRef.onDestroy(() => this.observer?.disconnect());
  }

  private updateSeo(project: Project): void {
    this.seo.update({
      title: `${project.title} — Suraj Jha | AI Engineer`,
      description: project.summary,
      path: `projects/${project.id}`,
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'CreativeWork',
        name: project.title,
        description: project.description,
        url: `https://www.aisurajjha.in/projects/${project.id}`,
        keywords: project.concepts.join(', '),
        creator: {
          '@type': 'Person',
          name: 'Suraj Jha',
          url: 'https://www.aisurajjha.in/'
        }
      }
    });
  }
}
