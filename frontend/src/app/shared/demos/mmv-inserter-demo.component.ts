import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { DeviceService } from '../../services/device.service';
import { DEMO_STYLES } from './demo-styles';

/* ================================================================== *
 *  1. Reference data (representative subsets of the real tool's maps)
 * ================================================================== */

export const SUB_PASSENGER = 9;
export const SUB_GOODS = 10;
const MAX_NAME_LEN = 60;
const MAX_BATCH = 25;

/** Layer 1 of the make normaliser: any incoming spelling (UPPER, spaces collapsed) -> the DB's own spelling. ~25 of the real entries. */
export const MAKE_ALIASES = new Map<string, string>([
  ['TATA MOTORS', 'TATA'],
  ['TATA MOTORS LTD', 'TATA'],
  ['TATA MOTORS LIMITED', 'TATA'],
  ['TML', 'TATA'],
  ['MAHINDRA', 'MAHINDRA AND MAHINDRA'],
  ['M&M', 'MAHINDRA AND MAHINDRA'],
  ['M & M', 'MAHINDRA AND MAHINDRA'],
  ['M AND M', 'MAHINDRA AND MAHINDRA'],
  ['MAHINDRA & MAHINDRA', 'MAHINDRA AND MAHINDRA'],
  ['L&T', 'LARSEN AND TOUBRO'],
  ['L & T', 'LARSEN AND TOUBRO'],
  ['LARSEN & TOUBRO', 'LARSEN AND TOUBRO'],
  ['MARUTI SUZUKI', 'MARUTI'],
  ['MARUTI SUZUKI INDIA LTD', 'MARUTI'],
  ['MARUTI UDYOG', 'MARUTI'],
  ['ASHOK', 'ASHOK LEYLAND'],
  ['ASHOK LAYLAND', 'ASHOK LEYLAND'],
  ['ASHOK LEYLAND LTD', 'ASHOK LEYLAND'],
  ['EICHER', 'EICHER MOTORS'],
  ['EICHER MOTORS LTD', 'EICHER MOTORS'],
  ['HERO HONDA', 'HERO MOTOCORP'],
  ['HERO MOTO CORP', 'HERO MOTOCORP'],
  ['MERCEDES BENZ', 'MERCEDES-BENZ'],
  ['MERCEDES', 'MERCEDES-BENZ'],
  ['MB', 'MERCEDES-BENZ'],
]);

/** Layer 2: words that are NOT brand differentiators. HITACHI is deliberately absent, so TATA != TATA HITACHI. */
export const GENERIC_TOKENS = new Set([
  'MOTORS', 'MOTOR', 'AUTO', 'AUTOS', 'AUTOMOBILE', 'AUTOMOBILES', 'LTD', 'LIMITED', 'PVT', 'PRIVATE', 'AND', '&', 'CO', 'COMPANY',
  'INDUSTRIES', 'INDUSTRY', 'ENTERPRISE', 'ENTERPRISES', 'CORP', 'CORPORATION', 'INDIA', 'INDIAN', 'GROUP', 'MFG', 'MANUFACTURING', 'INTERNATIONAL',
]);

export const FUEL_ID_MAP = new Map<string, number>([
  ['PETROL', 1], ['P', 1],
  ['DIESEL', 2], ['D', 2], ['HSD', 2],
  ['CNG/PETROL', 3], ['PETROL/CNG', 3],
  ['LPG/PETROL', 4], ['PETROL/LPG', 4],
  ['LPG', 5],
  ['CNG', 6],
  ['ELECTRIC', 7], ['EV', 7], ['E', 7],
  ['PETROL/ELECTRIC', 8], ['HYBRID', 8],
]);

const FUEL_NAMES: Record<number, string> = { 1: 'PETROL', 2: 'DIESEL', 3: 'CNG/PETROL', 4: 'LPG/PETROL', 5: 'LPG', 6: 'CNG', 7: 'ELECTRIC', 8: 'HYBRID' };

export const VEHICLE_TYPE_ID_MAP = new Map<string, number>([
  ['TRUCK', 3],
  ['PICKUP', 6],
  ['3W DELIVERY VAN', 7],
  ['TIPPER', 25],
  ['TAXI/CAB', 8],
  ['TEMPO TRAVELLER', 10],
  ['PASSENGER BUS', 12],
  ['PCV 2W', 15],
]);

/** Used when a row does not say. Note the fuel default is CNG, exactly why a blank fuel must never take part in matching. */
const DEFAULTS = { vehicleTypeId: 3, vehicleTypeName: 'TRUCK', fuelId: 6, fuel: 'CNG', gvwKg: 669 };

/* ================================================================== *
 *  2. Pure helpers (ports of make_normalizer.py and the LIKE guards)
 * ================================================================== */

/** trim + UPPERCASE + collapse runs of whitespace */
export const collapse = (s: string): string => s.trim().toUpperCase().split(/\s+/).filter(Boolean).join(' ');

export interface MakeNorm { clean: string; canonical: string; aliasHit: boolean }
export function normalizeMake(name: string): MakeNorm {
  const clean = collapse(name);
  const alias = MAKE_ALIASES.get(clean);
  return { clean, canonical: alias ?? clean, aliasHit: alias !== undefined };
}

/** Brand-significant tokens (generic words removed), sorted. 'MAHINDRA AND MAHINDRA' -> [MAHINDRA]. */
export function coreTokens(name: string): string[] {
  const set = new Set(name.trim().toUpperCase().split(/\s+/).filter(Boolean));
  return [...set].filter((t) => !GENERIC_TOKENS.has(t)).sort();
}

const sameSet = (a: string[], b: string[]): boolean => a.length === b.length && a.every((t, i) => t === b[i]);
const fmtSet = (t: string[]): string => `{${t.join(', ')}}`;

/** SQL `value LIKE '%text%'` (case-insensitive collation): % and _ in the text act as wildcards, exactly the quirk the real query has. */
export function likeContains(value: string, text: string): boolean {
  const body = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.');
  return new RegExp(`^.*${body}.*$`, 'is').test(value);
}

/** SQL LEN(LTRIM(RTRIM(x))) */
const lenOf = (s: string): number => s.trim().length;

const NUM_RE = /^[+-]?(\d+\.?\d*|\.\d+)$/;
function parseGvw(raw: string): number | null {
  const t = raw.trim();
  return NUM_RE.test(t) ? parseFloat(t) : null;
}

/* ================================================================== *
 *  3. Master tables + engine
 * ================================================================== */

export interface MakeRow { id: number; name: string; isNew: boolean }
export interface ModelRow { id: number; makeId: number; sub: number; name: string; isNew: boolean }
export interface VariantRow {
  id: number; sub: number; makeId: number; modelId: number; vtype: number;
  name: string; fuelId: number; fuel: string; gvw: number; isNew: boolean;
}

export type Action = 'found' | 'inserted' | 'skipped_dry_run' | 'skipped_no_make_id' | 'skipped_no_model_id' | 'error';
export type Tone = 'ok' | 'warn' | 'bad' | 'info' | 'mute';
type Stage = 'make' | 'model' | 'variant' | 'row';

export interface TraceStep { stage: Stage; title: string; verdict: string; detail: string; tone: Tone }
export interface RowInput { make: string; model: string; variant: string; fuel: string; gvw: string; segment: 'goods' | 'passenger'; bodyType: string }
export interface RowResult {
  input: RowInput;
  sub: number;
  make: string;
  model: string;
  variant: string;
  steps: TraceStep[];
  makeId: number | null;
  modelId: number | null;
  variantId: number | null;
  makeAction: Action | '';
  modelAction: Action | '';
  variantAction: Action | '';
  error: string;
}
export interface Summary {
  total: number;
  makesFound: number; makesInserted: number;
  modelsFound: number; modelsInserted: number;
  variantsFound: number; variantsInserted: number;
  skipped: number; errors: number;
}

