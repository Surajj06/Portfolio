import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, Input, NgZone, afterNextRender, inject, signal } from '@angular/core';
import { ProjectAccent } from '../../models/project.model';
import { DeviceService } from '../../services/device.service';
import { ProjectArtComponent } from '../project-art/project-art.component';
import { ProjectSceneComponent } from './project-scene.component';

/**
 * A project's cover. Server-rendered (and the fallback for old
 * browsers) it is the lightweight SVG illustration; once the card is about to
 * scroll into view it becomes the live 3D scene. The scene is frozen
 * (animation paused) whenever the card is off-screen, so a page with seven of
 * them only ever animates the one or two you can actually see.
 */
@Component({
  selector: 'app-project-visual',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Starts frozen; the viewport observer lifts `is-away` while the card is on screen.
  host: { class: 'is-away' },
  imports: [ProjectArtComponent, ProjectSceneComponent],
  styles: [
    `
      :host {
        display: block;
        position: relative;
        overflow: hidden;
      }
      :host > * {
        position: absolute;
        inset: 0;
      }
    `
  ],
  // The 3D scene (and its stylesheet) is a separate lazy chunk: prefetched when
  // the browser is idle, rendered only once the card is near the viewport.
  template: `
    @defer (when live(); prefetch on idle) {
      @if (live()) {
        <app-project-scene [id]="id" [accent]="accent" [still]="device.reducedMotion" />
      } @else {
        <app-project-art [id]="id" [accent]="accent" />
      }
    } @placeholder {
      <app-project-art [id]="id" [accent]="accent" />
    } @error {
      <app-project-art [id]="id" [accent]="accent" />
    }
  `
})
export class ProjectVisualComponent {
  @Input({ required: true }) id!: string;
  @Input() accent: ProjectAccent = 'lime';

  readonly device = inject(DeviceService);
  readonly live = signal(false);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly zone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    afterNextRender(() => {
      const el = this.host.nativeElement;
      if (typeof IntersectionObserver === 'undefined') {
        el.classList.remove('is-away');
        this.live.set(true);
        return;
      }
      this.zone.runOutsideAngular(() => {
        // Mount before entering view, including a fresh visit to /#projects.
        // A single observer avoids races between independent mount/unmount
        // observers. Never wait for scrolling to stop or hardware heuristics.
        const range = new IntersectionObserver(
          ([entry]) => this.zone.run(() => this.live.set(entry.isIntersecting)),
          { rootMargin: '400px 0px' }
        );
        // Animate only while (almost) on screen.
        const awake = new IntersectionObserver(([entry]) => el.classList.toggle('is-away', !entry.isIntersecting), { rootMargin: '40px 0px' });
        range.observe(el);
        awake.observe(el);
        this.destroyRef.onDestroy(() => {
          range.disconnect();
          awake.disconnect();
        });
      });
    });
  }
}
