import { ChangeDetectionStrategy, Component, ElementRef, Injector, ViewChild, afterNextRender, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SectionHeadingComponent } from '../../../shared/section-heading/section-heading.component';
import { RevealDirective } from '../../../shared/reveal/reveal.directive';
import { IconComponent } from '../../../shared/icons/icon.component';
import { ProjectVisualComponent } from '../../../shared/project-scene/project-visual.component';
import { PortfolioDataService } from '../../../services/portfolio-data.service';
import { MotionService, GsapKit } from '../../../services/motion.service';
import { Project, ProjectCategory } from '../../../models/project.model';

type Filter = 'All' | ProjectCategory;

@Component({
  selector: 'app-projects',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, SectionHeadingComponent, RevealDirective, IconComponent, ProjectVisualComponent],
  templateUrl: './projects.component.html',
  styleUrl: './projects.component.scss'
})
export class ProjectsComponent {
  @ViewChild('grid', { static: true }) private readonly gridRef!: ElementRef<HTMLElement>;

  readonly data = inject(PortfolioDataService);
  private readonly motion = inject(MotionService);
  private readonly injector = inject(Injector);

  readonly filters: Filter[] = ['All', 'AI / ML', 'Data', 'Backend & Full-stack'];
  readonly active = signal<Filter>('All');

  /** GSAP kit, once loaded (null until then / when motion isn't allowed). */
  private kit: GsapKit | null = null;

  constructor() {
    afterNextRender(() => {
      // Warm up GSAP (Flip) so the first filter click is already animated.
      this.motion.gsap().then((kit) => (this.kit = kit));
    });
  }

  matches(project: Project): boolean {
    const filter = this.active();
    return filter === 'All' || project.categories.includes(filter);
  }

  countFor(filter: Filter): number {
    return filter === 'All' ? this.data.projects.length : this.data.projects.filter((p) => p.categories.includes(filter)).length;
  }

  /**
   * Switches the filter. With GSAP loaded the cards animate to their new
   * positions (FLIP): capture where everything is, let Angular apply the new
   * state, then animate from the old layout to the new one. Without GSAP the
   * grid just updates instantly.
   */
  setFilter(filter: Filter): void {
    if (filter === this.active()) return;
    const kit = this.kit;
    const cards = Array.from(this.gridRef.nativeElement.children) as HTMLElement[];
    const state = kit ? this.motion.run(() => kit.Flip.getState(cards)) : null;

    this.active.set(filter);

    if (!kit || !state) return;
    afterNextRender(
      () =>
        this.motion.run(() =>
          kit.Flip.from(state, {
            duration: 0.75,
            ease: 'power3.inOut',
            stagger: 0.04,
            absolute: true,
            onEnter: (els) => kit.gsap.fromTo(els, { opacity: 0, scale: 0.9 }, { opacity: 1, scale: 1, duration: 0.55, delay: 0.2 }),
            onLeave: (els) => kit.gsap.to(els, { opacity: 0, scale: 0.9, duration: 0.35 })
          })
        ),
      { injector: this.injector }
    );
  }
}