interface RowCtx { steps: TraceStep[]; dry: boolean; undo: Array<() => void> }
type Level = 'make' | 'model' | 'variant';

const emptySummary = (): Summary => ({
  total: 0, makesFound: 0, makesInserted: 0, modelsFound: 0, modelsInserted: 0, variantsFound: 0, variantsInserted: 0, skipped: 0, errors: 0,
});

const quote = (s: string): string => `"${s}"`;
const fuelLabel = (id: number): string => FUEL_NAMES[id] ?? String(id);

export class InserterEngine {
  private makes: MakeRow[] = [];
  private models: ModelRow[] = [];
  private variants: VariantRow[] = [];
  private nextMake = 111;
  private nextModel = 214;
  private nextVariant = 322;
  private makeCache = new Map<string, [number | null, Action]>();
  private modelCache = new Map<string, [number | null, Action]>();
  private variantCache = new Map<string, [number | null, Action]>();
  summary: Summary = emptySummary();

  constructor() {
    this.reset();
  }

  /** Back to the preloaded master. Includes a deliberately ambiguous pair (FORCE MOTORS / FORCE AUTOMOBILES) and TATA vs TATA HITACHI. */
  reset(): void {
    const mk = (id: number, name: string): MakeRow => ({ id, name, isNew: false });
    this.makes = [
      mk(101, 'TATA'), mk(102, 'MAHINDRA AND MAHINDRA'), mk(103, 'ASHOK LEYLAND'), mk(104, 'EICHER MOTORS'), mk(105, 'MARUTI'),
      mk(106, 'MERCEDES-BENZ'), mk(107, 'HERO MOTOCORP'), mk(108, 'TATA HITACHI'), mk(109, 'FORCE MOTORS'), mk(110, 'FORCE AUTOMOBILES'),
    ];
    const md = (id: number, makeId: number, sub: number, name: string): ModelRow => ({ id, makeId, sub, name, isNew: false });
    this.models = [
      md(201, 101, SUB_GOODS, 'ACE'), md(202, 101, SUB_GOODS, 'LPT 1412'), md(203, 101, SUB_PASSENGER, 'WINGER'),
      md(204, 102, SUB_GOODS, 'BOLERO PIK-UP'), md(205, 102, SUB_GOODS, 'JEETO'),
      md(206, 103, SUB_GOODS, 'DOST'), md(207, 103, SUB_GOODS, '2518'),
      md(208, 104, SUB_GOODS, 'PRO 2049'), md(209, 105, SUB_GOODS, 'SUPER CARRY'),
      md(210, 106, SUB_PASSENGER, 'SPRINTER'), md(211, 107, SUB_PASSENGER, 'SPLENDOR'),
      md(212, 108, SUB_GOODS, 'ZAXIS 110'), md(213, 109, SUB_PASSENGER, 'TRAVELLER'),
    ];
    const seeds: Array<[number, number, number, string, string, number]> = [
      [301, 201, 3, 'ACE EX BSIII', 'DIESEL', 1450],
      [302, 201, 3, 'ACE EX BSIII', 'CNG', 1450],
      [303, 201, 3, 'ACE GOLD CX BSVI', 'PETROL', 1500],
      [304, 202, 3, 'LPT 1412 BSIV', 'DIESEL', 14250],
      [305, 202, 3, 'LPT 1412 BSVI', 'DIESEL', 14250],
      [306, 203, 10, 'WINGER DELUXE', 'DIESEL', 2800],
      [307, 203, 10, 'WINGER STANDARD', 'DIESEL', 2800],
      [308, 204, 6, 'BOLERO PIK-UP FB 1.7T', 'DIESEL', 2965],
      [309, 204, 6, 'BOLERO PIK-UP CNG', 'CNG', 2575],
      [310, 205, 7, 'JEETO PLUS', 'CNG', 1580],
      [311, 205, 7, 'JEETO MINIVAN', 'DIESEL', 1550],
      [312, 206, 6, 'DOST LS', 'DIESEL', 2780],
      [313, 206, 6, 'DOST PLUS', 'DIESEL', 2780],
      [314, 207, 3, '2518 T', 'DIESEL', 25000],
      [315, 208, 3, 'PRO 2049 XP', 'DIESEL', 4995],
      [316, 208, 3, 'PRO 2049', 'CNG', 4995],
      [317, 209, 6, 'SUPER CARRY', 'CNG', 1565],
      [318, 210, 12, 'SPRINTER 516', 'DIESEL', 5000],
      [319, 211, 15, 'SPLENDOR PLUS', 'PETROL', 270],
      [320, 212, 3, 'ZAXIS 110 STANDARD', 'DIESEL', 11000],
      [321, 213, 10, 'TRAVELLER 3350', 'DIESEL', 3350],
    ];
    this.variants = seeds.map(([id, modelId, vtype, name, fuel, gvw]) => {
      const model = this.models.find((m) => m.id === modelId) as ModelRow;
      return {
        id, sub: model.sub, makeId: model.makeId, modelId, vtype, name, fuelId: FUEL_ID_MAP.get(fuel) ?? DEFAULTS.fuelId, fuel, gvw, isNew: false,
      };
    });
    this.nextMake = 111;
    this.nextModel = 214;
    this.nextVariant = 322;
    this.startRun();
  }

  /** A "run" = one Add row click or one batch: fresh caches and counters, highlights cleared. */
  startRun(): void {
    this.makeCache.clear();
    this.modelCache.clear();
    this.variantCache.clear();
    this.summary = emptySummary();
    for (const m of this.makes) m.isNew = false;
    for (const m of this.models) m.isNew = false;
    for (const v of this.variants) v.isNew = false;
  }

  tables(): { makes: MakeRow[]; models: ModelRow[]; variants: VariantRow[] } {
    return {
      makes: this.makes.map((r) => ({ ...r })),
      models: this.models.map((r) => ({ ...r })),
      variants: this.variants.map((r) => ({ ...r })),
    };
  }

