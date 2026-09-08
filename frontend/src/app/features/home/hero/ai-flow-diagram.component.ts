import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

interface FlowNode {
  label: string;
  sublabel: string;
}

/**
 * The hero's centerpiece: a vertical system diagram — User → Input → AI Engine
 * → LLM → Tools/APIs/Data → Response — with a light travelling down the
 * connecting line. Built as inline SVG so it stays crisp at any resolution
 * and needs no image assets or animation library.
 */
@Component({
  selector: 'app-ai-flow-diagram',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './ai-flow-diagram.component.html',
  styleUrl: './ai-flow-diagram.component.scss'
})
export class AiFlowDiagramComponent {
  readonly nodes: FlowNode[] = [
    { label: 'User', sublabel: 'initiates a request' },
    { label: 'Input', sublabel: 'text, voice, or event' },
    { label: 'AI Engine', sublabel: 'orchestration layer' },
    { label: 'LLM', sublabel: 'reasoning & generation' },
    { label: 'Tools / APIs / Data', sublabel: 'grounded actions' },
    { label: 'Response', sublabel: 'returned to the user' }
  ];

  readonly step = 78;
  readonly startY = 30;
  readonly nodeX = 130;
  readonly prefersReducedMotion =
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  get svgHeight(): number {
    return this.startY * 2 + this.step * (this.nodes.length - 1);
  }

  y(i: number): number {
    return this.startY + i * this.step;
  }
}
