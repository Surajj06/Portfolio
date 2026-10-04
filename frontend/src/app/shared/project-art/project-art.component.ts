import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { ProjectAccent } from '../../models/project.model';

/** Deterministic bar heights for the voice waveform (no randomness → stable SSR/hydration). */
const VOICE_BARS = Array.from({ length: 19 }, (_, i) => ({
  x: 36 + i * 14,
  h: 16 + Math.round(78 * Math.abs(Math.sin(i * 0.62 + 0.4) * Math.cos(i * 0.23)))
}));

/** Status-grid cells for the API monitor. */
const GRID_COLS = Array.from({ length: 8 }, (_, i) => i);
const GRID_ROWS = Array.from({ length: 4 }, (_, i) => i);
const GRID_WARN = new Set(['2-1', '5-2']);
const GRID_DOWN = new Set(['6-0']);

const VOLUME = [22, 38, 28, 46, 34, 52, 30, 44, 58];
const RANK_BARS = [300, 262, 226, 184, 142];
const RANK_LINES = [70, 58, 64, 48, 40];

/**
 * Original, abstract cover art for each project — drawn to hint at what the
 * system *does* (a waveform, matched records, chat, a scanned document, a
 * leaderboard, a chart, a status grid). Pure inline SVG with no ids or
 * gradients (so many instances can coexist safely), coloured from the
 * project's accent, themable via CSS variables, and static — a few hover-only
 * flourishes use transform/opacity.
 */
@Component({
  selector: 'app-project-art',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[attr.data-accent]': 'accent' },
  templateUrl: './project-art.component.html',
  styleUrl: './project-art.component.scss'
})
export class ProjectArtComponent {
  @Input({ required: true }) id!: string;
  @Input() accent: ProjectAccent = 'lime';

  readonly voiceBars = VOICE_BARS;
  readonly gridCols = GRID_COLS;
  readonly gridRows = GRID_ROWS;
  readonly volume = VOLUME;
  readonly rankBars = RANK_BARS;
  readonly rankLines = RANK_LINES;
  readonly rows = [0, 1, 2, 3, 4];

  cell(col: number, row: number): 'ok' | 'warn' | 'down' {
    const key = `${col}-${row}`;
    return GRID_DOWN.has(key) ? 'down' : GRID_WARN.has(key) ? 'warn' : 'ok';
  }
}