  /** Process one row exactly like pipeline.py: make -> model -> variant, one transaction, rolled back on error. */
  processRow(inp: RowInput, dryRun: boolean): RowResult {
    const sub = inp.segment === 'passenger' ? SUB_PASSENGER : SUB_GOODS;
    const make = inp.make.trim().toUpperCase();
    const model = inp.model.trim().toUpperCase();
    const variant = inp.variant.trim().toUpperCase();
    const ctx: RowCtx = { steps: [], dry: dryRun, undo: [] };
    const res: RowResult = {
      input: inp, sub, make, model, variant, steps: ctx.steps,
      makeId: null, modelId: null, variantId: null, makeAction: '', modelAction: '', variantAction: '', error: '',
    };
    this.summary.total++;
    const cp = {
      makes: this.makes.map((r) => ({ ...r })),
      models: this.models.map((r) => ({ ...r })),
      variants: this.variants.map((r) => ({ ...r })),
      summary: { ...this.summary },
    };
    let level: Level = 'make';
    try {
      // ---- MAKE
      const mc = this.makeCache.get(make);
      if (mc) {
        res.makeId = mc[0];
        res.makeAction = mc[0] !== null ? 'found' : mc[1];
        this.step(ctx, 'make', 'Run cache', mc[0] !== null ? 'hit' : 'cached skip',
          mc[0] !== null ? `${quote(make)} was already resolved earlier in this run: make_id ${mc[0]}. No database query.` : `${quote(make)} was already skipped earlier in this run.`,
          mc[0] !== null ? 'info' : 'warn');
      } else {
        const [id, act] = this.getOrCreateMake(ctx, inp.make, make);
        res.makeId = id;
        res.makeAction = act;
        this.makeCache.set(make, [id, act]);
        ctx.undo.push(() => this.makeCache.delete(make));
      }
      this.tally('make', res.makeAction);

      // ---- MODEL
      level = 'model';
      if (res.makeId === null) {
        res.modelAction = 'skipped_no_make_id';
        this.step(ctx, 'model', 'Needs a make_id', 'skipped', 'The make has no id (dry run or earlier skip), so the model cannot be scoped. Action: skipped_no_make_id.', 'bad');
      } else {
        const key = `${res.makeId}|${sub}|${model}`;
        const cached = this.modelCache.get(key);
        if (cached) {
          res.modelId = cached[0];
          res.modelAction = cached[0] !== null ? 'found' : cached[1];
          this.step(ctx, 'model', 'Run cache', cached[0] !== null ? 'hit' : 'cached skip',
            cached[0] !== null ? `(make_id ${res.makeId}, subproduct ${sub}, ${quote(model)}) was resolved earlier in this run: model_id ${cached[0]}.` : 'Cached skip from earlier in this run.',
            cached[0] !== null ? 'info' : 'warn');
        } else {
          const [id, act] = this.getOrCreateModel(ctx, res.makeId, sub, inp.model, model);
          res.modelId = id;
          res.modelAction = act;
          this.modelCache.set(key, [id, act]);
          ctx.undo.push(() => this.modelCache.delete(key));
        }
      }
      this.tally('model', res.modelAction);

      // ---- VARIANT
      level = 'variant';
      if (res.makeId === null) {
        res.variantAction = 'skipped_no_make_id';
        this.step(ctx, 'variant', 'Needs a make_id', 'skipped', 'No make_id, so nothing to scope the variant to. Action: skipped_no_make_id.', 'bad');
      } else if (res.modelId === null) {
        res.variantAction = 'skipped_no_model_id';
        this.step(ctx, 'variant', 'Needs a model_id', 'skipped', 'No model_id (dry run or earlier skip). Action: skipped_no_model_id.', 'bad');
      } else {
        const [id, act] = this.resolveVariant(ctx, inp, res.makeId, res.modelId, sub, variant);
        res.variantId = id;
        res.variantAction = act;
      }
      this.tally('variant', res.variantAction);

      this.step(ctx, 'row', 'Row committed', dryRun ? 'dry run' : 'commit',
        dryRun ? 'Dry run: nothing was written, only the decisions were computed.' : 'Committed individually, so a later row failing cannot undo this one.',
        dryRun ? 'warn' : 'ok');
    } catch (e) {
      // roll the whole row back; ids already handed out are not reused (like an identity column)
      this.makes = cp.makes;
      this.models = cp.models;
      this.variants = cp.variants;
      for (const fn of [...ctx.undo].reverse()) fn();
      this.summary = { ...cp.summary, errors: cp.summary.errors + 1 };
      res.error = e instanceof Error ? e.message : String(e);
      if (level === 'make') res.makeAction = 'error';
      else if (level === 'model') res.modelAction = 'error';
      else res.variantAction = 'error';
      this.step(ctx, 'row', 'Row rolled back', 'error', `${res.error}. Anything this row inserted is undone and the run continues with the next row.`, 'bad');
    }
    return res;
  }

  /* ---------------- MAKE ---------------- */
  private getOrCreateMake(ctx: RowCtx, raw: string, upper: string): [number | null, Action] {
    const found = this.findMake(ctx, raw, upper);
    if (found !== null) return [found, 'found'];
    const canonical = normalizeMake(upper).canonical;
    if (ctx.dry) {
      this.step(ctx, 'make', 'Insert', 'dry run', `Would insert make ${quote(canonical)}, but dry run is on. Action: skipped_dry_run.`, 'warn');
      return [null, 'skipped_dry_run'];
    }
    this.validateName('vehicle_make', canonical);
    const id = this.nextMake++;
    this.makes.push({ id, name: canonical, isNew: true });
    this.step(ctx, 'make', 'Insert', 'inserted',
      `New make_id ${id}. The normalised name ${quote(canonical)} is stored, not the raw text${canonical !== raw.trim() ? ` ${quote(raw.trim())}` : ''}.`, 'ok');
    return [id, 'inserted'];
  }

  private findMake(ctx: RowCtx, raw: string, upper: string): number | null {
    const n = normalizeMake(upper);
    const c = n.canonical;
    this.step(ctx, 'make', 'Normalise', n.clean !== raw ? 'cleaned' : 'unchanged',
      `${quote(raw)} becomes ${quote(n.clean)} (trim, UPPERCASE, collapse spaces).`, 'info');
    if (n.aliasHit) {
      this.step(ctx, 'make', 'Alias map', 'hit', `${quote(n.clean)} is a known spelling, so it is rewritten to ${quote(c)}.`, 'info');
    } else {
      this.step(ctx, 'make', 'Alias map', 'miss', `No alias entry for ${quote(n.clean)}; it keeps its own name. (A name is never merged just because it starts with another make, so TATA HITACHI is not TATA.)`);
    }

    // tier 1: exact UPPER(TRIM)
    const exact = this.makes.find((m) => m.name.trim().toUpperCase() === c);
    if (exact) {
      this.step(ctx, 'make', 'Exact match', 'hit', `UPPER(TRIM(vehicle_make)) = ${quote(c)} matches make_id ${exact.id}.`, 'ok');
      return exact.id;
    }
    this.step(ctx, 'make', 'Exact match', 'miss', `No make named exactly ${quote(c)}.`);

    // tier 2: LIKE %c% with same-length guard
    const likeAll = this.makes.filter((m) => likeContains(m.name, c));
    const cands = likeAll.filter((m) => lenOf(m.name) === c.length);
    const dropped = likeAll.filter((m) => !cands.includes(m));
    const droppedTxt = dropped.length ? ` The same-length guard dropped: ${dropped.map((m) => m.name).join(', ')}.` : '';
    if (cands.length) {
      const pick = cands.length === 1 ? cands[0] : (cands.find((m) => m.name.trim().toUpperCase() === c) ?? cands[0]);
      this.step(ctx, 'make', 'LIKE, same length', 'hit', `LIKE '%${c}%' kept ${cands.length} row(s) of equal length: make_id ${pick.id}.${droppedTxt}`, 'ok');
      return pick.id;
    }
    this.step(ctx, 'make', 'LIKE, same length', 'miss', `LIKE '%${c}%' found ${likeAll.length} row(s) containing the text.${droppedTxt || ' Nothing of equal length.'}`);

    // tier 3: core-token set match, only when exactly one DB make has the identical core
    const core = coreTokens(c);
    const stripped = [...new Set(c.split(' ').filter((t) => GENERIC_TOKENS.has(t)))];
    if (!core.length) {
      this.step(ctx, 'make', 'Core tokens', 'skipped', 'Only generic words are left once MOTORS / LTD / AND etc. are stripped, so this tier is skipped.');
      return null;
    }
    const strippedTxt = stripped.length ? ` after stripping ${stripped.join(', ')}` : '';
    const matches = this.makes.filter((m) => sameSet(coreTokens(m.name), core));
    if (matches.length === 1) {
      this.step(ctx, 'make', 'Core tokens', 'unique match',
        `Core ${fmtSet(core)}${strippedTxt}. Exactly one DB make has that identical set: ${matches[0].name} (id ${matches[0].id}).`, 'ok');
      return matches[0].id;
    }
    if (matches.length > 1) {
      this.step(ctx, 'make', 'Core tokens', 'ambiguous',
        `Core ${fmtSet(core)}${strippedTxt}. ${matches.length} DB makes share it: ${matches.map((m) => `${m.name} (id ${m.id})`).join(', ')}. Ambiguous, treating as new make rather than guessing.`, 'warn');
      return null;
    }
    const near = this.makes
      .filter((m) => {
        const t = coreTokens(m.name);
        return t.length > 0 && t.length !== core.length && (t.every((x) => core.includes(x)) || core.every((x) => t.includes(x)));
      })
      .slice(0, 2);
    const nearTxt = near.length ? ` Close but not equal, so not merged: ${near.map((m) => `${m.name} ${fmtSet(coreTokens(m.name))}`).join('; ')}.` : '';
    this.step(ctx, 'make', 'Core tokens', 'no match', `Core ${fmtSet(core)}${strippedTxt}: no DB make has this exact set.${nearTxt}`);
    return null;
  }

