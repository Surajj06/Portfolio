import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, NgZone, afterNextRender, computed, inject, signal } from '@angular/core';
import { SectionHeadingComponent } from '../../../shared/section-heading/section-heading.component';
import { RevealDirective } from '../../../shared/reveal/reveal.directive';
import { IconComponent } from '../../../shared/icons/icon.component';
import { WaveformComponent } from '../../../shared/waveform/waveform.component';
import { PortfolioDataService, CallLine } from '../../../services/portfolio-data.service';
import { DeviceService } from '../../../services/device.service';

/**
 * Voice pipeline walkthrough + a simulated call. As each line of the (clearly
 * labelled, illustrative) conversation plays, the matching pipeline stage
 * lights up and the waveform reacts to who is speaking — so the page
 * *shows* a call moving through STT → fast-path/LLM → TTS instead of
 * describing it.
 *
 * The loop only runs while the section is on screen and the tab is visible,
 * can be paused (WCAG 2.2.2), and under reduced motion it renders the whole
 * transcript statically. Template state changes once every ~1–2s, so change
 * detection cost is negligible; timers run outside the zone.
 */
@Component({
  selector: 'app-systems',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SectionHeadingComponent, RevealDirective, IconComponent, WaveformComponent],
  templateUrl: './systems.component.html',
  styleUrl: './systems.component.scss'
})
export class SystemsComponent {
  readonly data = inject(PortfolioDataService);
  private readonly zone = inject(NgZone);
  private readonly device = inject(DeviceService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);

  /** Pipeline stage currently highlighted. */
  readonly active = signal(0);
  readonly lines = signal<CallLine[]>([]);
  readonly playing = signal(true);
  readonly speaker = signal<'agent' | 'caller' | 'idle'>('idle');

  /** Newest message first — the chat list is column-reverse, so it reads bottom-up. */
  readonly feed = computed(() => [...this.lines()].reverse().slice(0, 5));
  readonly energy = computed(() => (this.speaker() === 'idle' ? 0.22 : 1));

  private cursor = 0;
  private onScreen = false;
  private timer?: ReturnType<typeof setTimeout>;

  constructor() {
    afterNextRender(() => {
      if (this.device.reducedMotion) {
        this.lines.set(this.data.callScript);
        this.playing.set(false);
        return;
      }

      this.zone.runOutsideAngular(() => {
        const io = new IntersectionObserver(([entry]) => {
          this.onScreen = entry.isIntersecting;
          this.onScreen ? this.kick() : clearTimeout(this.timer);
        }, { threshold: 0.25 });
        io.observe(this.host.nativeElement);

        const onVisibility = () => (document.hidden ? clearTimeout(this.timer) : this.kick());
        document.addEventListener('visibilitychange', onVisibility);

        this.destroyRef.onDestroy(() => {
          io.disconnect();
          document.removeEventListener('visibilitychange', onVisibility);
          clearTimeout(this.timer);
        });
      });
    });
  }

  /** User picked a stage: show it and stop the auto-play so it doesn't change under them. */
  select(index: number): void {
    this.pause();
    this.active.set(index);
  }

  toggle(): void {
    this.playing() ? this.pause() : this.resume();
  }

  private pause(): void {
    this.playing.set(false);
    clearTimeout(this.timer);
  }

  private resume(): void {
    this.playing.set(true);
    this.kick();
  }

  /** (Re)starts the chain if it should be running. Idempotent. */
  private kick(): void {
    clearTimeout(this.timer);
    if (!this.playing() || !this.onScreen || document.hidden) return;
    this.timer = setTimeout(() => this.advance(), 450);
  }

  private advance(): void {
    if (!this.playing() || !this.onScreen || document.hidden) return;
    const script = this.data.callScript;

    if (this.cursor >= script.length) {
      // Hold the finished call for a beat, then start over.
      this.timer = setTimeout(() => {
        this.zone.run(() => {
          this.lines.set([]);
          this.speaker.set('idle');
          this.active.set(0);
        });
        this.cursor = 0;
        this.kick();
      }, 3400);
      return;
    }

    const line = script[this.cursor++];
    this.zone.run(() => {
      this.lines.update((all) => [...all, line]);
      this.active.set(line.step);
      this.speaker.set(line.role === 'agent' ? 'agent' : line.role === 'caller' ? 'caller' : 'idle');
    });
    const wait = line.role === 'system' ? 950 : 1150 + Math.min(line.text.length * 24, 1500);
    this.timer = setTimeout(() => this.advance(), wait);
  }
}
