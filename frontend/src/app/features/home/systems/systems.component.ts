import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SectionHeadingComponent } from '../../../shared/section-heading/section-heading.component';
import { RevealDirective } from '../../../shared/reveal/reveal.directive';
import { SystemsNetworkComponent } from './systems-network.component';

/**
 * Replaces the old vertical "From Idea to Production" stage list — instead
 * of describing the system as a flowchart, this renders it as what it
 * actually is: a neural network. The stat readout is real production data
 * pulled straight from the case studies (20,000+ calls/day, the 6-provider
 * failover layer, the deterministic fast-path), not invented dashboard
 * numbers.
 */
@Component({
  selector: 'app-systems',
  standalone: true,
  imports: [CommonModule, SectionHeadingComponent, RevealDirective, SystemsNetworkComponent],
  templateUrl: './systems.component.html',
  styleUrl: './systems.component.scss'
})
export class SystemsComponent {
  readonly networkEnabled: boolean;

  readonly stats = [
    { label: 'Throughput', value: '20,000+', unit: 'calls / day' },
    { label: 'Turn Latency', value: '< 1', unit: 'second' },
    { label: 'Fast-Path', value: '80%', unit: 'resolved < 50ms' },
    { label: 'LLM Providers', value: '6', unit: 'auto-failover' }
  ];

  // Mirrors the voice platform's real STT → LLM → TTS pipeline stages —
  // ACTIVE/ROUTING are decorative "live system" status labels, not a metrics feed.
  readonly liveLayers = [
    { name: 'Caller / Telephony', state: 'ACTIVE', orange: false },
    { name: 'Speech-to-Text', state: 'ACTIVE', orange: false },
    { name: 'LLM Orchestrator', state: 'ROUTING', orange: true },
    { name: 'Tools + RAG', state: 'ACTIVE', orange: true },
    { name: 'Text-to-Speech', state: 'ACTIVE', orange: false }
  ];

  constructor() {
    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    this.networkEnabled = !prefersReducedMotion;
  }
}
