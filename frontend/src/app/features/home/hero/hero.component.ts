import { Component, ElementRef, ViewChild } from '@angular/core';
import { CommonModule, NgOptimizedImage } from '@angular/common';
import { IconComponent } from '../../../shared/icons/icon.component';
import { RotatingWordsComponent } from '../../../shared/rotating-words/rotating-words.component';
import { MagneticDirective } from '../../../shared/magnetic/magnetic.directive';
import { PortfolioDataService } from '../../../services/portfolio-data.service';
import { AiFlowDiagramComponent } from './ai-flow-diagram.component';
import { HeroParticlesComponent } from './hero-particles.component';

@Component({
  selector: 'app-hero',
  standalone: true,
  imports: [
    CommonModule,
    NgOptimizedImage,
    IconComponent,
    RotatingWordsComponent,
    MagneticDirective,
    AiFlowDiagramComponent,
    HeroParticlesComponent
  ],
  templateUrl: './hero.component.html',
  styleUrl: './hero.component.scss'
})
export class HeroComponent {
  @ViewChild('heroSection', { static: false }) heroSectionRef?: ElementRef<HTMLElement>;

  private readonly parallaxEnabled: boolean;
  /** Same gate as parallax — fine-pointer desktop only, never under
   * prefers-reduced-motion. Also spares touch devices the `three` download
   * entirely (the `@defer` block never fires when this is false). */
  readonly particlesEnabled: boolean;
  private frame?: number;

  constructor(readonly data: PortfolioDataService) {
    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const isFinePointer = window.matchMedia?.('(hover: hover) and (pointer: fine)').matches;
    this.parallaxEnabled = !prefersReducedMotion && !!isFinePointer;
    this.particlesEnabled = this.parallaxEnabled;
  }

  get firstName(): string {
    return this.data.profile.name.split(' ')[0];
  }

  get restOfName(): string {
    return this.data.profile.name.split(' ').slice(1).join(' ');
  }

  // A short, curated slice of data.about.focusAreas — kept brief so the
  // rotating word never wraps awkwardly next to the fixed "Focused on" label.
  readonly focusWords = ['Generative AI', 'Real-Time Voice AI', 'LLM Orchestration', 'RAG', 'Agentic AI'];

  /** Bold mouse-parallax: the photo drifts opposite the cursor, the ambient
   * blobs drift with it a little, for a "made with intent" interactive feel.
   * Desktop fine-pointer only, off entirely under prefers-reduced-motion. */
  onMouseMove(event: MouseEvent): void {
    if (!this.parallaxEnabled || !this.heroSectionRef) return;
    if (this.frame) cancelAnimationFrame(this.frame);

    this.frame = requestAnimationFrame(() => {
      const rect = this.heroSectionRef!.nativeElement.getBoundingClientRect();
      const px = (event.clientX - rect.left) / rect.width - 0.5; // -0.5..0.5
      const py = (event.clientY - rect.top) / rect.height - 0.5;

      this.heroSectionRef!.nativeElement.style.setProperty('--parallax-x', `${(px * -18).toFixed(2)}px`);
      this.heroSectionRef!.nativeElement.style.setProperty('--parallax-y', `${(py * -14).toFixed(2)}px`);
    });
  }

  onMouseLeave(): void {
    if (!this.parallaxEnabled || !this.heroSectionRef) return;
    this.heroSectionRef.nativeElement.style.setProperty('--parallax-x', '0px');
    this.heroSectionRef.nativeElement.style.setProperty('--parallax-y', '0px');
  }
}
