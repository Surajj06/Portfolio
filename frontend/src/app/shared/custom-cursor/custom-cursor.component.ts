import { Component, ElementRef, HostBinding, HostListener, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

export type CursorState = 'default' | 'interactive' | 'project' | 'link' | 'drag' | 'text';

const STATE_LABELS: Partial<Record<CursorState, string>> = {
  project: 'VIEW PROJECT',
  link: 'OPEN',
  drag: 'DRAG'
};

// Text-editable fields need the native I-beam + blinking caret to stay
// legible — the replacement dot/ring would otherwise sit right on top of
// whatever's being typed (see the 'text' state below and its cursor:text
// exemption from `body.custom-cursor-active` in styles.scss).
const TEXT_INPUT_TYPES = new Set([
  'text', 'email', 'password', 'search', 'tel', 'url', 'number',
  'date', 'datetime-local', 'month', 'week', 'time'
]);

function isTextEntry(el: Element): boolean {
  if ((el as HTMLElement).isContentEditable) return true;
  if (el.tagName === 'TEXTAREA') return true;
  if (el.tagName === 'INPUT') {
    return TEXT_INPUT_TYPES.has((el as HTMLInputElement).type || 'text');
  }
  return false;
}

/**
 * Replaces the native cursor on desktop with a trailing dot + expanding ring.
 * Any element can opt into a labelled state via `[data-cursor="project" |
 * "link" | "drag"]`; plain `a`/`button`/form controls get a generic
 * "interactive" scale-up with no label. Absent on touch/coarse pointers and
 * under prefers-reduced-motion — the native cursor is never hidden unless
 * this component is actually drawing its replacement (see the
 * `body.custom-cursor-active` rule in styles.scss).
 */
@Component({
  selector: 'app-custom-cursor',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './custom-cursor.component.html',
  styleUrl: './custom-cursor.component.scss'
})
export class CustomCursorComponent implements OnInit, OnDestroy {
  @HostBinding('attr.data-state') state: CursorState = 'default';
  label = '';

  private enabled = false;
  private targetX = 0;
  private targetY = 0;
  private dotX = 0;
  private dotY = 0;
  private glowX = 0;
  private glowY = 0;
  private raf?: number;

  constructor(private readonly el: ElementRef<HTMLElement>) {}

  ngOnInit(): void {
    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const isFinePointer = window.matchMedia?.('(hover: hover) and (pointer: fine)').matches;
    this.enabled = !prefersReducedMotion && !!isFinePointer;

    if (this.enabled) {
      document.body.classList.add('custom-cursor-active');
      this.loop();
    } else {
      this.el.nativeElement.style.display = 'none';
    }
  }

  @HostListener('window:mousemove', ['$event'])
  onMouseMove(event: MouseEvent): void {
    if (!this.enabled) return;
    this.targetX = event.clientX;
    this.targetY = event.clientY;
    this.el.nativeElement.style.setProperty('--cursor-opacity', '1');
  }

  @HostListener('window:mouseleave')
  onWindowLeave(): void {
    this.el.nativeElement.style.setProperty('--cursor-opacity', '0');
  }

  @HostListener('window:mouseover', ['$event'])
  onMouseOver(event: MouseEvent): void {
    if (!this.enabled) return;
    this.applyState(event.target as HTMLElement | null);
  }

  // A click often swaps the DOM under the pointer (SPA route navigation,
  // *ngIf toggles) without the mouse physically moving — mouseover/mouseout
  // only fire on boundary crossings, so the label (e.g. "VIEW PROJECT")
  // would otherwise stay stuck until the next real mouse movement. Re-hit-test
  // the same screen point once the click's DOM update has settled.
  @HostListener('window:click')
  onClick(): void {
    if (!this.enabled) return;
    requestAnimationFrame(() => {
      this.applyState(document.elementFromPoint(this.targetX, this.targetY) as HTMLElement | null);
    });
  }

  private applyState(target: HTMLElement | null): void {
    const explicit = target?.closest?.('[data-cursor]') as HTMLElement | null;

    if (explicit) {
      const kind = explicit.dataset['cursor'] as CursorState;
      this.state = kind;
      this.label = STATE_LABELS[kind] ?? '';
      return;
    }

    const textEntry = target?.closest?.('input, textarea, [contenteditable]');
    if (textEntry && isTextEntry(textEntry)) {
      this.state = 'text';
      this.label = '';
      return;
    }

    const interactive = target?.closest?.('a, button, input, select, [role="button"]');
    this.state = interactive ? 'interactive' : 'default';
    this.label = '';
  }

  private loop = (): void => {
    // Dot tracks tightly, the ambient glow trails looser — same easing feel
    // the previous cursor-glow component used, now paired with a real cursor.
    this.dotX += (this.targetX - this.dotX) * 0.35;
    this.dotY += (this.targetY - this.dotY) * 0.35;
    this.glowX += (this.targetX - this.glowX) * 0.12;
    this.glowY += (this.targetY - this.glowY) * 0.12;

    const host = this.el.nativeElement;
    host.style.setProperty('--cursor-x', `${this.dotX}px`);
    host.style.setProperty('--cursor-y', `${this.dotY}px`);
    host.style.setProperty('--glow-x', `${this.glowX}px`);
    host.style.setProperty('--glow-y', `${this.glowY}px`);

    this.raf = requestAnimationFrame(this.loop);
  };

  ngOnDestroy(): void {
    if (this.raf) cancelAnimationFrame(this.raf);
    document.body.classList.remove('custom-cursor-active');
  }
}