  /* ---------------- MODEL ---------------- */
  private getOrCreateModel(ctx: RowCtx, makeId: number, sub: number, raw: string, upper: string): [number | null, Action] {
    const found = this.findModel(ctx, makeId, sub, raw, upper);
    if (found !== null) return [found, 'found'];
    if (ctx.dry) {
      this.step(ctx, 'model', 'Insert', 'dry run', `Would insert model ${quote(upper)} under make_id ${makeId}, but dry run is on. Action: skipped_dry_run.`, 'warn');
      return [null, 'skipped_dry_run'];
    }
    this.validateName('vehicle_model', upper);
    const id = this.nextModel++;
    this.models.push({ id, makeId, sub, name: upper, isNew: true });
    this.step(ctx, 'model', 'Insert', 'inserted', `New model_id ${id} under make_id ${makeId}, subproduct ${sub}.`, 'ok');
    return [id, 'inserted'];
  }

  private findModel(ctx: RowCtx, makeId: number, sub: number, raw: string, upper: string): number | null {
    const scope = this.models.filter((m) => m.makeId === makeId && m.sub === sub);
    this.step(ctx, 'model', 'Normalise', 'trim + upper',
      `${quote(raw)} becomes ${quote(upper)}. Models get only trim and UPPERCASE: no alias map and no collapsing of inner spaces. Scope: subproduct ${sub}, make_id ${makeId} (${scope.length} existing model${scope.length === 1 ? '' : 's'}).`, 'info');
    const exact = scope.find((m) => m.name.trim().toUpperCase() === upper);
    if (exact) {
      this.step(ctx, 'model', 'Exact match', 'hit', `Found model_id ${exact.id} (${exact.name}) inside this make.`, 'ok');
      return exact.id;
    }
    this.step(ctx, 'model', 'Exact match', 'miss', `No model named ${quote(upper)} inside this make and subproduct. The same name under another make does not count.`);
    const likeAll = scope.filter((m) => likeContains(m.name, upper));
    const cands = likeAll.filter((m) => lenOf(m.name) === upper.length);
    if (cands.length) {
      const pick = cands.length === 1 ? cands[0] : (cands.find((m) => m.name.trim().toUpperCase() === upper) ?? cands[0]);
      this.step(ctx, 'model', 'LIKE, same length', 'hit', `LIKE '%${upper}%' with equal length kept model_id ${pick.id}.`, 'ok');
      return pick.id;
    }
    this.step(ctx, 'model', 'LIKE, same length', 'miss', `${likeAll.length} row(s) contain the text but none has the same length.`);
    return null;
  }

  /* ---------------- VARIANT ---------------- */
  private resolveVariant(ctx: RowCtx, inp: RowInput, makeId: number, modelId: number, sub: number, upper: string): [number | null, Action] {
    const vtName = inp.bodyType.trim().toUpperCase();
    const mapped = VEHICLE_TYPE_ID_MAP.get(vtName);
    const vtype = mapped ?? DEFAULTS.vehicleTypeId;
    const fuelKey = inp.fuel.trim().toUpperCase();
    const fuelMatch = FUEL_ID_MAP.get(fuelKey) ?? null;
    const gvwMatch = parseGvw(inp.gvw);
    const attrs = [
      `vehicle_type_id=${vtype}${mapped !== undefined ? ` (${vtName})` : ` (default ${DEFAULTS.vehicleTypeName})`}`,
      fuelMatch !== null ? `fuel_id=${fuelMatch} (${fuelLabel(fuelMatch)})` : `fuel_id=none (${fuelKey ? 'unrecognised' : 'blank'} fuel is NOT compared)`,
      gvwMatch !== null ? `gvw_kg=${gvwMatch}` : `gvw_kg=none (${inp.gvw.trim() ? 'not a number' : 'blank'}, NOT compared)`,
    ];
    this.step(ctx, 'variant', 'Match attributes', 'resolved', `${attrs.join('; ')}. Scope: subproduct ${sub}, make_id ${makeId}, model_id ${modelId}. Name alone is not enough.`, 'info');

    const key = `${makeId}|${modelId}|${sub}|${upper}|${vtype}|${fuelMatch}|${gvwMatch}`;
    const cached = this.variantCache.get(key);
    if (cached) {
      this.step(ctx, 'variant', 'Run cache', cached[0] !== null ? 'hit' : 'cached skip',
        cached[0] !== null ? `Identical (name, type, fuel, GVW) was resolved earlier in this run: variant_id ${cached[0]}. No database query.` : 'Cached skip from earlier in this run.',
        cached[0] !== null ? 'info' : 'warn');
      return [cached[0], cached[0] !== null ? 'found' : cached[1]];
    }
    const [id, act] = this.getOrCreateVariant(ctx, inp, makeId, modelId, sub, upper, vtype, fuelMatch, gvwMatch);
    this.variantCache.set(key, [id, act]);
    ctx.undo.push(() => this.variantCache.delete(key));
    return [id, act];
  }

