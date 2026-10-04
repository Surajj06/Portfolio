import { Injectable, signal } from '@angular/core';

/** Tiny transient confirmation ("Email copied") shown by <app-toast>. */
@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly message = signal<string | null>(null);
  private timer?: ReturnType<typeof setTimeout>;

  show(message: string, ms = 2400): void {
    this.message.set(message);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.message.set(null), ms);
  }
}
