import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, NgZone, afterNextRender, inject } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { IconComponent } from '../../../shared/icons/icon.component';
import { RotatingWordsComponent } from '../../../shared/rotating-words/rotating-words.component';
import { WaveformComponent } from '../../../shared/waveform/waveform.component';
import { MagneticDirective } from '../../../shared/magnetic/magnetic.directive';
import { TiltDirective } from '../../../shared/tilt/tilt.directive';
import { ParallaxDirective } from '../../../shared/parallax/parallax.directive';
import { SectionLinkDirective } from '../../../shared/section-link/section-link.directive';
import { PortfolioDataService } from '../../../services/portfolio-data.service';

@Component({
  selector: 'app-hero',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgOptimizedImage,
    SectionLinkDirective,
    IconComponent,
    RotatingWordsComponent,
    WaveformComponent,
    MagneticDirective,
    TiltDirective,
    ParallaxDirective
  ],
  templateUrl: './hero.component.html',
  styleUrl: './hero.component.scss'
})
export class HeroComponent {
  readonly data = inject(PortfolioDataService);

  // A short, curated slice of the focus areas — brief enough that the rotating
  // word never wraps awkwardly next to its label.
  readonly focusWords = ['Generative AI', 'Agentic AI', 'MCP', 'RAG', 'LLM Systems', 'Real-Time Voice AI'];

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly zone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    // The hero's ambient loops (floating stickers, spinning spark, ping dots)
    // only need to run while the hero is actually on screen — which is a tiny
    // fraction of the time on a long page. Pausing them off-screen makes them
    // free for the rest of the visit (CSS: :host(.is-away) in hero.component.scss).
    afterNextRender(() => {
      if (typeof IntersectionObserver === 'undefined') return;
      const el = this.host.nativeElement;
      this.zone.runOutsideAngular(() => {
        const io = new IntersectionObserver(([entry]) => el.classList.toggle('is-away', !entry.isIntersecting));
        io.observe(el);
        this.destroyRef.onDestroy(() => io.disconnect());
      });
    });
  }
}
