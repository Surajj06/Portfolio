import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface ContactRequest {
  name: string;
  email: string;
  message: string;
  /** Honeypot — always left blank by real users. */
  website?: string;
}

export interface ContactResponse {
  success: boolean;
  message: string;
}

@Injectable({ providedIn: 'root' })
export class ContactService {
  private readonly endpoint = `${environment.apiUrl}/contact`;

  constructor(private readonly http: HttpClient) {}

  submit(request: ContactRequest): Observable<ContactResponse> {
    return this.http.post<ContactResponse>(this.endpoint, request);
  }
}
