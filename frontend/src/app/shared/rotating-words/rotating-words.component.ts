import { Component, ElementRef, Input, OnDestroy, OnInit, ViewChild, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import gsap from 'gsap';

/**
 * Cycles through a list of words — used as a small decorative accent (never
 * the page's only copy of the information, and never inside an h1/h2 so it
 * stays out of the accessible name that matters for SEO and screen readers).
 * Freezes on the first word under prefers-reduced-motion.
 *
 * Two visual modes:
 * - `crossfade` (default): quiet slide/fade, DOM text swapped directly.
 * - `mask`: per-character blur+mask GSAP transition, used where the rotation
 *   itself is the visual focus (e.g. the hero identity line).
 *
 * `ViewEncapsulation.None` because `mask` mode builds character spans with
 * raw DOM APIs (not Angular's template renderer) so they never pick up the
 * `_ngcontent` attribute Angular's emulated encapsulation relies on to scope
 * styles — these rules need to be unscoped to reach them.
 */
@Component({
  selector: 'app-rotating-words',
  standalone: true,
  imports: [CommonModule],
  encapsulation: ViewEncapsulation.None,
  template: `
    <span class="rotating-words">
      <span
        class="rotating-words-current"
        [class.rotating-words-current--shimmer]="accent === 'shimmer'"
        #word
        aria-hidden="true"
      ></span>
      <span class="visually-hidden">{{ words.join(', ') }}</span>
    </span>
  `,
  styleUrl: './rotating-words.component.scss'
})
export class RotatingWordsComponent implements OnInit, OnDestroy {
  @Input({ required: true }) words: string[] = [];
  @Input() intervalMs = 2200;
  @Input() mode: 'crossfade' | 'mask' = 'crossfade';
  /** `shimmer` = the hero's animated multi-stop gradient text; `default` = the shared violet→blue gradient. */
  @Input() accent: 'default' | 'shimmer' = 'default';
  @ViewChild('word', { static: true }) wordRef!: ElementRef<HTMLElement>;

  private index = 0;
  private timer?: ReturnType<typeof setInterval>;

  ngOnInit(): void {
    if (!this.words.length) return;
    const container = this.wordRef.nativeElement;

    if (this.mode === 'mask') {
      this.buildChars(this.words[0], container);
    } else {
      container.textContent = this.words[0];
    }

    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion || this.words.length < 2) return;

    this.timer = setInterval(() => {
      this.index = (this.index + 1) % this.words.length;
      const next = this.words[this.index];

      if (this.mode === 'mask') {
        this.maskSwap(next);
      } else {
        const el = this.wordRef.nativeElement;
        el.classList.remove('rotating-words-swap');
        void el.offsetWidth; // force reflow so the animation class can restart
        el.textContent = next;
        el.classList.add('rotating-words-swap');
      }
    }, this.intervalMs);
  }

  // Nesting, deliberately: each space-separated word gets its own
  // `.word-group` (display: inline-block, white-space: nowrap) so the browser
  // can only line-wrap BETWEEN words, at the real space character between
  // groups — never mid-word. Inside a word, `.char-mask` clips (overflow:
  // hidden), GSAP animates `.char`'s transform/filter, and the glyph +
  // gradient-clip live together on the innermost `.char-fill`. A gradient
  // background-clip:text only resolves correctly on the exact element that
  // owns both the background AND the text — putting transform/filter on
  // that same element (or the gradient on a distant ancestor of it) forces
  // the browser to isolate it onto its own compositing layer and the
  // clipped text silently renders invisible. Keeping `.char` (animated) and
  // `.char-fill` (gradient) as separate elements sidesteps that.
  private buildChars(word: string, container: HTMLElement): HTMLElement[] {
    container.replaceChildren();
    const chars: HTMLElement[] = [];
    const words = word.split(' ');

    words.forEach((w, wordIndex) => {
      const wordGroup = document.createElement('span');
      wordGroup.className = 'word-group';

      for (const ch of w) {
        const mask = document.createElement('span');
        mask.className = 'char-mask';
        const move = document.createElement('span');
        move.className = 'char';
        const fill = document.createElement('span');
        fill.className = 'char-fill';
        fill.textContent = ch;
        move.appendChild(fill);
        mask.appendChild(move);
        wordGroup.appendChild(mask);
        chars.push(move);
      }

      container.appendChild(wordGroup);
      if (wordIndex < words.length - 1) {
        container.appendChild(document.createTextNode(' '));
      }
    });

    return chars;
  }

  private maskSwap(next: string): void {
    const container = this.wordRef.nativeElement;
    const oldChars = Array.from(container.querySelectorAll<HTMLElement>('.char'));

    if (!oldChars.length) {
      this.buildChars(next, container);
      return;
    }

    gsap.to(oldChars, {
      yPercent: -120,
      autoAlpha: 0,
      filter: 'blur(6px)',
      duration: 0.32,
      stagger: 0.012,
      ease: 'power3.in',
      onComplete: () => {
        const newChars = this.buildChars(next, container);
        gsap.fromTo(
          newChars,
          { yPercent: 120, autoAlpha: 0, filter: 'blur(6px)' },
          { yPercent: 0, autoAlpha: 1, filter: 'blur(0px)', duration: 0.5, stagger: 0.022, ease: 'power3.out' }
        );
      }
    });
  }

  ngOnDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    gsap.killTweensOf(this.wordRef?.nativeElement.querySelectorAll('.char'));
  }
}
