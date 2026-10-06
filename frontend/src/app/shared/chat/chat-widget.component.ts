import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, NgZone, ViewChild, afterNextRender, effect, inject, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { IconComponent } from '../icons/icon.component';
import { PortfolioDataService } from '../../services/portfolio-data.service';
import { formatReply } from './chat-format';
import { ChatService } from './chat.service';

const NUDGE_KEY = 'portfolio-chat:nudged';

/**
 * The bottom-right assistant: an animated launcher that opens a compact chat
 * panel. Answers come from api/chat.ts (RAG over this portfolio's own content).
 *
 * Lazy: it's rendered inside an `@defer (on idle)` block, so none of it is in
 * the initial bundle. Launcher motion is compositor-only and switches off in
 * lite mode / reduced motion. Messages render through formatReply() — never
 * innerHTML.
 */
@Component({
  selector: 'app-chat-widget',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  templateUrl: './chat-widget.component.html',
  styleUrl: './chat-widget.component.scss'
})
export class ChatWidgetComponent {
  @ViewChild('log', { static: true }) private readonly logRef!: ElementRef<HTMLElement>;
  @ViewChild('input', { static: true }) private readonly inputRef!: ElementRef<HTMLTextAreaElement>;
  @ViewChild('launcher', { static: true }) private readonly launcherRef!: ElementRef<HTMLButtonElement>;

  readonly chat = inject(ChatService);
  readonly data = inject(PortfolioDataService);
  private readonly router = inject(Router);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly zone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);

  readonly open = signal(false);
  readonly nudge = signal(false);
  readonly unread = signal(true);
  readonly typing = signal(false);
  readonly draft = signal('');
  readonly format = formatReply;

  readonly suggestions = [
    'What does Suraj do?',
    'Show me his projects',
    'How can I contact him?',
    'Which tech does he use?'
  ];

  constructor() {
    // Keep the newest message in view.
    effect(() => {
      this.chat.messages();
      this.open();
      untracked(() => requestAnimationFrame(() => this.scrollToEnd()));
    });

    afterNextRender(() => {
      // One friendly nudge per tab session, a few seconds after the page settles.
      let seen = false;
      try {
        seen = sessionStorage.getItem(NUDGE_KEY) === '1';
      } catch {
        /* storage blocked */
      }
      if (seen) this.unread.set(false);
      else {
        const show = setTimeout(() => !this.open() && this.nudge.set(true), 4500);
        const hide = setTimeout(() => this.nudge.set(false), 13000);
        this.destroyRef.onDestroy(() => (clearTimeout(show), clearTimeout(hide)));
      }

      // On phones the on-screen keyboard covers fixed UI: lift the panel above it.
      const vv = window.visualViewport;
      if (vv) {
        const el = this.host.nativeElement;
        const update = () => {
          el.style.setProperty('--kb', `${Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop))}px`);
          el.style.setProperty('--chat-viewport', `${Math.round(vv.height)}px`);
        };
        update();
        this.zone.runOutsideAngular(() => {
          vv.addEventListener('resize', update);
          vv.addEventListener('scroll', update);
        });
        this.destroyRef.onDestroy(() => {
          vv.removeEventListener('resize', update);
          vv.removeEventListener('scroll', update);
        });
      }
    });
  }

  toggle(): void {
    this.open() ? this.close() : this.show();
  }

  show(): void {
    this.open.set(true);
    this.nudge.set(false);
    this.unread.set(false);
    try {
      sessionStorage.setItem(NUDGE_KEY, '1');
    } catch {
      /* ignore */
    }
    // Keyboard-first on desktop; on touch devices don't pop the keyboard over the
    // suggestions before the visitor has chosen to type.
    if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
      setTimeout(() => this.inputRef.nativeElement.focus({ preventScroll: true }), 120);
    }
  }

  close(): void {
    if (!this.open()) return;
    this.open.set(false);
    this.launcherRef.nativeElement.focus({ preventScroll: true });
  }

  dismissNudge(): void {
    this.nudge.set(false);
    try {
      sessionStorage.setItem(NUDGE_KEY, '1');
    } catch {
      /* ignore */
    }
  }

  ask(text: string): void {
    void this.chat.send(text);
  }

  submit(event: Event): void {
    event.preventDefault();
    const text = this.draft().trim();
    if (!text || this.chat.busy()) return;
    this.draft.set('');
    this.inputRef.nativeElement.value = '';
    this.fit();
    void this.chat.send(text);
  }

  onInput(event: Event): void {
    this.draft.set((event.target as HTMLTextAreaElement).value);
    this.fit();
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) this.submit(event);
  }

  /** In-site links stay in the app (no full page reload). */
  onLink(event: MouseEvent, href: string, internal: boolean): void {
    if (!internal || event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    event.preventDefault();
    void this.router.navigateByUrl(href);
    if (window.matchMedia('(max-width: 600px)').matches) this.open.set(false); // get the sheet out of the way
  }

  clear(): void {
    this.chat.reset();
    this.inputRef.nativeElement.focus({ preventScroll: true });
  }

  private fit(): void {
    const el = this.inputRef.nativeElement;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 104)}px`;
  }

  private scrollToEnd(): void {
    const el = this.logRef.nativeElement;
    el.scrollTop = el.scrollHeight;
  }
}
