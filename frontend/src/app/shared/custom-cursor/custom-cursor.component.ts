import { Component, ElementRef, HostBinding, NgZone, OnDestroy, OnInit } from '@angular/core';
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

  private readonly onMouseMove = (event: MouseEvent): void => {
    this.targetX = event.clientX;
    this.targetY = event.clientY;
    this.el.nativeElement.style.setProperty('--cursor-opacity', '1');
  };

  private readonly onWindowLeave = (): void => {
    this.el.nativeElement.style.setProperty('--cursor-opacity', '0');
  };

  private readonly onMouseOver = (event: MouseEvent): void => {
    this.applyState(event.target as HTMLElement | null);
  };

  // A click often swaps the DOM under the pointer (SPA route navigation,
  // *ngIf toggles) without the mouse physically moving — mouseover/mouseout
  // only fire on boundary crossings, so the label (e.g. "VIEW PROJECT")
  // would otherwise stay stuck until the next real mouse movement. Re-hit-test
  // the same screen point once the click's DOM update has settled.
  private readonly onClick = (): void => {
    requestAnimationFrame(() => {
      this.applyState(document.elementFromPoint(this.targetX, this.targetY) as HTMLElement | null);
    });
  };

  constructor(private readonly el: ElementRef<HTMLElement>, private readonly zone: NgZone) {}

  ngOnInit(): void {
    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const isFinePointer = window.matchMedia?.('(hover: hover) and (pointer: fine)').matches;
    this.enabled = !prefersReducedMotion && !!isFinePointer;

    if (!this.enabled) {
      this.el.nativeElement.style.display = 'none';
      return;
    }

    document.body.classList.add('custom-cursor-active');

    // Mouse tracking and the render loop mutate CSS custom properties
    // directly and run at pointer/frame rate — none of that needs Angular's
    // change detection, so it all runs outside the zone. `applyState` is the
    // one path that touches template-bound state (`state`/`label`), so it
    // explicitly re-enters the zone, but only when it actually changes.
    this.zone.runOutsideAngular(() => {
      window.addEventListener('mousemove', this.onMouseMove);
      window.addEventListener('mouseleave', this.onWindowLeave);
      window.addEventListener('mouseover', this.onMouseOver);
      window.addEventListener('click', this.onClick);
      this.loop();
    });
  }

  private applyState(target: HTMLElement | null): void {
    const explicit = target?.closest?.('[data-cursor]') as HTMLElement | null;

    if (explicit) {
      const kind = explicit.dataset['cursor'] as CursorState;
      this.zone.run(() => {
        this.state = kind;
        this.label = STATE_LABELS[kind] ?? '';
      });
      return;
    }

    const textEntry = target?.closest?.('input, textarea, [contenteditable]');
    if (textEntry && isTextEntry(textEntry)) {
      this.zone.run(() => {
        this.state = 'text';
        this.label = '';
      });
      return;
    }

    const interactive = target?.closest?.('a, button, input, select, [role="button"]');
    const nextState: CursorState = interactive ? 'interactive' : 'default';
    if (nextState === this.state && !this.label) return;
    this.zone.run(() => {
      this.state = nextState;
      this.label = '';
    });
  }

  private loop = (): void => {
    // Dot tracks tightly, the ambient glow trails a bit looser for an
    // ambient feel — both raised from their original factors since the CSS
    // used to double up a `transition: transform` on top of this same lerp,
    // which made the whole cursor read as noticeably laggy.
    this.dotX += (this.targetX - this.dotX) * 0.55;
    this.dotY += (this.targetY - this.dotY) * 0.55;
    this.glowX += (this.targetX - this.glowX) * 0.2;
    this.glowY += (this.targetY - this.glowY) * 0.2;

    const host = this.el.nativeElement;
    host.style.setProperty('--cursor-x', `${this.dotX}px`);
    host.style.setProperty('--cursor-y', `${this.dotY}px`);
    host.style.setProperty('--glow-x', `${this.glowX}px`);
    host.style.setProperty('--glow-y', `${this.glowY}px`);

    this.raf = requestAnimationFrame(this.loop);
  };

  ngOnDestroy(): void {
    if (this.raf) cancelAnimationFrame(this.raf);
    if (this.enabled) {
      window.removeEventListener('mousemove', this.onMouseMove);
      window.removeEventListener('mouseleave', this.onWindowLeave);
      window.removeEventListener('mouseover', this.onMouseOver);
      window.removeEventListener('click', this.onClick);
    }
    document.body.classList.remove('custom-cursor-active');
  }
}
