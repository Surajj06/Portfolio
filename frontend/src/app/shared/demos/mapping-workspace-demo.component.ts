import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { DeviceService } from '../../services/device.service';
import { DEMO_STYLES } from './demo-styles';

/* ------------------------------------------------------------------ *
 *  Types and constants (mirrors the rules of the real import tool)
 * ------------------------------------------------------------------ */

type Target = 'cm_make_id' | 'cm_model_id' | 'cs_make_id' | 'cs_model_id';
type Check = 'ins_make_text' | 'ins_model_text' | 'fuel_type';
type Col = 'id' | Target | Check;

const TARGETS: Target[] = ['cm_make_id', 'cm_model_id', 'cs_make_id', 'cs_model_id'];
const CHECKS: Check[] = ['ins_make_text', 'ins_model_text', 'fuel_type'];
const COLS: Col[] = ['id', ...TARGETS, ...CHECKS];

const MAX_ROWS = 500;
const VALID_SECONDS = 15 * 60;
const INSURER_NAME = 'Sample Insurer';

interface GridRow {
  key: number;
  hi: boolean;
  cells: Record<Col, string>;
}

interface DbRow {
  id: number;
  cm_make_id: number;
  cm_model_id: number;
  cs_make_id: number;
  cs_model_id: number;
  ins_make_text: string;
  ins_model_text: string;
  fuel_type: string;
}

interface ImportRow {
  key: number;
  excelRow: number;
  id: number;
  targets: Record<Target, number | null>;
  make: string;
  model: string;
  fuel: string;
  issues: string[];
}

interface RowView {
  key: number;
  excelRow: number;
  state: 'ignored' | 'ok' | 'blocked';
  pills: string[];
}

interface ImportResult {
  fatal: string[];
  rows: ImportRow[];
  views: Map<number, RowView>;
  highlighted: number;
}

interface Change {
  col: Target;
  from: number | null;
  to: number;
}

interface ValIssue {
  field: string;
  kind: 'mismatch' | 'missing' | 'notfound' | 'import';
  text: string;
}

type ValStatus = 'Invalid' | 'Not found' | 'Mismatch' | 'Unchanged' | 'Ready';

interface ValRow {
  row: ImportRow;
  status: ValStatus;
  issues: ValIssue[];
  changes: Change[];
}

interface LogLine {
  kind: 'info' | 'ok' | 'bad' | 'warn';
  text: string;
}

type ApplyStatus = 'idle' | 'running' | 'committed' | 'rolledback' | 'review';

/* ------------------------------------------------------------------ *
 *  Pure rules (a TypeScript port of the .NET validation logic)
 * ------------------------------------------------------------------ */

const isFormula = (s: string): boolean => s.trim().startsWith('=');

/** Whole numbers only, stored as plain values: "12.0" and "1e3" are whole, "12.5" is not. */
function tryInteger(raw: string): number | null {
  const s = raw.trim();
  if (!/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(s)) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || !Number.isInteger(n) || Math.abs(n) > Number.MAX_SAFE_INTEGER) return null;
  return n;
}

/** Case and repeated whitespace are ignored when comparing with the database. */
const normText = (s: string | null | undefined): string => (s ?? '').replace(/\s+/g, ' ').trim().toLowerCase();

function parseImport(grid: GridRow[], simulateOver: boolean): ImportResult {
  const fatal: string[] = [];
  const rows: ImportRow[] = [];
  const views = new Map<number, RowView>();
  const seen = new Set<number>();
  let highlighted = 0;

  grid.forEach((g, idx) => {
    const excelRow = idx + 2; // header sits on row 1
    const view: RowView = { key: g.key, excelRow, state: 'ignored', pills: [] };
    views.set(g.key, view);
    const idRaw = g.cells.id.trim();
    if (!g.hi || idRaw === '') {
      view.pills = [g.hi ? 'ignored: empty ID' : 'ignored: not highlighted'];
      return;
    }
    highlighted++;
    view.state = 'blocked';

    if (isFormula(idRaw)) {
      fatal.push('Excel row ' + excelRow + ' has an invalid ID. IDs must be whole numbers stored as values.');
      view.pills = ['ID is a formula'];
      return;
    }
    const id = tryInteger(idRaw);
    if (id === null) {
      fatal.push('Excel row ' + excelRow + ' has an invalid ID. IDs must be whole numbers stored as values.');
      view.pills = ['ID not a whole number'];
      return;
    }
    if (seen.has(id)) {
      fatal.push('Duplicate ID ' + id + ' in highlighted rows. Each ID must be unique.');
      view.pills = ['duplicate ID'];
      return;
    }
    seen.add(id);

    const issues: string[] = [];
    const targets = {} as Record<Target, number | null>;
    for (const t of TARGETS) {
      const raw = g.cells[t].trim();
      if (raw === '') targets[t] = null;
      else if (isFormula(raw)) {
        targets[t] = null;
        issues.push(t + ' contains a formula. Paste values before importing.');
      } else {
        const n = tryInteger(raw);
        if (n === null) {
          targets[t] = null;
          issues.push(t + ' must be a whole number or blank.');
        } else targets[t] = n;
      }
    }
    rows.push({
      key: g.key,
      excelRow,
      id,
      targets,
      make: g.cells.ins_make_text.trim(),
      model: g.cells.ins_model_text.trim(),
      fuel: g.cells.fuel_type.trim(),
      issues,
    });
    if (issues.length) {
      view.state = 'blocked';
      view.pills = issues.map((i) => (i.includes('formula') ? 'formula in ' + i.split(' ')[0] : 'bad value in ' + i.split(' ')[0]));
    } else {
      view.state = 'ok';
      view.pills = ['imported'];
    }
  });

  if (simulateOver) {
    highlighted = MAX_ROWS + 1;
    fatal.unshift('More than ' + MAX_ROWS + ' yellow rows found. Split the workbook into smaller runs.');
  } else if (highlighted > MAX_ROWS) {
    fatal.unshift('More than ' + MAX_ROWS + ' yellow rows found. Split the workbook into smaller runs.');
  }
  if (highlighted === 0) fatal.push('No yellow-highlighted ID cells found. Highlight the ID cells of the rows you want to update.');
  return { fatal, rows, views, highlighted };
}

