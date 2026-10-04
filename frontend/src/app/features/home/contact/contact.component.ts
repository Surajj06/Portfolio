import { ChangeDetectionStrategy, Component, ElementRef, ViewChild, computed, inject, signal } from '@angular/core';
import { RevealDirective } from '../../../shared/reveal/reveal.directive';
import { SplitDirective } from '../../../shared/split/split.directive';
import { IconComponent } from '../../../shared/icons/icon.component';
import { MagneticDirective } from '../../../shared/magnetic/magnetic.directive';
import { CopyDirective } from '../../../shared/copy/copy.directive';
import { ScrambleDirective } from '../../../shared/scramble/scramble.directive';
import { PortfolioDataService } from '../../../services/portfolio-data.service';
import { ContactService } from '../../../services/contact.service';
import { DeviceService } from '../../../services/device.service';

type SubmitState = 'idle' | 'submitting' | 'success' | 'error';
type Field = 'name' | 'email' | 'message';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Contact. The form is plain signals — three fields don't need the Forms
 * module — and keeps the original rules: name 2–120, valid email, message
 * 10–4000, plus a hidden honeypot. confetti is dynamically imported only
 * when it's actually celebrated.
 */
@Component({
  selector: 'app-contact',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RevealDirective, SplitDirective, IconComponent, MagneticDirective, CopyDirective, ScrambleDirective],
  templateUrl: './contact.component.html',
  styleUrl: './contact.component.scss'
})
export class ContactComponent {
  @ViewChild('form', { static: true }) private readonly formRef!: ElementRef<HTMLFormElement>;

  readonly data = inject(PortfolioDataService);
  private readonly contactService = inject(ContactService);
  private readonly device = inject(DeviceService);

  readonly name = signal('');
  readonly email = signal('');
  readonly message = signal('');
  readonly website = signal(''); // honeypot — real users never see or fill it

  readonly touched = signal<Record<Field, boolean>>({ name: false, email: false, message: false });
  readonly state = signal<SubmitState>('idle');
  readonly errorMessage = signal('');

  readonly errors = computed<Record<Field, string>>(() => {
    const name = this.name().trim();
    const email = this.email().trim();
    const message = this.message().trim();
    return {
      name: name.length < 2 || name.length > 120 ? 'Please enter your name (2–120 characters).' : '',
      email: !email || email.length > 254 || !EMAIL_RE.test(email) ? 'Please enter a valid email address.' : '',
      message:
        message.length < 10 || message.length > 4000 ? 'A short message helps — at least 10 characters.' : ''
    };
  });

  readonly messageLength = computed(() => this.message().length);

  show(field: Field): string {
    return this.touched()[field] ? this.errors()[field] : '';
  }

  blur(field: Field): void {
    this.touched.update((t) => ({ ...t, [field]: true }));
  }

  async submit(event: Event): Promise<void> {
    event.preventDefault();
    if (this.state() === 'submitting') return;

    this.touched.set({ name: true, email: true, message: true });
    const firstInvalid = (['name', 'email', 'message'] as Field[]).find((f) => this.errors()[f]);
    if (firstInvalid) {
      this.formRef.nativeElement.querySelector<HTMLElement>(`[name="${firstInvalid}"]`)?.focus();
      return;
    }

    this.state.set('submitting');
    try {
      await this.contactService.submit({
        name: this.name().trim(),
        email: this.email().trim(),
        message: this.message().trim(),
        website: this.website()
      });
      this.state.set('success');
      this.name.set('');
      this.email.set('');
      this.message.set('');
      this.touched.set({ name: false, email: false, message: false });
      this.burst(0.5, 0.78, 90);
    } catch {
      this.state.set('error');
      this.errorMessage.set('Something went wrong sending your message. Please try again, or email me directly.');
    }
  }

  resetForm(): void {
    this.state.set('idle');
  }

  /** Small celebratory confetti burst (lazy-loaded; skipped under reduced motion). */
  async burst(x: number, y: number, count: number): Promise<void> {
    if (this.device.reducedMotion) return;
    const { default: confetti } = await import('canvas-confetti');
    confetti({
      particleCount: count,
      spread: 75,
      startVelocity: 34,
      origin: { x, y },
      colors: ['#d6ff3f', '#a193ff', '#f4f3ee', '#6fd3ff'],
      disableForReducedMotion: true
    });
  }

  /** Confetti from wherever the copy button was clicked. */
  onCopy(event: MouseEvent): void {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    this.burst((rect.left + rect.width / 2) / window.innerWidth, (rect.top + rect.height / 2) / window.innerHeight, 36);
  }
}
