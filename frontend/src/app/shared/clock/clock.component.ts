import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, Input, NgZone, afterNextRender, inject } from '@angular/core';

/**
 * Live wall-clock for a time zone. Renders an em-dash placeholder on the
 * server (so the prerendered HTML never ships a stale time), then fills in
 * and refreshes by writing text directly — no change detection involved.
 */
@Component({
  selector: 'app-clock',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `—:—`,
  styles: [':host{font-variant-numeric:tabular-nums}']
})
export class ClockComponent {
  @Input() timeZone = 'Asia/Kolkata';

  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly zone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    afterNextRender(() => {
      const format = new Intl.DateTimeFormat('en-IN', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: this.timeZone
      });
      const paint = () => (this.el.nativeElement.textContent = format.format(new Date()).toUpperCase());
      paint();
      this.zone.runOutsideAngular(() => {
        const timer = setInterval(paint, 15000);
        this.destroyRef.onDestroy(() => clearInterval(timer));
      });
    });
  }
}
