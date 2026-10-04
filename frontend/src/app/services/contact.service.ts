import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

export interface ContactRequest {
  name: string;
  email: string;
  message: string;
  /** Honeypot — always left blank by real users. */
  website?: string;
}

/**
 * Posts the contact form to the same-origin Vercel function
 * (frontend/api/contact.ts) — or to the local ASP.NET API in development.
 * Plain `fetch` keeps HttpClient out of the bundle; this only ever runs in
 * the browser, on submit.
 */
@Injectable({ providedIn: 'root' })
export class ContactService {
  private readonly endpoint = `${environment.apiUrl}/contact`;

  /** Resolves on success; rejects with an Error (the page shows a friendly message). */
  async submit(request: ContactRequest): Promise<void> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
        signal: controller.signal
      });
      if (!response.ok) throw new Error(`Contact request failed (${response.status})`);
    } finally {
      clearTimeout(timeout);
    }
  }
}
