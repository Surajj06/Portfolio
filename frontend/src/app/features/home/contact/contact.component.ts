import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import confetti from 'canvas-confetti';
import { SectionHeadingComponent } from '../../../shared/section-heading/section-heading.component';
import { RevealDirective } from '../../../shared/reveal/reveal.directive';
import { IconComponent } from '../../../shared/icons/icon.component';
import { MagneticDirective } from '../../../shared/magnetic/magnetic.directive';
import { SpotlightDirective } from '../../../shared/spotlight/spotlight.directive';
import { PortfolioDataService } from '../../../services/portfolio-data.service';
import { ContactService } from '../../../services/contact.service';

type SubmitState = 'idle' | 'submitting' | 'success' | 'error';

@Component({
  selector: 'app-contact',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, SectionHeadingComponent, RevealDirective, IconComponent, MagneticDirective, SpotlightDirective],
  templateUrl: './contact.component.html',
  styleUrl: './contact.component.scss'
})
export class ContactComponent {
  readonly state = signal<SubmitState>('idle');
  readonly errorMessage = signal<string>('');
  readonly form;

  constructor(
    private readonly fb: FormBuilder,
    private readonly contactService: ContactService,
    readonly data: PortfolioDataService
  ) {
    this.form = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
      email: ['', [Validators.required, Validators.email]],
      message: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(4000)]],
      website: [''] // honeypot — left empty, hidden from real visitors via CSS
    });
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.state.set('submitting');
    const { name, email, message, website } = this.form.getRawValue();

    this.contactService
      .submit({ name: name!, email: email!, message: message!, website: website ?? '' })
      .subscribe({
        next: () => {
          this.state.set('success');
          this.form.reset();
          this.celebrate();
        },
        error: () => {
          this.state.set('error');
          this.errorMessage.set('Something went wrong sending your message. Please try again, or email me directly.');
        }
      });
  }

  get name() { return this.form.controls.name; }
  get email() { return this.form.controls.email; }
  get message() { return this.form.controls.message; }

  /** A small, one-time celebratory burst on a successful send — skipped under reduced motion. */
  private celebrate(): void {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    confetti({
      particleCount: 80,
      spread: 75,
      startVelocity: 32,
      origin: { x: 0.5, y: 0.7 },
      colors: ['#5668ff', '#0878ff', '#f5f6f8'],
      disableForReducedMotion: true
    });
  }
}
