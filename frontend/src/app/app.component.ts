import { ChangeDetectionStrategy, Component, afterNextRender, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from './core/navbar/navbar.component';
import { FooterComponent } from './core/footer/footer.component';
import { ScrollProgressComponent } from './shared/scroll-progress/scroll-progress.component';
import { ToastComponent } from './shared/toast/toast.component';
import { CustomCursorComponent } from './shared/custom-cursor/custom-cursor.component';
import { CommandPaletteComponent } from './shared/command-palette/command-palette.component';
import { DeviceService } from './services/device.service';
import { PerfGuardService } from './services/perf-guard.service';
import { ScrollService } from './services/scroll.service';
import { SpotlightService } from './services/spotlight.service';
import { CommandPaletteService } from './shared/command-palette/command-palette.service';

@Component({
  selector: 'app-root',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterOutlet,
    NavbarComponent,
    FooterComponent,
    ScrollProgressComponent,
    ToastComponent,
    CustomCursorComponent,
    CommandPaletteComponent
  ],
  templateUrl: './app.component.html'
})
export class AppComponent {
  private readonly device = inject(DeviceService);
  private readonly perf = inject(PerfGuardService);
  private readonly scroll = inject(ScrollService);
  private readonly spotlight = inject(SpotlightService);
  readonly palette = inject(CommandPaletteService);

  /** Flips on after hydration, so the lazy cursor never differs from the server HTML. */
  readonly cursorReady = signal(false);

  constructor() {
    // Browser-only wiring happens after the first render — never during
    // hydration — so it can't add work to (or mismatch) the prerendered DOM.
    afterNextRender(() => {
      (window as unknown as { __booted?: boolean }).__booted = true;
      this.scroll.start();
      this.perf.start();
      this.spotlight.start();
      this.cursorReady.set(this.device.finePointer && !this.device.reducedMotion);
    });
  }
}