  private getOrCreateVariant(
    ctx: RowCtx, inp: RowInput, makeId: number, modelId: number, sub: number, upper: string,
    vtype: number, fuelMatch: number | null, gvwMatch: number | null,
  ): [number | null, Action] {
    const scope = this.variants.filter((v) => v.sub === sub && v.makeId === makeId && v.modelId === modelId);
    const attrOk = (v: VariantRow): boolean => v.vtype === vtype && (fuelMatch === null || v.fuelId === fuelMatch) && (gvwMatch === null || v.gvw === gvwMatch);

    const exact = scope.find((v) => v.name.trim().toUpperCase() === upper && attrOk(v));
    if (exact) {
      this.step(ctx, 'variant', 'Exact match', 'hit', `Name, vehicle type${fuelMatch !== null ? ', fuel' : ''}${gvwMatch !== null ? ' and GVW' : ''} all agree: variant_id ${exact.id}.`, 'ok');
      return [exact.id, 'found'];
    }
    this.step(ctx, 'variant', 'Exact match', 'miss', `No variant with name ${quote(upper)} that also agrees on the attributes above (${scope.length} variant${scope.length === 1 ? '' : 's'} in this model).`);

    const sameName = scope.filter((v) => v.name.trim().toUpperCase() === upper);
    if (sameName.length) {
      const lines = sameName.map((v) => {
        const diff: string[] = [];
        if (v.vtype !== vtype) diff.push('vehicle type');
        if (fuelMatch !== null && v.fuelId !== fuelMatch) diff.push('fuel');
        if (gvwMatch !== null && v.gvw !== gvwMatch) diff.push('GVW');
        return `id ${v.id} (${v.fuel}, ${v.gvw} kg) differs in ${diff.join(' + ') || 'attributes'}`;
      });
      this.step(ctx, 'variant', 'Same name, different vehicle', 'distinct',
        `${lines.join('; ')}. Matching on name alone would hide a genuinely different vehicle, so this is treated as a new variant.`, 'info');
    }

    const likeAll = scope.filter((v) => likeContains(v.name, upper) && lenOf(v.name) === upper.length && attrOk(v));
    if (likeAll.length) {
      const pick = likeAll.length === 1 ? likeAll[0] : (likeAll.find((v) => v.name.trim().toUpperCase() === upper) ?? likeAll[0]);
      this.step(ctx, 'variant', 'LIKE, same length', 'hit', `LIKE '%${upper}%' with equal length and the same attributes: variant_id ${pick.id}.`, 'ok');
      return [pick.id, 'found'];
    }
    this.step(ctx, 'variant', 'LIKE, same length', 'miss', 'No equal-length LIKE candidate with matching attributes.');

    if (ctx.dry) {
      this.step(ctx, 'variant', 'Insert', 'dry run', `Would insert variant ${quote(upper)}, but dry run is on. Action: skipped_dry_run.`, 'warn');
      return [null, 'skipped_dry_run'];
    }
    this.validateName('vehicle_variant', upper);
    const recognisedFuel = FUEL_ID_MAP.get(inp.fuel.trim().toUpperCase());
    const fuelId = recognisedFuel ?? DEFAULTS.fuelId;
    const fuelText = inp.fuel.trim() || DEFAULTS.fuel;
    const gvw = gvwMatch ?? DEFAULTS.gvwKg;
    const defaults: string[] = [];
    if (recognisedFuel === undefined) defaults.push(`fuel_id ${DEFAULTS.fuelId} (${DEFAULTS.fuel})`);
    if (!inp.fuel.trim()) defaults.push(`fuel text ${DEFAULTS.fuel}`);
    if (gvwMatch === null) defaults.push(`gvw_kg ${DEFAULTS.gvwKg}`);
    if (!VEHICLE_TYPE_ID_MAP.has(inp.bodyType.trim().toUpperCase())) defaults.push(`vehicle_type_id ${DEFAULTS.vehicleTypeId} (${DEFAULTS.vehicleTypeName})`);
    const id = this.nextVariant++;
    this.variants.push({ id, sub, makeId, modelId, vtype, name: upper, fuelId, fuel: fuelText, gvw, isNew: true });
    this.step(ctx, 'variant', 'Insert', 'inserted',
      `New variant_id ${id}.${defaults.length ? ` Defaults filled in: ${defaults.join(', ')}.` : ' Every stored column came from the row.'}`, 'ok');
    return [id, 'inserted'];
  }

  /* ---------------- shared ---------------- */
  private validateName(column: string, name: string): void {
    if (!name.trim()) throw new Error(`NOT NULL violation: ${column} is empty`);
    if (name.length > MAX_NAME_LEN) throw new Error(`String or binary data would be truncated in ${column} (max ${MAX_NAME_LEN} characters, got ${name.length})`);
  }

  private step(ctx: RowCtx, stage: Stage, title: string, verdict: string, detail: string, tone: Tone = 'mute'): void {
    ctx.steps.push({ stage, title, verdict, detail, tone });
  }

  private tally(kind: Level, action: Action | ''): void {
    const s = this.summary;
    if (action === 'found') {
      if (kind === 'make') s.makesFound++;
      else if (kind === 'model') s.modelsFound++;
      else s.variantsFound++;
    } else if (action === 'inserted') {
      if (kind === 'make') s.makesInserted++;
      else if (kind === 'model') s.modelsInserted++;
      else s.variantsInserted++;
    } else {
      s.skipped++;
    }
  }
}

/* ================================================================== *
 *  4. Component
 * ================================================================== */

interface Card extends RowResult { n: number }
interface Outcome { label: string; tone: Tone }
interface Example { id: string; label: string; hint: string; rows: RowInput[] }

const ACTION_TONE: Record<Action, Tone> = {
  found: 'info',
  inserted: 'ok',
  skipped_dry_run: 'warn',
  skipped_no_make_id: 'bad',
  skipped_no_model_id: 'bad',
  error: 'bad',
};

const row = (make: string, model: string, variant: string, fuel: string, gvw: string, bodyType = '', segment: 'goods' | 'passenger' = 'goods'): RowInput => ({
  make, model, variant, fuel, gvw, segment, bodyType,
});

const DEFAULT_BATCH = [
  'make,model,variant,fuel,gvw',
  'M&M,Bolero Pik-Up,Bolero Pik-Up Extra Strong,Diesel,3000',
  'tata  motors  ltd,ACE,ACE EX BSIII,diesel,1450',
  'Eicher Motors Pvt Ltd,PRO 3015,PRO 3015 CNG,CNG,',
  'Force,Gurkha,Gurkha Xpedition,Diesel,2400',
  'Force,Gurkha,Gurkha Xpedition,Diesel,2400',
  'Tata Motors,SIGNA 4825,,Diesel,',
].join('\n');

