import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

/**
 * "How it works" stepper for a project: numbered stages joined by a line —
 * a horizontal flow on wide screens, a vertical timeline on phones.
 */
@Component({
  selector: 'app-workflow-diagram',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './workflow-diagram.component.html',
  styleUrl: './workflow-diagram.component.scss'
})
export class WorkflowDiagramComponent {
  @Input({ required: true }) steps: readonly string[] = [];
}