function validateRows(rows: ImportRow[], db: DbRow[], skipFuel: boolean): ValRow[] {
  return rows.map((row): ValRow => {
    if (row.issues.length) {
      return { row, status: 'Invalid', issues: row.issues.map((t) => ({ field: t.split(' ')[0], kind: 'import' as const, text: t })), changes: [] };
    }
    const live = db.find((d) => d.id === row.id);
    if (!live) {
      return { row, status: 'Not found', issues: [{ field: 'id', kind: 'notfound', text: 'This ID does not exist in the insurer table.' }], changes: [] };
    }
    const issues: ValIssue[] = [];
    const pairs: Array<[Check, string, string]> = [
      ['ins_make_text', row.make, live.ins_make_text],
      ['ins_model_text', row.model, live.ins_model_text],
      ['fuel_type', row.fuel, live.fuel_type],
    ];
    for (const [field, workbook, database] of pairs) {
      if (field === 'fuel_type' && skipFuel) continue;
      const a = normText(workbook);
      const b = normText(database);
      if (!a.length || !b.length) {
        issues.push({ field, kind: 'missing', text: field + ' is missing in the workbook or database.' });
      } else if (a !== b) {
        issues.push({ field, kind: 'mismatch', text: field + ": workbook '" + workbook + "' differs from database '" + database + "'." });
      }
    }
    if (issues.length) return { row, status: 'Mismatch', issues, changes: [] };
    const changes: Change[] = [];
    for (const t of TARGETS) {
      const want = row.targets[t];
      if (want !== null && live[t] !== want) changes.push({ col: t, from: live[t], to: want });
    }
    return { row, status: changes.length ? 'Ready' : 'Unchanged', issues: [], changes };
  });
}

/* ------------------------------------------------------------------ *
 *  Synthetic data
 * ------------------------------------------------------------------ */

const DB_ROWS: DbRow[] = [
  { id: 1001, cm_make_id: 11, cm_model_id: 210, cs_make_id: 5, cs_model_id: 88, ins_make_text: 'TATA MOTORS', ins_model_text: 'ACE GOLD', fuel_type: 'PETROL' },
  { id: 1002, cm_make_id: 11, cm_model_id: 212, cs_make_id: 5, cs_model_id: 91, ins_make_text: 'TATA MOTORS', ins_model_text: 'LPT 1109', fuel_type: 'DIESEL' },
  { id: 1003, cm_make_id: 14, cm_model_id: 301, cs_make_id: 7, cs_model_id: 120, ins_make_text: 'MAHINDRA', ins_model_text: 'BOLERO PIK UP', fuel_type: 'DIESEL' },
  { id: 1004, cm_make_id: 14, cm_model_id: 305, cs_make_id: 7, cs_model_id: 124, ins_make_text: 'MAHINDRA', ins_model_text: 'JEETO PLUS', fuel_type: 'CNG' },
  { id: 1005, cm_make_id: 17, cm_model_id: 410, cs_make_id: 9, cs_model_id: 150, ins_make_text: 'ASHOK LEYLAND', ins_model_text: 'DOST LS', fuel_type: 'DIESEL' },
  { id: 1006, cm_make_id: 17, cm_model_id: 415, cs_make_id: 9, cs_model_id: 155, ins_make_text: 'ASHOK LEYLAND', ins_model_text: 'ECOMET 1615', fuel_type: 'DIESEL' },
  { id: 1007, cm_make_id: 21, cm_model_id: 520, cs_make_id: 12, cs_model_id: 190, ins_make_text: 'EICHER', ins_model_text: 'PRO 2049', fuel_type: 'CNG' },
  { id: 1008, cm_make_id: 21, cm_model_id: 522, cs_make_id: 12, cs_model_id: 193, ins_make_text: 'EICHER', ins_model_text: 'PRO 2095', fuel_type: 'DIESEL' },
  { id: 1009, cm_make_id: 25, cm_model_id: 610, cs_make_id: 14, cs_model_id: 220, ins_make_text: 'BHARATBENZ', ins_model_text: '1617R', fuel_type: 'DIESEL' },
  { id: 1010, cm_make_id: 11, cm_model_id: 215, cs_make_id: 5, cs_model_id: 95, ins_make_text: 'TATA MOTORS', ins_model_text: 'SIGNA 4825 TK', fuel_type: '' },
];

