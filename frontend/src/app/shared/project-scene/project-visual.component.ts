import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, Input, NgZone, afterNextRender, effect, inject, signal } from '@angular/core';
import { ProjectAccent } from '../../models/project.model';
import { DeviceService } from '../../services/device.service';
import { PerfGuardService } from '../../services/perf-guard.service';
import { ProjectArtComponent } from '../project-art/project-art.component';
import { ProjectSceneComponent } from './project-scene.component';

/**
 * Building a scene (a few hundred elements and layers) is real work, so it
 * never happens in the middle of a scroll or in a burst: scenes wait until the
 * page has stopped moving, then mount one at a time, ~110ms apart. (A long jump
 * from the hero to the projects would otherwise build several scenes while the
 * browser is also trying to animate the scroll — a visible hitch on weak devices.)
 */
let lastScroll = 0;
let tracking = false;
let mountChain: Promise<void> = Promise.resolve();

function afterScrollSettles(): Promise<void> {
  if (!tracking) {
    tracking = true;
    addEventListener('scroll', () => (lastScroll = performance.now()), { passive: true });
  }
  return new Promise((resolve) => {
    const check = () => (performance.now() - lastScroll > 180 && !document.hidden ? resolve() : setTimeout(check, 90));
    check();
  });
}

function nextMountSlot(): Promise<void> {
  const turn = mountChain.then(afterScrollSettles);
  mountChain = turn.then(() => new Promise<void>((resolve) => setTimeout(resolve, 110)));
  return turn;
}

/**
 * A project's cover. Server-rendered (and the fallback for lite mode / old
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
    }
  `
})
export class ProjectVisualComponent {
  @Input({ required: true }) id!: string;
  @Input() accent: ProjectAccent = 'lime';

  readonly device = inject(DeviceService);
  readonly live = signal(false);

  private readonly perf = inject(PerfGuardService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly zone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);
  private near = false;

  constructor() {
    afterNextRender(() => {
      if (typeof IntersectionObserver === 'undefined') return;
      const el = this.host.nativeElement;
      this.zone.runOutsideAngular(() => {
        // 1) Mount a little before the card scrolls in (nothing pops in on screen)…
        let pending = false;
        const mount = new IntersectionObserver(
          ([entry]) => {
            if (!entry.isIntersecting || this.near || pending) return;
            pending = true;
            void nextMountSlot().then(() => {
              pending = false;
              const r = el.getBoundingClientRect();
              if (r.bottom < -1400 || r.top > innerHeight + 1400) return; // scrolled far away while waiting
              this.near = true;
              this.zone.run(() => this.update());
            });
          },
          { rootMargin: '320px 0px' }
        );
        // 2) …and give the layers back once it is well out of range. Every live
        //    scene costs the compositor a little on every frame, so only the
        //    handful near the viewport exist at any time.
        const range = new IntersectionObserver(
          ([entry]) => {
            if (!entry.isIntersecting && this.near) {
              this.near = false;
              this.zone.run(() => this.update());
            }
          },
          { rootMargin: '1400px 0px' }
        );
        // 3) Animate only while (almost) on screen.
        const awake = new IntersectionObserver(([entry]) => el.classList.toggle('is-away', !entry.isIntersecting), { rootMargin: '40px 0px' });
        mount.observe(el);
        range.observe(el);
        awake.observe(el);
        this.destroyRef.onDestroy(() => {
          mount.disconnect();
          range.disconnect();
          awake.disconnect();
        });
      });
    });

    // Struggling device (lite mode) → back to the cheap SVG art.
    effect(
      () => {
        this.perf.lite();
        this.update();
      },
      { allowSignalWrites: true }
    );
  }

  private update(): void {
    this.live.set(this.near && !this.perf.lite());
  }
}
