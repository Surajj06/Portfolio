import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, NgZone, ViewChild, afterNextRender, effect, inject } from '@angular/core';
import { PerfGuardService } from '../../services/perf-guard.service';

const INTERACTIVE = '[data-cursor], a[href], button, summary, [role="button"], label, input, textarea, select';
const TEXT_FIELD = 'input:not([type=checkbox]):not([type=radio]):not([type=submit]):not([type=button]), textarea';

/**
 * Desktop-only cursor: a precise dot plus a trailing ring that grows over
 * links and turns into a labelled pill over elements marked
 * `data-cursor="view"` (project cards).
 *
 * Built to cost almost nothing: one `transform` write per element per frame,
 * only while the pointer is actually moving — the rAF loop stops itself as
 * soon as the ring catches up. Created lazily (see app.component.html) and
 * only on fine-pointer devices without reduced motion; torn down if the page
 * drops into lite mode.
 */
@Component({
  selector: 'app-custom-cursor',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './custom-cursor.component.html',
  styleUrl: './custom-cursor.component.scss'
})
export class CustomCursorComponent {
  @ViewChild('dot', { static: true }) private readonly dotRef!: ElementRef<HTMLElement>;
  @ViewChild('follow', { static: true }) private readonly followRef!: ElementRef<HTMLElement>;
  @ViewChild('tag', { static: true }) private readonly tagRef!: ElementRef<HTMLElement>;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly zone = inject(NgZone);
  private readonly perf = inject(PerfGuardService);
  private readonly destroyRef = inject(DestroyRef);

  private tx = 0;
  private ty = 0;
  private fx = 0;
  private fy = 0;
  private raf = 0;
  private seen = false;
  private state = '';
  private cleanup?: () => void;

  constructor() {
    afterNextRender(() => this.zone.runOutsideAngular(() => this.init()));
    effect(() => {
      if (this.perf.lite()) this.cleanup?.();
    });
    this.destroyRef.onDestroy(() => this.cleanup?.());
  }

  private init(): void {
    const host = this.host.nativeElement;
    const dot = this.dotRef.nativeElement;
    const follow = this.followRef.nativeElement;
    const tag = this.tagRef.nativeElement;

    const tick = () => {
      this.fx += (this.tx - this.fx) * 0.2;
      this.fy += (this.ty - this.fy) * 0.2;
      follow.style.transform = `translate3d(${this.fx.toFixed(1)}px, ${this.fy.toFixed(1)}px, 0)`;
      // Keep animating only until the ring has caught up with the pointer.
      this.raf = Math.abs(this.tx - this.fx) + Math.abs(this.ty - this.fy) > 0.3 ? requestAnimationFrame(tick) : 0;
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      this.tx = e.clientX;
      this.ty = e.clientY;
      if (!this.seen) {
        this.seen = true;
        this.fx = this.tx;
        this.fy = this.ty;
        host.classList.add('is-visible');
      }
      dot.style.transform = `translate3d(${this.tx}px, ${this.ty}px, 0)`;
      if (!this.raf) this.raf = requestAnimationFrame(tick);
    };

    const setState = (next: string, label = '') => {
      if (next === this.state) return;
      if (this.state) host.classList.remove(`is-${this.state}`);
      this.state = next;
      if (next) host.classList.add(`is-${next}`);
      if (next === 'view') tag.textContent = label || 'View';
    };

    const onOver = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      const target = (e.target as Element | null)?.closest?.<HTMLElement>(INTERACTIVE);
      if (!target) return setState('');
      if (target.matches(TEXT_FIELD)) return setState('text');
      if (target.dataset['cursor'] === 'view') return setState('view', target.dataset['cursorLabel']);
      setState('link');
    };

    const onDown = () => host.classList.add('is-down');
    const onUp = () => host.classList.remove('is-down');
    const onLeave = () => host.classList.remove('is-visible');
    const onEnter = () => this.seen && host.classList.add('is-visible');

    document.body.classList.add('cursor-on');
    document.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerover', onOver, { passive: true });
    document.addEventListener('pointerdown', onDown, { passive: true });
    document.addEventListener('pointerup', onUp, { passive: true });
    document.documentElement.addEventListener('mouseleave', onLeave);
    document.documentElement.addEventListener('mouseenter', onEnter);

    this.cleanup = () => {
      cancelAnimationFrame(this.raf);
      document.body.classList.remove('cursor-on');
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerover', onOver);
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('pointerup', onUp);
      document.documentElement.removeEventListener('mouseleave', onLeave);
      document.documentElement.removeEventListener('mouseenter', onEnter);
      host.classList.remove('is-visible');
      this.cleanup = undefined;
    };
  }
}