function seedGrid(): GridRow[] {
  const mk = (key: number, hi: boolean, v: string[]): GridRow => ({
    key,
    hi,
    cells: {
      id: v[0],
      cm_make_id: v[1],
      cm_model_id: v[2],
      cs_make_id: v[3],
      cs_model_id: v[4],
      ins_make_text: v[5],
      ins_model_text: v[6],
      fuel_type: v[7],
    },
  });
  return [
    mk(1, true, ['1001', '11', '216', '', '92', 'TATA MOTORS', 'ACE GOLD', 'Petrol']),
    mk(2, true, ['1002', '11', '212', '5', '-1', 'tata  motors', 'LPT 1109', 'diesel']),
    mk(3, true, ['1003', '', '310', '', '', 'MAHINDRA', 'BOLERO PIK UP', 'DIESEL']),
    mk(4, true, ['1004', '14', '305', '7', '124', 'MAHINDRA', 'JEETO PLUS', 'CNG']),
    mk(5, false, ['1005', '17', '420', '9', '150', 'ASHOK LEYLAND', 'DOST LS', 'DIESEL']),
    mk(6, true, ['1006', '17', '415', '9', '160', 'ASHOK LEYLAND', 'ECOMET 1516', 'DIESEL']),
    mk(7, true, ['1007', '21', '521', '12', '191', 'EICHER', 'PRO 2049', 'CNG']),
    mk(8, false, ['1008', '21', '522', '12', '193', 'EICHER', 'PRO 2095', 'DIESEL']),
    mk(9, true, ['1009', '25', '611', '14', '12.5', 'BHARATBENZ', '1617R', 'DIESEL']),
    mk(10, true, ['1010', '11', '215', '5', '96', 'TATA MOTORS', 'SIGNA 4825 TK', 'DIESEL']),
  ];
}

interface DbCell {
  text: string;
  old: string;
  changed: boolean;
}

/* ------------------------------------------------------------------ *
 *  Component
 * ------------------------------------------------------------------ */

