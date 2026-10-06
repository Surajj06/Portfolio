import { Injectable, inject, signal } from '@angular/core';
import { environment } from '../../../environments/environment';
import { PortfolioDataService } from '../../services/portfolio-data.service';

export interface RelatedLink {
  title: string;
  url: string;
}

export interface ChatMessage {
  id: number;
  role: 'user' | 'assistant';
  text: string;
  related?: RelatedLink[];
  /** Assistant reply still streaming in. */
  pending?: boolean;
  error?: boolean;
  notice?: string;
  mode?: 'model' | 'retrieval';
}

const STORAGE_KEY = 'portfolio-chat:v1';
const MAX_HISTORY = 10;

/**
 * Talks to the same-origin assistant endpoint (api/chat.ts) with plain `fetch`
 * and reads the reply as a server-sent-event stream, so words appear as they are
 * written. Text is flushed to the UI once per animation frame, not once per
 * network chunk. The conversation lives in sessionStorage for the tab only.
 */
@Injectable({ providedIn: 'root' })
export class ChatService {
  readonly messages = signal<ChatMessage[]>([]);
  readonly busy = signal(false);

  private readonly profile = inject(PortfolioDataService).profile;
  private readonly endpoint = `${environment.apiUrl}/chat`;
  private abort?: AbortController;
  private nextId = 1;

  constructor() {
    try {
      const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? '[]') as ChatMessage[];
      if (Array.isArray(saved)) {
        this.messages.set(saved.filter((m) => m && typeof m.text === 'string' && !m.pending).slice(-24));
        this.nextId = this.messages().reduce((n, m) => Math.max(n, m.id), 0) + 1;
      }
    } catch {
      /* private mode / blocked storage — start fresh */
    }
  }

  reset(): void {
    this.abort?.abort();
    this.messages.set([]);
    this.busy.set(false);
    this.persist();
  }

  async send(input: string): Promise<void> {
    const question = input.replace(/\s+/g, ' ').trim().slice(0, 600);
    if (!question || this.busy()) return;

    const history = this.messages()
      .filter((m) => !m.error && m.text)
      .filter((m) => m.mode !== 'retrieval')
      .slice(-MAX_HISTORY)
      .map((m) => ({ role: m.role, content: m.text }));

    const reply: ChatMessage = { id: this.nextId + 1, role: 'assistant', text: '', pending: true };
    this.messages.update((list) => [...list, { id: this.nextId, role: 'user', text: question }, reply]);
    this.nextId += 2;
    this.busy.set(true);

    const controller = (this.abort = new AbortController());
    const timeout = setTimeout(() => controller.abort(), 40000);
    let pendingText = '';
    let frame = 0;
    const flush = () => {
      frame = 0;
      if (!pendingText) return;
      const chunk = pendingText;
      pendingText = '';
      this.patch(reply.id, (m) => ({ ...m, text: m.text + chunk }));
    };

    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [...history, { role: 'user', content: question }] }),
        signal: controller.signal
      });
      if (!response.ok || !response.body) throw new HttpFailure(response.status);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let cut: number;
        while ((cut = buffer.indexOf('\n\n')) !== -1) {
          const event = buffer.slice(0, cut);
          buffer = buffer.slice(cut + 2);
          const line = event.split('\n').find((l) => l.startsWith('data:'));
          if (!line) continue;
          let data: { type?: string; text?: string; related?: RelatedLink[]; mode?: 'model' | 'retrieval'; reason?: string };
          try {
            data = JSON.parse(line.slice(5));
          } catch {
            continue;
          }
          if (data.type === 'delta' && data.text) {
            pendingText += data.text;
            frame ||= requestAnimationFrame(flush);
          } else if (data.type === 'meta') {
            const notice = data.reason === 'interrupted'
              ? 'The reply was interrupted. Please try again for the rest.'
              : data.mode === 'retrieval'
                ? data.reason === 'rate-limit'
                  ? 'AI is taking a short break due to its usage limit. Here are saved portfolio details; try again shortly.'
                  : 'AI is temporarily unavailable. These are saved portfolio details.'
                : undefined;
            this.patch(reply.id, (m) => ({ ...m, related: data.related ?? m.related, mode: data.mode, notice }));
          }
        }
      }
      cancelAnimationFrame(frame);
      flush();
      this.patch(reply.id, (m) => ({ ...m, pending: false, text: m.text || this.fallback() }));
    } catch (err) {
      cancelAnimationFrame(frame);
      flush();
      const status = err instanceof HttpFailure ? err.status : 0;
      this.patch(reply.id, (m) => ({
        ...m,
        pending: false,
        error: !m.text,
        text: m.text || (status === 429 ? 'You’re sending messages quickly — give it a minute and try again.' : this.fallback())
      }));
    } finally {
      clearTimeout(timeout);
      if (this.abort === controller) this.busy.set(false);
      this.persist();
    }
  }

  /** Shown when the assistant can't be reached: the facts a visitor actually needs. */
  private fallback(): string {
    return `I couldn’t reach the assistant just now. You can contact Suraj directly: ${this.profile.email} · ${this.profile.phone}`;
  }

  private patch(id: number, fn: (m: ChatMessage) => ChatMessage): void {
    this.messages.update((list) => list.map((m) => (m.id === id ? fn(m) : m)));
  }

  private persist(): void {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(this.messages().filter((m) => !m.pending).slice(-24)));
    } catch {
      /* ignore */
    }
  }
}

class HttpFailure extends Error {
  constructor(readonly status: number) {
    super(`Chat request failed (${status})`);
  }
}