@Component({
  selector: 'app-mmv-inserter-demo',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="demo" aria-label="Vehicle master inserter demo">
      <div class="demo__bar">
        <strong class="demo__title">MMV inserter &mdash; add any row, watch the decision</strong>
        <span class="demo__tag">Interactive &middot; runs in your browser</span>
      </div>

      <div class="demo__body">
        <p class="hint">
          Type any make, model and variant (messy spellings welcome). The same decision chain as the real tool runs against the
          in-memory master below: normalise, alias, exact, LIKE, core-token, then insert or reuse.
        </p>

        <div class="grid-2">
          <form class="panel" (submit)="onAdd($event)" novalidate>
            <strong class="panel__title">Add one row</strong>
            <div class="fgrid">
              <label class="field">
                <span>Make</span>
                <input type="text" autocomplete="off" spellcheck="false" placeholder="e.g. M&amp;M or tata motors ltd" [value]="make()" (input)="make.set(val($event))" />
              </label>
              <label class="field">
                <span>Model</span>
                <input type="text" autocomplete="off" spellcheck="false" placeholder="e.g. ACE" [value]="model()" (input)="model.set(val($event))" />
              </label>
              <label class="field">
                <span>Variant</span>
                <input type="text" autocomplete="off" spellcheck="false" placeholder="e.g. ACE EX BSIII" [value]="variant()" (input)="variant.set(val($event))" />
              </label>
              <label class="field">
                <span>Fuel</span>
                <select [value]="fuel()" (change)="fuel.set(val($event))">
                  <option value="">(blank)</option>
                  <option value="DIESEL">DIESEL</option>
                  <option value="PETROL">PETROL</option>
                  <option value="CNG">CNG</option>
                  <option value="LPG">LPG</option>
                  <option value="ELECTRIC">ELECTRIC</option>
                  <option value="HYBRID">HYBRID</option>
                </select>
              </label>
              <label class="field">
                <span>GVW (kg)</span>
                <input type="text" inputmode="decimal" autocomplete="off" placeholder="blank = unknown" [value]="gvw()" (input)="gvw.set(val($event))" />
              </label>
              <label class="field">
                <span>Segment</span>
                <select [value]="segment()" (change)="setSegment($event)">
                  <option value="goods">Goods (subproduct 10)</option>
                  <option value="passenger">Passenger (subproduct 9)</option>
                </select>
              </label>
              <label class="field">
                <span>Body type</span>
                <select [value]="body()" (change)="body.set(val($event))">
                  <option value="">Default (Truck, id 3)</option>
                  <option value="TRUCK">Truck (3)</option>
                  <option value="PICKUP">Pickup (6)</option>
                  <option value="3W DELIVERY VAN">3W delivery van (7)</option>
                  <option value="TIPPER">Tipper (25)</option>
                  <option value="TAXI/CAB">Taxi/Cab (8)</option>
                  <option value="TEMPO TRAVELLER">Tempo traveller (10)</option>
                  <option value="PASSENGER BUS">Passenger bus (12)</option>
                  <option value="PCV 2W">PCV 2W (15)</option>
                </select>
              </label>
            </div>
            <div class="row">
              <label class="chk">
                <input type="checkbox" [checked]="dry()" (change)="dry.set(checked($event))" />
                <span>Dry run (skip inserts)</span>
              </label>
            </div>
            <div class="row">
              <button type="submit" class="dbtn dbtn--primary" [disabled]="busy()">Add row</button>
              <button type="button" class="dbtn" (click)="resetMaster()">Reset master</button>
              @if (busy()) {
                <button type="button" class="dbtn" (click)="skipAnimation()">Skip animation</button>
              }
            </div>
          </form>

          <div class="panel">
            <strong class="panel__title">Paste several rows</strong>
            <label class="field">
              <span>CSV: make,model,variant,fuel,gvw (one row per line)</span>
              <textarea rows="7" spellcheck="false" [value]="batchText()" (input)="batchText.set(val($event))"></textarea>
            </label>
            <div class="row">
              <button type="button" class="dbtn dbtn--primary" [disabled]="busy()" (click)="runBatch()">Run batch</button>
              <span class="hint hint--small">Uses the Segment, Body type and Dry run settings. Max {{ maxBatch }} rows. The last sample row has no variant, to show a rollback.</span>
            </div>
          </div>
        </div>

        <div class="panel">
          <strong class="panel__title">One-click examples</strong>
          <div class="chips">
            @for (ex of examples; track ex.id) {
              <button type="button" class="dbtn dbtn--sm chipbtn" [disabled]="busy()" (click)="runExample(ex)" [attr.title]="ex.hint">
                {{ ex.label }}
              </button>
            }
          </div>
          <p class="hint hint--small">Each button fills the form and runs it (respecting Dry run). Hover or focus a button for what it shows.</p>
        </div>

        <div class="sr-only" role="status" aria-live="polite">{{ live() }}</div>

        @if (summary(); as s) {
          <div class="kvs" aria-label="Run summary">
            <div class="kv"><strong>{{ s.total }}</strong><span>rows processed</span></div>
            <div class="kv kv--info"><strong>{{ s.makesFound + s.modelsFound + s.variantsFound }}</strong><span>found (make {{ s.makesFound }} &middot; model {{ s.modelsFound }} &middot; variant {{ s.variantsFound }})</span></div>
            <div class="kv kv--ok"><strong>{{ s.makesInserted + s.modelsInserted + s.variantsInserted }}</strong><span>inserted (make {{ s.makesInserted }} &middot; model {{ s.modelsInserted }} &middot; variant {{ s.variantsInserted }})</span></div>
            <div class="kv kv--warn"><strong>{{ s.skipped }}</strong><span>skipped</span></div>
            <div class="kv kv--bad"><strong>{{ s.errors }}</strong><span>errors (rolled back)</span></div>
          </div>
        }

        <div class="panel">
          <div class="panel__head">
            <strong class="panel__title">Decision trace</strong>
            @if (busy()) {
              <span class="pill info">tracing&hellip;</span>
            }
          </div>
          @for (c of results(); track c.n) {
            <article class="card enter">
              <header class="card__head">
                <span class="card__n">Row {{ c.n }}</span>
                <code class="card__row">{{ c.make || '(blank)' }} / {{ c.model || '(blank)' }} / {{ c.variant || '(blank)' }}</code>
                <span class="pill mute">{{ segmentLabel(c.sub) }}</span>
              </header>
              <ol class="steps">
                @for (s of c.steps; track i; let i = $index) {
                  @if (isShown(c, i)) {
                    <li class="step enter" [attr.data-tone]="s.tone">
                      <span class="step__stage">{{ s.stage }}</span>
                      <span class="step__body">
                        <span class="step__top"><b>{{ s.title }}</b>
                          <span class="pill" [class.ok]="s.tone === 'ok'" [class.warn]="s.tone === 'warn'" [class.bad]="s.tone === 'bad'" [class.info]="s.tone === 'info'" [class.mute]="s.tone === 'mute'">{{ s.verdict }}</span>
                        </span>
                        <span class="step__detail">{{ s.detail }}</span>
                      </span>
                    </li>
                  }
                }
              </ol>
              @if (isDone(c)) {
                <div class="outcome enter">
                  @for (o of outcomes(c); track o.label) {
                    <span class="pill" [class.ok]="o.tone === 'ok'" [class.warn]="o.tone === 'warn'" [class.bad]="o.tone === 'bad'" [class.info]="o.tone === 'info'">{{ o.label }}</span>
                  }
                </div>
              }
            </article>
          } @empty {
            <p class="hint">No rows yet. Try an example above.</p>
          }
        </div>

        <div class="panel">
          <strong class="panel__title">The master (in memory)</strong>
          <details class="dt" open>
            <summary>
              <span>Makes</span>
              <span class="pill mute">{{ tables().makes.length }} rows</span>
              @if (newCount(tables().makes) > 0) {
                <span class="pill ok">+{{ newCount(tables().makes) }} new</span>
              }
            </summary>
            <div class="tbl tbl--cap">
              <table>
                <thead><tr><th>make_id</th><th>vehicle_make</th><th></th></tr></thead>
                <tbody>
                  @for (m of tables().makes; track m.id) {
                    <tr [class.fresh]="m.isNew">
                      <td>{{ m.id }}</td><td>{{ m.name }}</td>
                      <td>@if (m.isNew) { <span class="pill ok">new</span> }</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </details>
          <details class="dt">
            <summary>
              <span>Models</span>
              <span class="pill mute">{{ tables().models.length }} rows</span>
              @if (newCount(tables().models) > 0) {
                <span class="pill ok">+{{ newCount(tables().models) }} new</span>
              }
            </summary>
            <div class="tbl tbl--cap">
              <table>
                <thead><tr><th>model_id</th><th>make</th><th>subproduct</th><th>vehicle_model</th><th></th></tr></thead>
                <tbody>
                  @for (m of tables().models; track m.id) {
                    <tr [class.fresh]="m.isNew">
                      <td>{{ m.id }}</td><td>{{ makeName(m.makeId) }} ({{ m.makeId }})</td><td>{{ m.sub }}</td><td>{{ m.name }}</td>
                      <td>@if (m.isNew) { <span class="pill ok">new</span> }</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </details>
          <details class="dt">
            <summary>
              <span>Variants</span>
              <span class="pill mute">{{ tables().variants.length }} rows</span>
              @if (newCount(tables().variants) > 0) {
                <span class="pill ok">+{{ newCount(tables().variants) }} new</span>
              }
            </summary>
            <div class="tbl tbl--cap">
              <table>
                <thead><tr><th>variant_id</th><th>model_id</th><th>type</th><th>vehicle_variant</th><th>fuel</th><th>gvw_kg</th><th></th></tr></thead>
                <tbody>
                  @for (v of tables().variants; track v.id) {
                    <tr [class.fresh]="v.isNew">
                      <td>{{ v.id }}</td><td>{{ v.modelId }}</td><td>{{ v.vtype }}</td><td>{{ v.name }}</td><td>{{ v.fuel }} ({{ v.fuelId }})</td><td>{{ v.gvw }}</td>
                      <td>@if (v.isNew) { <span class="pill ok">new</span> }</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </details>
        </div>
      </div>

      <p class="demo__note">
        Synthetic data: ten makes, thirteen models and twenty-one variants preloaded in memory, no database involved. The decision chain mirrors the
        real tool: alias map, exact match, same-length LIKE, unique core-token match (ambiguity means a new make), model scoping by make, variant matching on
        name plus type, fuel and GVW, per-run caches, dry run, and per-row rollback. Simplified: the alias map shows about 25 of the real entries, vehicle
        types and fuels are small subsets, and fuel text is stored as typed. A rolled-back row also drops its cache entries, and Goods and Passenger share one
        make table, as in the real schema.
      </p>
    </section>
  `,
  styles: [
    DEMO_STYLES,
    `
      .hint--small { font-size: 0.78rem; color: var(--text-3); }
      .panel { display: grid; gap: 12px; padding: 14px; border: 1px solid var(--line); border-radius: var(--r-md); background: var(--surface); min-width: 0; align-content: start; }
      .panel__title { font-size: 0.88rem; }
      .panel__head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
      .fgrid { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); }
      .chk { display: inline-flex; align-items: center; gap: 10px; min-height: 44px; cursor: pointer; font-size: 0.9rem; }
      .chk input { width: 22px; height: 22px; accent-color: var(--lime); margin: 0; flex: none; }
      .chk input:focus-visible { outline: 2px solid var(--accent-text); outline-offset: 2px; }

      .chips { display: flex; flex-wrap: wrap; gap: 8px; }
      .chipbtn { min-height: 44px; text-align: left; }

      .kv--info strong { color: var(--sky); }
      .kv--ok strong { color: var(--mint); }
      .kv--warn strong { color: var(--amber); }
      .kv--bad strong { color: var(--coral); }
      :root[data-theme='light'] .kv--info strong { color: #0a6a94; }
      :root[data-theme='light'] .kv--ok strong { color: #0b7a55; }
      :root[data-theme='light'] .kv--warn strong { color: #8a5a00; }
      :root[data-theme='light'] .kv--bad strong { color: #b3341a; }

      .card { display: grid; gap: 10px; padding: 12px; border: 1px solid var(--line); border-radius: var(--r-sm); background: var(--bg-2); }
      .card__head { display: flex; flex-wrap: wrap; gap: 6px 10px; align-items: center; }
      .card__n { font-family: var(--font-mono); font-size: 0.7rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-3); }
      .card__row { font-family: var(--font-mono); font-size: 0.8rem; color: var(--text); overflow-wrap: anywhere; min-width: 0; }
      .steps { margin: 0; padding: 0; list-style: none; display: grid; gap: 8px; }
      .step { display: grid; grid-template-columns: 62px minmax(0, 1fr); gap: 10px; align-items: start; padding-left: 10px; border-left: 2px solid var(--line-2); }
      .step[data-tone='ok'] { border-left-color: var(--mint); }
      .step[data-tone='info'] { border-left-color: var(--sky); }
      .step[data-tone='warn'] { border-left-color: var(--amber); }
      .step[data-tone='bad'] { border-left-color: var(--coral); }
      .step__stage { font-family: var(--font-mono); font-size: 0.64rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-3); padding-top: 3px; }
      .step__body { display: grid; gap: 3px; min-width: 0; }
      .step__top { display: flex; flex-wrap: wrap; gap: 6px 10px; align-items: center; font-size: 0.86rem; }
      .step__detail { font-size: 0.8rem; line-height: 1.5; color: var(--text-2); overflow-wrap: anywhere; }
      .outcome { display: flex; flex-wrap: wrap; gap: 6px; }

      .dt { border: 1px solid var(--line); border-radius: var(--r-sm); background: var(--bg-2); overflow: hidden; }
      .dt > summary { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 10px; min-height: 44px; padding: 8px 14px; cursor: pointer; font-weight: 600; font-size: 0.9rem; }
      .dt > summary:focus-visible { outline: 2px solid var(--accent-text); outline-offset: -2px; }
      .dt .tbl { border: 0; border-top: 1px solid var(--line); border-radius: 0; }
      .tbl--cap { max-height: 240px; overflow: auto; }
      .tbl--cap th { position: sticky; top: 0; }
      tr.fresh td { animation: rowflash 2.4s ease-out both; }

      .enter { animation: pop 0.32s var(--ease-out) both; }
      @keyframes pop { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
      @keyframes rowflash {
        0% { background: color-mix(in srgb, var(--lime) 40%, transparent); }
        100% { background: color-mix(in srgb, var(--lime) 8%, transparent); }
      }

      @media (max-width: 480px) {
        .step { grid-template-columns: minmax(0, 1fr); gap: 2px; }
        .step__stage { padding-top: 0; }
      }
    `,
  ],
})
export class MmvInserterDemoComponent {
  private readonly device = inject(DeviceService);
  private readonly engine = new InserterEngine();

  readonly maxBatch = MAX_BATCH;

  // form
  readonly make = signal('');
  readonly model = signal('');
  readonly variant = signal('');
  readonly fuel = signal('');
  readonly gvw = signal('');
  readonly segment = signal<'goods' | 'passenger'>('goods');
  readonly body = signal('');
  readonly dry = signal(false);
  readonly batchText = signal(DEFAULT_BATCH);

  // view state
  readonly tables = signal(this.engine.tables());
  readonly results = signal<Card[]>([]);
  readonly summary = signal<Summary | null>(null);
  readonly busy = signal(false);
  readonly activeN = signal(0);
  readonly shown = signal(0);
  readonly live = signal('');

  readonly examples: Example[] = [
    { id: 'alias', label: 'Alias: M&M', hint: 'M&M is rewritten by the alias map to MAHINDRA AND MAHINDRA, then the model is found and a new variant is inserted.',
      rows: [row('M&M', 'Bolero Pik-Up', 'Bolero Pik-Up Extra Strong', 'DIESEL', '3000', 'PICKUP')] },
    { id: 'case', label: 'Whitespace and case', hint: 'Odd spacing and lower case normalise to an exact match: make, model and variant are all found.',
      rows: [row('  eicher   motors ', 'pro 2049', 'pro 2049 xp', 'DIESEL', '4995')] },
    { id: 'hitachi', label: 'TATA HITACHI stays separate', hint: 'TATA HITACHI is its own make (id 108); the new model lands under it, never under TATA.',
      rows: [row('TATA HITACHI', 'ZAXIS 220', 'ZAXIS 220 STANDARD', 'DIESEL', '22000')] },
    { id: 'core', label: 'Core-token unique match', hint: 'ASHOK LEYLAND LIMITED has no alias, but its core tokens equal exactly one DB make, so it is matched.',
      rows: [row('Ashok Leyland Limited', 'DOST', 'DOST LS', 'DIESEL', '2780', 'PICKUP')] },
    { id: 'ambiguous', label: 'Ambiguous core-token', hint: 'FORCE shares its core with two DB makes (FORCE MOTORS, FORCE AUTOMOBILES), so it is NOT guessed: a new make is created.',
      rows: [row('FORCE', 'GURKHA', 'GURKHA XPEDITION', 'DIESEL', '2400')] },
    { id: 'fuel', label: 'Same name, other fuel', hint: 'ACE EX BSIII exists as Diesel and CNG. A Petrol row with the same name is a different vehicle, so it is inserted.',
      rows: [row('TATA MOTORS LTD', 'ACE', 'ACE EX BSIII', 'PETROL', '1450')] },
    { id: 'repeat', label: 'Same row twice', hint: 'Two identical rows in one run: the first inserts, the second is answered from the run cache as found.',
      rows: [
        row('MARUTI SUZUKI', 'SUPER CARRY', 'SUPER CARRY HARD TOP', 'CNG', '1565', 'PICKUP'),
        row('MARUTI SUZUKI', 'SUPER CARRY', 'SUPER CARRY HARD TOP', 'CNG', '1565', 'PICKUP'),
      ] },
  ];

  private queue: RowInput[] = [];
  private counter = 0;
  private dryAtRun = false;
  private fast = false;
  private stepMs = 240;
  private active: Card | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.cancel());
  }

  /* ---------- template helpers ---------- */
  val(ev: Event): string {
    return (ev.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).value;
  }
  checked(ev: Event): boolean {
    return (ev.target as HTMLInputElement).checked;
  }
  setSegment(ev: Event): void {
    this.segment.set(this.val(ev) === 'passenger' ? 'passenger' : 'goods');
  }
  segmentLabel(sub: number): string {
    return sub === SUB_GOODS ? 'Goods (10)' : 'Passenger (9)';
  }
  newCount(rows: { isNew: boolean }[]): number {
    return rows.filter((r) => r.isNew).length;
  }
  makeName(id: number): string {
    return this.tables().makes.find((m) => m.id === id)?.name ?? '?';
  }
  isShown(c: Card, i: number): boolean {
    return c.n !== this.activeN() || i < this.shown();
  }
  isDone(c: Card): boolean {
    return c.n !== this.activeN();
  }

  outcomes(c: Card): Outcome[] {
    if (c.error) return [{ label: 'ROW ERROR \u00b7 rolled back', tone: 'bad' }];
    const one = (what: string, action: Action | '', id: number | null): Outcome => {
      const a = action || 'skipped_no_make_id';
      return { label: `${what} \u00b7 ${a}${id !== null ? ` \u00b7 id ${id}` : ''}`, tone: ACTION_TONE[a] };
    };
    return [one('MAKE', c.makeAction, c.makeId), one('MODEL', c.modelAction, c.modelId), one('VARIANT', c.variantAction, c.variantId)];
  }

  /* ---------- actions ---------- */
  onAdd(ev: Event): void {
    ev.preventDefault();
    this.run([this.currentRow()]);
  }

  runBatch(): void {
    const lines = this.batchText().split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
    if (lines.length && /^make\s*,\s*model/i.test(lines[0])) lines.shift();
    const rows = lines.slice(0, MAX_BATCH).map((l) => {
      const p = l.split(',').map((x) => x.trim());
      return row(p[0] ?? '', p[1] ?? '', p[2] ?? '', p[3] ?? '', p[4] ?? '', this.body(), this.segment());
    });
    this.run(rows);
  }

  runExample(ex: Example): void {
    if (this.busy()) return;
    const first = ex.rows[0];
    this.make.set(first.make);
    this.model.set(first.model);
    this.variant.set(first.variant);
    this.fuel.set(first.fuel);
    this.gvw.set(first.gvw);
    this.segment.set(first.segment);
    this.body.set(first.bodyType);
    this.run(ex.rows);
  }

  resetMaster(): void {
    this.cancel();
    this.engine.reset();
    this.tables.set(this.engine.tables());
    this.results.set([]);
    this.summary.set(null);
    this.activeN.set(0);
    this.busy.set(false);
    this.live.set('Master reset to its preloaded rows.');
  }

  skipAnimation(): void {
    if (!this.busy()) return;
    this.fast = true;
    this.clearTimer();
    if (this.active) this.complete(this.active);
    this.next();
  }

  /* ---------- run driver ---------- */
  private currentRow(): RowInput {
    return row(this.make(), this.model(), this.variant(), this.fuel(), this.gvw(), this.body(), this.segment());
  }

  private run(rows: RowInput[]): void {
    if (this.busy() || !rows.length) return;
    this.cancel();
    this.engine.startRun();
    this.tables.set(this.engine.tables());
    this.results.set([]);
    this.summary.set(null);
    this.counter = 0;
    this.dryAtRun = this.dry();
    this.queue = rows.slice(0, MAX_BATCH);
    this.fast = this.device.reducedMotion;
    this.stepMs = rows.length > 1 ? 150 : 240;
    this.busy.set(true);
    this.live.set(`Processing ${this.queue.length} row${this.queue.length === 1 ? '' : 's'}${this.dryAtRun ? ' as a dry run' : ''}.`);
    this.next();
  }

  private next(): void {
    this.timer = null;
    for (;;) {
      const inp = this.queue.shift();
      if (!inp) {
        this.finishRun();
        return;
      }
      const res = this.engine.processRow(inp, this.dryAtRun);
      const card: Card = { ...res, n: ++this.counter };
      this.results.update((l) => [card, ...l]);
      if (this.fast) {
        this.active = card;
        this.complete(card);
        continue;
      }
      this.active = card;
      this.activeN.set(card.n);
      this.shown.set(1);
      this.revealMore(card);
      return;
    }
  }

  private revealMore(card: Card): void {
    this.timer = setTimeout(() => {
      this.timer = null;
      const n = this.shown() + 1;
      this.shown.set(n);
      if (n >= card.steps.length) {
        this.timer = setTimeout(() => {
          this.timer = null;
          this.complete(card);
          this.timer = setTimeout(() => this.next(), 260);
        }, this.stepMs);
        return;
      }
      this.revealMore(card);
    }, this.stepMs);
  }

  /** The row's trace is fully shown: only now do the tables and counters show its effect. */
  private complete(card: Card): void {
    this.activeN.set(0);
    this.active = null;
    this.tables.set(this.engine.tables());
    this.summary.set({ ...this.engine.summary });
    this.live.set(this.describe(card));
  }

  private finishRun(): void {
    this.busy.set(false);
    this.active = null;
    const s = this.engine.summary;
    this.live.set(
      `Run complete: ${s.total} row${s.total === 1 ? '' : 's'}, found ${s.makesFound + s.modelsFound + s.variantsFound}, inserted ${s.makesInserted + s.modelsInserted + s.variantsInserted}, skipped ${s.skipped}, errors ${s.errors}.`,
    );
  }

  private describe(c: Card): string {
    if (c.error) return `Row ${c.n} failed and was rolled back: ${c.error}.`;
    const part = (what: string, a: Action | '', id: number | null): string => `${what} ${a ? a.replace(/_/g, ' ') : 'skipped'}${id !== null ? ` (id ${id})` : ''}`;
    return `Row ${c.n}: ${part('make', c.makeAction, c.makeId)}, ${part('model', c.modelAction, c.modelId)}, ${part('variant', c.variantAction, c.variantId)}.`;
  }

  private clearTimer(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private cancel(): void {
    this.clearTimer();
    this.queue = [];
    this.active = null;
  }
}