@Component({
  selector: 'app-mapping-workspace-demo',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="demo" aria-labelledby="mw-title">
      <div class="demo__bar">
        <strong class="demo__title" id="mw-title">Vehicle mapping workspace</strong>
        <span class="demo__tag">Interactive &middot; runs in your browser</span>
      </div>

      <div class="demo__body">
        <ol class="stepper" aria-label="Workflow steps">
          @for (s of steps; track s.n) {
            <li>
              <button type="button" class="step" [class.on]="step() === s.n" [attr.aria-current]="step() === s.n ? 'step' : null" [disabled]="!reachable(s.n)" (click)="goTo(s.n)">
                <span class="step__n">{{ s.n }}</span> {{ s.label }}
              </button>
            </li>
          }
        </ol>

        <!-- ================= 1 IMPORT ================= -->
        @if (step() === 1) {
          <div class="panel">
            <p class="hint">
              Only rows whose <strong>ID cell has a solid yellow fill</strong> are imported. Click a row's highlight toggle, and edit any cell: try <code>-1</code>, <code>12.5</code>,
              a blank, text, or <code>=A1+1</code>. Changing an ID to <code>1099</code> or a duplicate shows what the importer does with it.
            </p>
            <div class="tbl grid-tbl">
              <table>
                <caption class="sr-only">Mock worksheet. Header on row 1.</caption>
                <thead>
                  <tr>
                    <th>Row</th><th>Yellow ID</th>
                    @for (c of cols; track c) { <th>{{ c }}</th> }
                    <th>Importer sees</th>
                  </tr>
                </thead>
                <tbody>
                  @for (g of grid(); track g.key; let i = $index) {
                    <tr [class.dim]="!g.hi">
                      <td class="mono">{{ i + 2 }}</td>
                      <td>
                        <button type="button" class="hl" [attr.aria-pressed]="g.hi" [disabled]="locked()" [attr.aria-label]="'Excel row ' + (i + 2) + ': ID cell highlighted yellow'" (click)="toggleHi(g.key)">
                          <span class="sw" [class.y]="g.hi"></span>{{ g.hi ? 'Yellow' : 'No fill' }}
                        </button>
                      </td>
                      @for (c of cols; track c) {
                        <td>
                          <input class="cell" type="text" [class.yellow]="c === 'id' && g.hi" [class.wide]="c === 'ins_model_text' || c === 'ins_make_text'" [value]="g.cells[c]" [disabled]="locked()" [attr.aria-label]="'Excel row ' + (i + 2) + ' ' + c" (input)="setCell(g.key, c, $any($event.target).value)" />
                        </td>
                      }
                      <td class="pills">
                        @if (viewOf(g.key); as v) {
                          @for (p of v.pills; track p) {
                            <span class="pill" [class.ok]="v.state === 'ok'" [class.bad]="v.state === 'blocked'" [class.mute]="v.state === 'ignored'">{{ v.state === 'ok' ? '✓ ' : v.state === 'blocked' ? '✗ ' : '' }}{{ p }}</span>
                          }
                        }
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
            <label class="chk">
              <input type="checkbox" [checked]="simulateOver()" [disabled]="locked()" (change)="setOver($any($event.target).checked)" />
              <span>Pretend the sheet has 501 highlighted rows (limit is {{ maxRows }})</span>
            </label>
            <div aria-live="polite">
              @if (imported().fatal.length) {
                <div class="alert" role="alert">
                  <strong>Import rejected (the real tool stops here):</strong>
                  <ul>@for (f of imported().fatal; track f) { <li>{{ f }}</li> }</ul>
                </div>
              } @else {
                <p class="hint">
                  <span class="pill ok">&#10003; importable</span>
                  {{ imported().rows.length }} highlighted rows imported, {{ ignoredCount() }} ignored,
                  {{ blockedAtImport() }} blocked by value rules.
                </p>
              }
            </div>
            <div class="row">
              <button type="button" class="dbtn dbtn--primary" [disabled]="!canImport()" (click)="goTo(2)">Import highlighted rows</button>
              <button type="button" class="dbtn" (click)="resetDemo()">Reset demo</button>
            </div>
          </div>
        }

        <!-- ================= 2 PREVIEW ================= -->
        @if (step() === 2) {
          <div class="panel">
            <div class="kvs">
              <div class="kv"><strong>{{ imported().highlighted }}</strong><span>highlighted rows</span></div>
              <div class="kv"><strong>{{ ignoredCount() }}</strong><span>ignored (not highlighted)</span></div>
              <div class="kv"><strong>{{ blockedAtImport() }}</strong><span>blocked by value rules</span></div>
              <div class="kv"><strong>{{ maxRows }}</strong><span>row limit (also 100,000 sheet rows, 20 MB)</span></div>
            </div>
            <div class="tbl">
              <table>
                <caption class="sr-only">Preview of imported rows</caption>
                <thead>
                  <tr><th>Row</th><th>id</th>@for (t of targets; track t) {<th>{{ t }}</th>}<th>Make / model / fuel</th><th>Status</th></tr>
                </thead>
                <tbody>
                  @for (r of imported().rows; track r.key) {
                    <tr>
                      <td class="mono">{{ r.excelRow }}</td><td>{{ r.id }}</td>
                      @for (t of targets; track t) {
                        <td>@if (r.targets[t] === null) {<span class="muted">leave unchanged</span>} @else {<span>{{ r.targets[t] }}</span>}</td>
                      }
                      <td>{{ r.make }} / {{ r.model }} / {{ r.fuel }}</td>
                      <td>
                        @if (r.issues.length) { <span class="pill bad">&#10007; Invalid</span> <span class="small">{{ r.issues[0] }}</span> }
                        @else { <span class="pill info">Ready for validation</span> }
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
            <p class="hint small">Blank target = leave unchanged. Negative whole numbers such as -1 are allowed. Fractions, text and formulas block their row.</p>
            <div class="row">
              <button type="button" class="dbtn" (click)="goTo(1)">Back</button>
              <button type="button" class="dbtn dbtn--primary" (click)="goTo(3)">Continue to validation</button>
            </div>
          </div>
        }

        <!-- ================= 3 VALIDATE ================= -->
        @if (step() === 3) {
          <div class="panel">
            <div class="row">
              <button type="button" class="dbtn dbtn--primary" (click)="runValidation()">Validate against database</button>
              <label class="chk">
                <input type="checkbox" [checked]="skipFuel()" (change)="setSkipFuel($any($event.target).checked)" />
                <span>Skip fuel validation (two insurers are configured this way)</span>
              </label>
            </div>
            <div aria-live="polite" class="col">
              @if (validated(); as vr) {
                <p class="hint">
                  <span class="pill info">Validated</span>
                  <strong>{{ readyRows().length }}</strong> ready, <strong>{{ unchangedCount() }}</strong> unchanged, <strong>{{ blockedCount() }}</strong> blocked.
                  Preview {{ remaining() > 0 ? 'expires in ' : 'expired ' }}<strong class="mono">{{ remaining() > 0 ? clock() : '00:00' }}</strong>
                  <button type="button" class="dbtn dbtn--sm" (click)="fastForward()" [disabled]="remaining() === 0">Fast-forward 14 min</button>
                </p>
                <div class="tbl">
                  <table>
                    <caption class="sr-only">Validation results per row</caption>
                    <thead><tr><th>id</th><th>Result</th><th>Detail</th></tr></thead>
                    <tbody>
                      @for (v of vr; track v.row.key) {
                        <tr>
                          <td>{{ v.row.id }}</td>
                          <td>
                            @if (v.status === 'Ready') { <span class="pill ok">&#10003; Ready</span> }
                            @else if (v.status === 'Unchanged') { <span class="pill mute">Unchanged</span> }
                            @else { <span class="pill bad">&#10007; {{ v.status === 'Mismatch' ? 'Blocked' : v.status }}</span> }
                          </td>
                          <td class="detail">
                            @if (v.status === 'Ready') {
                              @for (c of v.changes; track c.col) { <span class="chgtxt">{{ c.col }}: {{ c.from }} &rarr; {{ c.to }}</span> }
                            } @else if (v.status === 'Unchanged') {
                              <span class="muted">Matches the database; nothing to change.</span>
                            } @else {
                              @for (i of v.issues; track i.text) {
                                <div><span class="pill" [class.warn]="i.kind === 'missing'" [class.bad]="i.kind !== 'missing'">{{ i.field }} {{ i.kind === 'missing' ? 'missing' : i.kind === 'mismatch' ? 'differs' : '' }}</span> <span class="small">{{ i.text }}</span></div>
                              }
                            }
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              } @else {
                <p class="hint">Press <strong>Validate against database</strong>. Make, model and fuel are compared with the synthetic snapshot below, ignoring case and repeated spaces. A mismatch or a missing value blocks the row.</p>
              }
            </div>
            <div>
              <strong class="sub">Database snapshot (synthetic)</strong>
              <div class="tbl">
                <table>
                  <caption class="sr-only">Database snapshot</caption>
                  <thead><tr>@for (c of cols; track c) {<th>{{ c }}</th>}</tr></thead>
                  <tbody>
                    @for (d of dbView(); track d.id) {
                      <tr>
                        @for (cell of d.cells; track $index) {
                          <td [class.chg]="cell.changed">@if (cell.changed) {<s>{{ cell.old }}</s> &rarr; <strong>{{ cell.text }}</strong>} @else {<span>{{ cell.text || '(blank)' }}</span>}</td>
                        }
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
            <div class="row">
              <button type="button" class="dbtn" (click)="goTo(2)">Back</button>
              <button type="button" class="dbtn dbtn--primary" [disabled]="validated() === null" (click)="goTo(4)">Continue to apply</button>
            </div>
          </div>
        }

        <!-- ================= 4 APPLY ================= -->
        @if (step() === 4) {
          <div class="panel">
            <div class="grid-2">
              <div class="col">
                <label class="chk">
                  <input type="checkbox" [checked]="writes()" [disabled]="applyBusy()" (change)="writes.set($any($event.target).checked)" />
                  <span>Writes enabled (off by default, like the server setting)</span>
                </label>
                <label class="field">
                  <span>Type the insurer name to confirm</span>
                  <input type="text" [value]="confirmText()" [disabled]="applyBusy()" (input)="confirmText.set($any($event.target).value)" [attr.placeholder]="insurer" autocomplete="off" aria-describedby="mw-confirm-hint" />
                </label>
                <p class="hint small" id="mw-confirm-hint">Must match exactly, including case: <code>{{ insurer }}</code></p>
                <label class="field">
                  <span>Simulate</span>
                  <select [disabled]="applyBusy()" (change)="simulate.set($any($event.target).value)">
                    <option value="none" [selected]="simulate() === 'none'">Nothing goes wrong</option>
                    <option value="fail" [selected]="simulate() === 'fail'">Failure on one row</option>
                    <option value="commit" [selected]="simulate() === 'commit'">Interruption during COMMIT</option>
                  </select>
                </label>
                @if (simulate() === 'fail') {
                  <label class="field">
                    <span>Fail on row</span>
                    <select [disabled]="applyBusy()" (change)="setFail($any($event.target).value)">
                      @for (r of readyRows(); track r.row.id) { <option [value]="r.row.id" [selected]="r.row.id === failId()">Row {{ r.row.id }} (UPDATE #{{ $index + 1 }})</option> }
                    </select>
                  </label>
                }
              </div>
              <div class="col" aria-live="polite">
                <strong class="sub">Pre-flight checks</strong>
                <ul class="checks">
                  @for (c of checks(); track c.text) {
                    <li><span class="pill" [class.ok]="c.ok" [class.bad]="!c.ok">{{ c.ok ? '✓ ok' : '✗ no' }}</span> {{ c.text }}</li>
                  }
                </ul>
                <div class="row">
                  <button type="button" class="dbtn dbtn--primary" [disabled]="!canApply()" (click)="apply()">Apply {{ readyRows().length }} rows</button>
                  <button type="button" class="dbtn" (click)="goTo(3)" [disabled]="applyBusy()">Back</button>
                </div>
                @if (!canApply() && applyStatus() !== 'running') {
                  <p class="hint">{{ blockMessage() }}</p>
                }
              </div>
            </div>

            <div aria-live="polite" class="col">
              @if (log().length) {
                <strong class="sub">Transaction</strong>
                <ul class="log tx">
                  @for (l of log(); track $index) {
                    <li class="ln"><span class="pill" [class.ok]="l.kind === 'ok'" [class.bad]="l.kind === 'bad'" [class.warn]="l.kind === 'warn'" [class.mute]="l.kind === 'info'">{{ l.kind === 'ok' ? '✓' : l.kind === 'bad' ? '✗' : l.kind === 'warn' ? '!' : '·' }}</span><span>{{ l.text }}</span></li>
                  }
                </ul>
              }
              @if (applyStatus() === 'committed') {
                <p class="hint"><span class="pill ok">&#10003; Completed</span> All {{ lastCount() }} rows were applied together and verified. The run cannot be applied again.</p>
              } @else if (applyStatus() === 'rolledback') {
                <p class="hint"><span class="pill bad">&#10007; Rolled back</span> Nothing changed in the database. The run returns to Imported and must be validated again.</p>
              } @else if (applyStatus() === 'review') {
                <p class="hint"><span class="pill warn">! Review required</span> The outcome of the commit is unknown, so retrying is blocked until someone inspects the database.</p>
              }
            </div>

            <div class="grid-2">
              <div class="col">
                <strong class="sub">Database snapshot {{ applyStatus() === 'committed' ? '(after apply: old → new)' : '' }}</strong>
                <div class="tbl">
                  <table>
                    <caption class="sr-only">Database snapshot with applied changes</caption>
                    <thead><tr>@for (c of cols; track c) {<th>{{ c }}</th>}</tr></thead>
                    <tbody>
                      @for (d of dbView(); track d.id) {
                        <tr>
                          @for (cell of d.cells; track $index) {
                            <td [class.chg]="cell.changed">@if (cell.changed) {<s>{{ cell.old }}</s> &rarr; <strong>{{ cell.text }}</strong>} @else {<span>{{ cell.text || '(blank)' }}</span>}</td>
                          }
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              </div>
              <div class="col">
                <strong class="sub">Audit log (metadata only)</strong>
                <ul class="log">
                  @for (e of audit(); track $index) { <li><time>{{ e.time }}</time><span>{{ e.text }}</span></li> }
                  @empty { <li><span>No events yet.</span></li> }
                </ul>
                <p class="hint small">Stores counts, status and timestamps, never worksheet rows. Deleted after 24 hours.</p>
              </div>
            </div>
            <div class="row"><button type="button" class="dbtn" (click)="resetDemo()" [disabled]="applyBusy()">Reset demo</button></div>
          </div>
        }
      </div>

      <p class="demo__note">
        Synthetic data only: ten made-up rows and a ten-row snapshot, no real database or workbook. The validation and import rules are a direct TypeScript port of the real
        tool. Simplified: the real importer stops the whole file on a bad ID instead of marking one row, the transaction here is animated rather than executed, and the
        apply step re-reads rows from memory instead of SQL. Nineteen insurer configurations with column aliases are reduced to a single one.
      </p>
    </section>
  `,
  styles: [
    DEMO_STYLES,
    `
      code { font-family: var(--font-mono); font-size: 0.82em; padding: 1px 6px; border-radius: 4px; background: var(--surface-2); }
      .mono { font-family: var(--font-mono); font-size: 0.8rem; }
      .small { font-size: 0.78rem; color: var(--text-3); }
      .muted { color: var(--text-3); font-size: 0.78rem; }
      .sub { font-size: 0.82rem; }
      .panel { display: grid; gap: 16px; animation: mw-in .4s var(--ease-out) both; min-width: 0; }
      @keyframes mw-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }

      .stepper { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); }
      .step { width: 100%; min-height: 44px; display: flex; align-items: center; gap: 10px; padding: 0 14px; border: 1px solid var(--line-2); border-radius: var(--r-sm); background: transparent; color: var(--text-2); font: inherit; font-size: 0.86rem; font-weight: 600; cursor: pointer; transition: background-color .2s ease, border-color .2s ease; }
      .step:hover:not(:disabled) { border-color: var(--text); }
      .step:disabled { opacity: 0.45; cursor: not-allowed; }
      .step.on { background: var(--accent-soft); border-color: var(--accent-line); color: var(--text); }
      .step:focus-visible { outline: 2px solid var(--accent-text); outline-offset: 2px; }
      .step__n { display: inline-grid; place-items: center; width: 24px; height: 24px; border-radius: 50%; background: var(--surface-2); font-family: var(--font-mono); font-size: 0.74rem; flex: none; }
      .step.on .step__n { background: var(--lime); color: #101510; }

      .grid-tbl { max-height: 420px; overflow: auto; }
      .grid-tbl th { position: sticky; top: 0; z-index: 1; }
      tr.dim td { opacity: 0.55; }
      tr.dim td:nth-child(2) { opacity: 1; }
      .cell { width: 86px; min-height: 38px; padding: 6px 8px; border: 1px solid var(--line-2); border-radius: 6px; background: var(--bg-2); color: var(--text); font: inherit; font-family: var(--font-mono); font-size: 0.8rem; }
      .cell.wide { width: 150px; }
      .cell.yellow { background: #ffff00; color: #1a1a00; border-color: #c9c900; font-weight: 700; }
      .cell:focus-visible { outline: 2px solid var(--accent-text); outline-offset: 1px; }
      .cell:disabled { opacity: 0.6; }
      .hl { display: inline-flex; align-items: center; gap: 8px; min-height: 44px; padding: 0 12px; border: 1px solid var(--line-2); border-radius: var(--r-sm); background: transparent; color: var(--text); font: inherit; font-size: 0.78rem; cursor: pointer; white-space: nowrap; }
      .hl[aria-pressed='true'] { border-color: #c9c900; background: color-mix(in srgb, #ffff00 14%, transparent); }
      .hl:disabled { opacity: 0.5; cursor: not-allowed; }
      .hl:focus-visible { outline: 2px solid var(--accent-text); outline-offset: 2px; }
      .sw { width: 16px; height: 16px; border-radius: 3px; border: 1px solid var(--line-2); background: transparent; flex: none; }
      .sw.y { background: #ffff00; border-color: #c9c900; }
      td.pills { white-space: normal; min-width: 170px; }
      td.pills .pill { margin: 2px 4px 2px 0; white-space: normal; }
      td.detail { white-space: normal; min-width: 260px; }
      .chgtxt { display: inline-block; margin-right: 12px; font-family: var(--font-mono); font-size: 0.78rem; }
      .chk { display: flex; gap: 10px; align-items: center; min-height: 44px; font-size: 0.88rem; color: var(--text-2); cursor: pointer; }
      .chk input { width: 20px; height: 20px; accent-color: var(--lime); flex: none; }
      .alert { padding: 12px 14px; border: 1px solid color-mix(in srgb, var(--coral) 55%, transparent); border-radius: var(--r-sm); background: color-mix(in srgb, var(--coral) 9%, transparent); font-size: 0.86rem; }
      .alert ul { margin: 6px 0 0; padding-left: 18px; }

      td.chg { background: color-mix(in srgb, var(--lime) 20%, transparent); }
      td.chg s { color: var(--text-3); }
      .checks { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; font-size: 0.86rem; color: var(--text-2); }
      .checks li { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
      .tx { max-height: 320px; }
      .ln { animation: mw-in .35s var(--ease-out) both; align-items: center; }
      .ln .pill { min-width: 28px; justify-content: center; flex: none; }
    `,
  ],
})
export class MappingWorkspaceDemoComponent {
  private readonly device = inject(DeviceService);
  private readonly destroyRef = inject(DestroyRef);
  private timers: Array<ReturnType<typeof setTimeout>> = [];
  private countdown: ReturnType<typeof setInterval> | null = null;

  readonly cols = COLS;
  readonly targets = TARGETS;
  readonly maxRows = MAX_ROWS;
  readonly insurer = INSURER_NAME;
  readonly steps = [
    { n: 1, label: 'Import' },
    { n: 2, label: 'Preview' },
    { n: 3, label: 'Validate' },
    { n: 4, label: 'Apply' },
  ];

  readonly step = signal(1);
  readonly grid = signal<GridRow[]>(seedGrid());
  readonly db = signal<DbRow[]>(DB_ROWS.map((d) => ({ ...d })));
  readonly simulateOver = signal(false);
  readonly skipFuel = signal(false);

  readonly validated = signal<ValRow[] | null>(null);
  readonly remaining = signal(VALID_SECONDS);

  readonly writes = signal(false);
  readonly confirmText = signal('');
  readonly simulate = signal<'none' | 'fail' | 'commit'>('none');
  readonly failId = signal(0);
  readonly applyStatus = signal<ApplyStatus>('idle');
  readonly log = signal<LogLine[]>([]);
  readonly audit = signal<Array<{ time: string; text: string }>>([]);
  readonly lastCount = signal(0);

  readonly imported = computed(() => parseImport(this.grid(), this.simulateOver()));
  readonly canImport = computed(() => this.imported().fatal.length === 0 && this.imported().rows.length > 0);
  readonly ignoredCount = computed(() => Array.from(this.imported().views.values()).filter((v) => v.state === 'ignored').length);
  readonly blockedAtImport = computed(() => this.imported().rows.filter((r) => r.issues.length > 0).length);
  readonly locked = computed(() => ['running', 'committed', 'review'].includes(this.applyStatus()));
  readonly applyBusy = computed(() => this.applyStatus() === 'running');

  readonly readyRows = computed(() => (this.validated() ?? []).filter((v) => v.status === 'Ready'));
  readonly unchangedCount = computed(() => (this.validated() ?? []).filter((v) => v.status === 'Unchanged').length);
  readonly blockedCount = computed(() => (this.validated() ?? []).filter((v) => v.status !== 'Ready' && v.status !== 'Unchanged').length);

  readonly clock = computed(() => {
    const s = this.remaining();
    return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  });

  readonly checks = computed(() => [
    { ok: this.writes(), text: 'Database writes are enabled' },
    { ok: this.confirmText() === INSURER_NAME, text: 'Insurer name typed exactly' },
    { ok: this.validated() !== null && this.remaining() > 0, text: 'Preview validated within the last 15 minutes' },
    { ok: this.readyRows().length > 0, text: 'At least one row is ready to apply' },
    { ok: this.applyStatus() === 'idle' || this.applyStatus() === 'rolledback', text: 'This run has not been applied yet (it applies once)' },
  ]);
  readonly canApply = computed(() => this.checks().every((c) => c.ok));
  readonly blockMessage = computed(() => {
    const first = this.checks().find((c) => !c.ok);
    if (!first) return '';
    if (!this.writes()) return 'Apply is disabled: database writes are off. Tick "Writes enabled" first, exactly like the real server setting.';
    if (this.applyStatus() === 'committed') return 'Apply is disabled: this run already completed and cannot be applied again.';
    if (this.applyStatus() === 'review') return 'Apply is disabled: the run needs review before anything else happens.';
    if (this.validated() === null) return 'Apply is disabled: validate the workbook first (a rolled-back run must be validated again).';
    if (this.remaining() === 0) return 'Apply is disabled: the preview expired after 15 minutes. Go back and validate again.';
    if (this.confirmText() !== INSURER_NAME) return 'Apply is disabled: type the insurer name exactly to confirm.';
    return 'Apply is disabled: ' + first.text.toLowerCase() + ' is not satisfied.';
  });

  readonly dbView = computed(() => {
    const now = this.db();
    return DB_ROWS.map((orig) => {
      const cur = now.find((n) => n.id === orig.id) ?? orig;
      const cells: DbCell[] = COLS.map((c) => {
        const o = String(orig[c]);
        const n = String(cur[c]);
        return { text: n, old: o, changed: o !== n };
      });
      return { id: orig.id, cells };
    });
  });

  constructor() {
    this.destroyRef.onDestroy(() => this.stopAll());
  }

  setFail(v: string): void {
    this.failId.set(Number(v));
  }

  viewOf(key: number): RowView | undefined {
    return this.imported().views.get(key);
  }

  reachable(n: number): boolean {
    if (this.applyBusy()) return false;
    if (n === 1) return true;
    if (n === 2 || n === 3) return this.canImport();
    return this.validated() !== null || this.applyStatus() === 'committed' || this.applyStatus() === 'review' || this.applyStatus() === 'rolledback';
  }

  goTo(n: number): void {
    if (!this.reachable(n)) return;
    if (this.step() === 1 && n >= 2) {
      const imp = this.imported();
      this.pushAudit('Imported workbook: ' + imp.highlighted + ' highlighted rows, ' + imp.rows.filter((r) => r.issues.length > 0).length + ' blocked by value rules. No rows stored.');
    }
    this.step.set(n);
  }

  setCell(key: number, col: Col, value: string): void {
    this.grid.update((rows) => rows.map((r) => (r.key === key ? { ...r, cells: { ...r.cells, [col]: value } } : r)));
    this.invalidate();
  }

  toggleHi(key: number): void {
    this.grid.update((rows) => rows.map((r) => (r.key === key ? { ...r, hi: !r.hi } : r)));
    this.invalidate();
  }

  setOver(v: boolean): void {
    this.simulateOver.set(v);
    this.invalidate();
  }

  setSkipFuel(v: boolean): void {
    this.skipFuel.set(v);
    this.invalidate();
  }

  /** Any edit to the workbook or rules makes an earlier validation stale. */
  private invalidate(): void {
    if (this.validated() !== null) {
      this.validated.set(null);
      this.stopCountdown();
      this.remaining.set(VALID_SECONDS);
    }
  }

  runValidation(): void {
    const result = validateRows(this.imported().rows, this.db(), this.skipFuel());
    this.validated.set(result);
    const ready = result.filter((v) => v.status === 'Ready');
    this.failId.set(ready.length ? ready[ready.length - 1].row.id : 0);
    this.remaining.set(VALID_SECONDS);
    this.stopCountdown();
    this.countdown = setInterval(() => {
      const next = this.remaining() - 1;
      this.remaining.set(Math.max(0, next));
      if (next <= 0) this.stopCountdown();
    }, 1000);
    const blocked = result.filter((v) => v.status !== 'Ready' && v.status !== 'Unchanged').length;
    this.pushAudit('Validated against database: ' + ready.length + ' ready, ' + blocked + ' blocked. No data written.');
  }

  fastForward(): void {
    this.remaining.set(Math.max(0, this.remaining() - 14 * 60));
    if (this.remaining() === 0) this.stopCountdown();
  }

  apply(): void {
    if (!this.canApply()) return;
    const ready = [...this.readyRows()].sort((a, b) => a.row.id - b.row.id);
    const sim = this.simulate();
    const failId = this.failId();
    const lines: LogLine[] = [{ kind: 'info', text: 'BEGIN TRANSACTION (isolation: SERIALIZABLE)' }];
    let outcome: 'committed' | 'rolledback' | 'review' = 'committed';
    let done = 0;
    for (const v of ready) {
      const id = v.row.id;
      lines.push({ kind: 'info', text: 'SELECT ... WITH (UPDLOCK, HOLDLOCK) WHERE id=' + id + ' -> row locked, still equals the validated snapshot' });
      if (sim === 'fail' && id === failId) {
        lines.push({ kind: 'bad', text: 'UPDATE id=' + id + ' -> 0 rows affected (simulated failure). Exactly 1 is required.' });
        lines.push({ kind: 'warn', text: 'ROLLBACK -> ' + done + ' earlier UPDATE(s) undone' });
        lines.push({ kind: 'ok', text: 'Nothing changed in the database.' });
        outcome = 'rolledback';
        break;
      }
      const set = v.changes.map((c) => c.col + '=' + c.to).join(', ');
      lines.push({ kind: 'ok', text: 'UPDATE id=' + id + ' SET ' + set + ' -> 1 row affected' });
      lines.push({ kind: 'ok', text: 'Re-read id=' + id + ' -> new values verified' });
      done++;
    }
    if (outcome === 'committed') {
      if (sim === 'commit') {
        lines.push({ kind: 'bad', text: 'COMMIT -> connection lost before the server confirmed' });
        lines.push({ kind: 'warn', text: 'Outcome unknown. Run marked Review required; do not retry until the database is inspected.' });
        outcome = 'review';
      } else {
        lines.push({ kind: 'ok', text: 'COMMIT -> ' + ready.length + ' rows committed and verified' });
      }
    }

    this.stopAll(false);
    this.applyStatus.set('running');
    this.log.set([]);
    this.lastCount.set(ready.length);
    this.pushAudit('Apply requested for ' + ready.length + ' validated rows. Only the four permitted mapping columns can change.');

    const finish = () => {
      this.stopCountdown();
      if (outcome === 'committed') {
        this.db.update((rows) =>
          rows.map((d) => {
            const hit = ready.find((v) => v.row.id === d.id);
            if (!hit) return d;
            const next = { ...d };
            for (const c of hit.changes) next[c.col] = c.to;
            return next;
          }),
        );
        this.pushAudit('Committed and verified ' + ready.length + ' rows in one transaction. Status: Completed.');
      } else if (outcome === 'rolledback') {
        this.validated.set(null);
        this.remaining.set(VALID_SECONDS);
        this.pushAudit('Apply failed; changes rolled back. Status: Imported. Revalidation required.');
      } else {
        this.pushAudit('Commit interrupted. Status: Review required. Verify the database before any retry.');
      }
      this.applyStatus.set(outcome);
    };

    if (this.device.reducedMotion) {
      this.log.set(lines);
      finish();
      return;
    }
    lines.forEach((line, i) => {
      this.timers.push(setTimeout(() => this.log.update((l) => [...l, line]), (i + 1) * 520));
    });
    this.timers.push(setTimeout(finish, (lines.length + 1) * 520));
  }

  resetDemo(): void {
    this.stopAll();
    this.grid.set(seedGrid());
    this.db.set(DB_ROWS.map((d) => ({ ...d })));
    this.simulateOver.set(false);
    this.skipFuel.set(false);
    this.validated.set(null);
    this.remaining.set(VALID_SECONDS);
    this.writes.set(false);
    this.confirmText.set('');
    this.simulate.set('none');
    this.applyStatus.set('idle');
    this.log.set([]);
    this.audit.set([]);
    this.step.set(1);
  }

  private pushAudit(text: string): void {
    const time = new Date().toISOString().slice(11, 19) + 'Z';
    this.audit.update((a) => [...a, { time, text }]);
  }

  private stopCountdown(): void {
    if (this.countdown !== null) {
      clearInterval(this.countdown);
      this.countdown = null;
    }
  }

  private stopAll(includeCountdown = true): void {
    this.timers.forEach((t) => clearTimeout(t));
    this.timers = [];
    if (includeCountdown) this.stopCountdown();
  }
}
