import { DestroyRef, Directive, ElementRef, afterNextRender, inject } from '@angular/core';
import { DeviceService } from '../../services/device.service';
import { MotionService } from '../../services/motion.service';

/**
 * Hover/focus text scramble: `<a><span appScramble>About</span></a>`.
 * Put it on a span that contains *only text* (GSAP rewrites its text). The
 * trigger is the nearest link/button around it, so the whole control reacts.
 * Pointer devices only; a no-op until GSAP has loaded (and in lite mode /
 * reduced motion) — the plain text is always the baseline.
 */
@Directive({ selector: '[appScramble]', standalone: true })
export class ScrambleDirective {
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly device = inject(DeviceService);
  private readonly motion = inject(MotionService);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    afterNextRender(() => {
      if (!this.device.finePointer || this.device.reducedMotion) return;
      const host = this.el.nativeElement;
      const trigger = host.closest<HTMLElement>('a, button') ?? host;
      const original = host.textContent ?? '';

      const play = () => {
        this.motion.gsap().then((kit) => {
          if (!kit || !host.isConnected) return;
          this.motion.run(() =>
            kit.gsap.to(host, {
              duration: 0.55,
              overwrite: true,
              scrambleText: { text: original, chars: 'upperAndLowerCase', speed: 0.8, revealDelay: 0.05 }
            })
          );
        });
      };

      trigger.addEventListener('pointerenter', play, { passive: true });
      trigger.addEventListener('focus', play, { passive: true });
      this.destroyRef.onDestroy(() => {
        trigger.removeEventListener('pointerenter', play);
        trigger.removeEventListener('focus', play);
        host.textContent = original;
      });
    });
  }
}
