import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, Input, NgZone, ViewChild, afterNextRender, inject } from '@angular/core';
import { DeviceService } from '../../services/device.service';

/**
 * Cycles through a short list of words, sliding each up out of a one-line
 * window. Every word is real text in the HTML (good for SEO and no-JS), the
 * screen-reader text lists them all once, and under reduced motion it simply
 * rests on the first word.
 *
 * Cost: one interval timer and one CSS-variable write per swap — the slide
 * itself is a CSS transform transition.
 */
@Component({
  selector: 'app-rotating-words',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="window" aria-hidden="true">
      <span #list class="list">
        @for (word of loop; track $index) {
          <span class="word">{{ word }}</span>
        }
      </span>
    </span>
    <span class="sr-only">{{ words.join(', ') }}</span>
  `,
  styleUrl: './rotating-words.component.scss'
})
export class RotatingWordsComponent {
  @ViewChild('list', { static: true }) private readonly listRef!: ElementRef<HTMLElement>;

  @Input({ required: true }) set words(value: readonly string[]) {
    this._words = value;
    // The first word is repeated at the end so the loop can wrap invisibly.
    this.loop = value.length > 1 ? [...value, value[0]] : [...value];
  }
  get words(): readonly string[] {
    return this._words;
  }
  @Input() intervalMs = 2600;

  loop: string[] = [];
  private _words: readonly string[] = [];

  private readonly zone = inject(NgZone);
  private readonly device = inject(DeviceService);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    afterNextRender(() => {
      if (this.device.reducedMotion || this._words.length < 2) return;
      const list = this.listRef.nativeElement;
      const last = this._words.length;
      let index = 0;

      this.zone.runOutsideAngular(() => {
        const timer = setInterval(() => {
          if (document.hidden) return;
          index += 1;
          list.style.setProperty('--i', String(index));
          if (index === last) {
            // We're showing the cloned first word: after the slide finishes,
            // snap back to the real first word with transitions off.
            setTimeout(() => {
              list.style.transition = 'none';
              list.style.setProperty('--i', '0');
              void list.offsetWidth;
              list.style.transition = '';
              index = 0;
            }, 700);
          }
        }, this.intervalMs);
        this.destroyRef.onDestroy(() => clearInterval(timer));
      });
    });
  }
}
