import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { DeviceService } from '../../services/device.service';
import { DEMO_STYLES } from './demo-styles';
import { ratio, tokenSetRatio, tokenSortRatio } from './fuzzy';

/* ------------------------------------------------------------------ *
 *  Types
 * ------------------------------------------------------------------ */

type PartnerId = 'A' | 'B' | 'C';
type VType = 'Truck' | 'Pickup' | 'Tipper';
type Decision = 'match' | 'review' | 'none';

interface MasterRow {
  id: string;
  make: string;
  model: string;
  variant: string;
  fuel: string;
  gvw: number;
  type: VType;
}

/** One partner row exactly as the partner's file spells it. */
interface RawRow {
  make: string;
  model: string;
  variant: string;
  fuel: string;
  gvw: string;
  type: string;
}

interface Norm {
  makeKey: string;
  model: string;
  variant: string;
  concat: string;
  hasVariant: boolean;
  fuel: string | null;
  gvw: number | null;
  type: VType | null;
  typeFrom: 'column' | 'text' | 'unknown';
  numbers: string[];
  modelMoved: boolean;
}

interface MasterNorm extends Norm {
  row: MasterRow;
}

interface GateCell {
  state: 'pass' | 'fail' | 'skip';
  text: string;
}

interface Candidate {
  m: MasterNorm;
  gates: { type: GateCell; fuel: GateCell; gvw: GateCell; num: GateCell };
  failed: string[];
  mode: 'standard' | 'concat';
  sMake: number;
  sModel: number;
  sVariant: number | null;
  sNumber: number;
  sGvw: number;
  sType: number;
  raw: number;
  confidence: number;
}

interface Outcome {
  raw: RawRow;
  partner: PartnerId;
  norm: Norm;
  groupKey: string | null;
  groupRatio: number;
  groupSize: number;
  total: number;
  groupIds: string[];
  candidates: Candidate[];
  survivors: Candidate[];
  winner: Candidate | null;
  decision: Decision;
  bypassedWrong: boolean;
  gatesEnforced: boolean;
  reason: string;
}

interface FileRow {
  i: number;
  raw: RawRow;
  out: Outcome;
}

/* ------------------------------------------------------------------ *
 *  Settings (taken from the real engine's scorer config + rules)
 * ------------------------------------------------------------------ */

const WEIGHTS = { model: 35, variant: 20, number: 25, gvw: 10, type: 10 };
const MATCH_AT = 72;
const REVIEW_AT = 50;
const MAKE_FALLBACK_AT = 85;

const SLABS: Array<{ name: string; lo: number; hi: number }> = [
  { name: '0-3,500', lo: 0, hi: 3500 },
  { name: '3,501-7,500', lo: 3501, hi: 7500 },
  { name: '7,501-12,000', lo: 7501, hi: 12000 },
  { name: '12,001-40,000', lo: 12001, hi: 40000 },
  { name: '40,001+', lo: 40001, hi: Infinity },
];

const PARTNERS: Record<PartnerId, { label: string; blurb: string; gvwSlack: number; fuelHint: string; gvwHint: string }> = {
  A: {
    label: 'Partner A',
    blurb: 'Make carries company suffixes (TATA MOTORS LTD), fuel is plain text, GVW in kg, has a vehicle-type column.',
    gvwSlack: 0,
    fuelHint: 'DIESEL',
    gvwHint: '10700 (kg)',
  },
  B: {
    label: 'Partner B',
    blurb: 'Fuel is a letter code (D / P / C), GVW is in tonnes rounded to 0.1, make uses short forms (M&M, AL).',
    gvwSlack: 50,
    fuelHint: 'D',
    gvwHint: '10.7 (tonnes)',
  },
  C: {
    label: 'Partner C',
    blurb: 'Fuel is a numeric code (1 diesel, 2 petrol, 3 CNG, 4 electric) and the model sits in the variant column.',
    gvwSlack: 0,
    fuelHint: '1',
    gvwHint: '10700 KG',
  },
};

const MASTER: MasterRow[] = [
  { id: 'M01', make: 'TATA', model: 'LPT 1109', variant: 'HD CAB', fuel: 'Diesel', gvw: 10700, type: 'Truck' },
  { id: 'M02', make: 'TATA', model: 'LPT 1412', variant: 'CBC', fuel: 'Diesel', gvw: 14250, type: 'Truck' },
  { id: 'M03', make: 'TATA', model: 'ACE GOLD', variant: 'DELUXE', fuel: 'Petrol', gvw: 1610, type: 'Pickup' },
  { id: 'M04', make: 'TATA', model: '407 GOLD', variant: 'SFC', fuel: 'Diesel', gvw: 4670, type: 'Truck' },
  { id: 'M05', make: 'TATA', model: 'SIGNA 4825 TK', variant: 'TIPPER', fuel: 'Diesel', gvw: 48000, type: 'Tipper' },
  { id: 'M06', make: 'MAHINDRA', model: 'BOLERO PIK-UP', variant: 'EXTRA STRONG', fuel: 'Diesel', gvw: 2650, type: 'Pickup' },
  { id: 'M07', make: 'MAHINDRA', model: 'BOLERO MAXX PIK-UP', variant: 'CITY', fuel: 'Diesel', gvw: 2800, type: 'Pickup' },
  { id: 'M08', make: 'MAHINDRA', model: 'JEETO', variant: 'PLUS', fuel: 'CNG', gvw: 1500, type: 'Pickup' },
  { id: 'M09', make: 'ASHOK LEYLAND', model: 'DOST', variant: 'LS', fuel: 'Diesel', gvw: 2520, type: 'Pickup' },
  { id: 'M10', make: 'ASHOK LEYLAND', model: 'ECOMET 1615', variant: 'HE', fuel: 'Diesel', gvw: 16200, type: 'Truck' },
  { id: 'M11', make: 'ASHOK LEYLAND', model: 'BOSS 1115', variant: 'HE', fuel: 'Diesel', gvw: 11000, type: 'Truck' },
  { id: 'M12', make: 'EICHER', model: 'PRO 2049', variant: 'CNG', fuel: 'CNG', gvw: 4990, type: 'Truck' },
  { id: 'M13', make: 'EICHER', model: 'PRO 2095', variant: 'XP', fuel: 'Diesel', gvw: 9600, type: 'Truck' },
  { id: 'M14', make: 'BHARATBENZ', model: '1617R', variant: 'CBC', fuel: 'Diesel', gvw: 16200, type: 'Truck' },
];

const r = (make: string, model: string, variant: string, fuel: string, gvw: string, type = ''): RawRow => ({
  make,
  model,
  variant,
  fuel,
  gvw,
  type,
});

const PARTNER_ROWS: Record<PartnerId, RawRow[]> = {
  A: [
    r('TATA MOTORS LTD', 'LPT 1109', 'HD CAB', 'DIESEL', '10700', 'TRUCK'),
    r('TATA MOTORS LTD', '1412 LPT', 'CBC', 'DIESEL', '14250', 'TRUCK'),
    r('TATA MOTORS LIMITED', 'ACE GOLD', 'DELUXE', 'PETROL', '1610', 'PICK-UP'),
    r('TATA MOTORS LTD', 'ACE GOLD', 'DELUXE', 'CNG', '1610', 'PICK-UP'),
    r('MAHINDRA & MAHINDRA LTD', 'BOLERO PIKUP', 'EXTRA STRONG', 'DIESEL', '2650', 'PICK-UP'),
    r('MAHINDRA & MAHINDRA LTD', 'JEETO', 'PLUS VERSION', 'CNG', '1500', 'PICK-UP'),
    r('ASHOK LEYLAND LTD', 'DOST', 'LS', 'DIESEL', '2520', 'PICK-UP'),
    r('EICHER MOTORS LTD', 'PRO 2049', '', 'CNG', '4990', 'TRUCK'),
    r('FORCE MOTORS LTD', 'TRAX CRUISER', 'STD', 'DIESEL', '2200', 'TRUCK'),
    r('TATA MOTORS LTD', 'SIGNA 4825 TK', 'TIPPER', 'DIESEL', '48000', 'TIPPER'),
    r('MAHINDRA & MAHINDRA LTD', 'BOLERO CAMPER', 'GOLD', 'DIESEL', '2650', 'PICK-UP'),
  ],
  B: [
    r('TATA', 'LPT 1109', 'HD CAB', 'D', '10.7'),
    r('TATA', 'ACE GOLD', 'DELUXE', 'P', '1.6'),
    r('TATA', 'ACE GOLD DELUXE', '', 'C', '1.6'),
    r('M&M', 'BOLERO PIK UP', 'EXTRA STRONG', 'D', '2.6'),
    r('M&M', 'JEETO PLUS', '', 'C', '1.5'),
    r('AL', 'DOST LS', '', 'D', '2.5'),
    r('AL', 'ECOMET 1615', 'HE', 'D', '16.3'),
    r('BHARAT BENZ', '1617 R', 'CBC', 'D', '16.2'),
    r('EICHER', 'PRO 2049', '', 'C', '5.0'),
    r('TATA', '407 GOLD SFC', '', 'D', '4.7'),
    r('TATA', 'SIGNA 4825 TK', 'TIPPER', 'D', '48.0'),
    r('M&M', 'BOLERO CAMPER', 'GOLD', 'D', '2.6'),
  ],
  C: [
    r('TATA-MOTORS', '', 'LPT 1109 HD CAB', '1', '10700 KG'),
    r('TATA-MOTORS', '', 'ACE GOLD DELUXE', '2', '1610 KG'),
    r('TATA-MOTORS', '', 'ACE GOLD DELUXE', '3', '1610 KG'),
    r('MAHINDRA', '', 'BOLERO MAXX PIK UP CITY', '1', '2740 KG'),
    r('MAHINDRA', '', 'JEETO PLUS', '3', '1500 KG'),
    r('ASHOK LEYLAND', '', 'DOST LS', '1', '2520 KG'),
    r('ASHOK LEYLAND', '', 'BOSS 1115 HE', '1', '11000 KG'),
    r('EICHER MOTORS', '', 'PRO 2095 XP', '1', '9600 KG'),
    r('EICHER MOTORS', '', 'PRO 2095', '4', '9600 KG'),
    r('TATA MOTORS', '', 'LPT 1412', '1', '14250 KG'),
    r('ASHOK LEYLAND', '', '1616 IL', '1', '16200 KG'),
    r('MAHINDRA', '', 'BOLERO CAMPER GOLD', '1', '2650 KG'),
  ],
};

/* ------------------------------------------------------------------ *
 *  Normalisers (small per-partner rules + shared cleaning)
 * ------------------------------------------------------------------ */

const MAKE_NOISE = new Set(['LTD', 'LIMITED', 'PVT', 'PRIVATE', 'MOTORS', 'MOTOR', 'INDIA', 'CORPORATION', 'CORP', 'CO', 'COMPANY']);
const MAKE_ALIAS: Record<string, string> = {
  'M&M': 'MAHINDRA',
  'MAHINDRA&MAHINDRA': 'MAHINDRA',
  AL: 'ASHOK LEYLAND',
  'BHARAT BENZ': 'BHARATBENZ',
};

function normaliseMake(raw: string): string {
  const base = raw
    .toUpperCase()
    .replace(/\s*&\s*/g, '&')
    .replace(/[^A-Z0-9& ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const kept = base.split(' ').filter((t) => t && !MAKE_NOISE.has(t));
  const joined = (kept.length ? kept : base.split(' ')).join(' ');
  return MAKE_ALIAS[joined] ?? joined;
}

function cleanText(s: string): string {
  return s
    .toUpperCase()
    .replace(/\bBS[\s-]?(?:III|IV|VI|\d)\b/g, ' ')
    .replace(/[^A-Z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const FUEL_TEXT: Record<string, string> = {
  DIESEL: 'Diesel',
  D: 'Diesel',
  DSL: 'Diesel',
  PETROL: 'Petrol',
  P: 'Petrol',
  GASOLINE: 'Petrol',
  CNG: 'CNG',
  C: 'CNG',
  'COMPRESSED NATURAL GAS': 'CNG',
  ELECTRIC: 'Electric',
  E: 'Electric',
  EV: 'Electric',
  BATTERY: 'Electric',
  LPG: 'LPG',
};
const FUEL_NUMERIC: Record<string, string> = { '1': 'Diesel', '2': 'Petrol', '3': 'CNG', '4': 'Electric' };

function decodeFuel(raw: string, partner: PartnerId): string | null {
  const parts = raw
    .toUpperCase()
    .split('+')
    .map((p) => p.trim().replace(/\s+/g, ' '))
    .filter(Boolean);
  if (!parts.length) return null;
  const out: string[] = [];
  for (const p of parts) {
    const hit = (partner === 'C' ? FUEL_NUMERIC[p] : undefined) ?? FUEL_TEXT[p];
    if (!hit) return null;
    out.push(hit);
  }
  return out.join('+');
}

function parseGvw(raw: string): number | null {
  const s = raw.trim().toUpperCase().replace(/,/g, '');
  const m = /^(\d+(?:\.\d+)?)\s*(KG|KGS|T|TON|TONS|TONNE|TONNES|MT)?$/.exec(s);
  if (!m) return null;
  const n = parseFloat(m[1]);
  const tonnes = !!m[2] && !m[2].startsWith('K');
  if (!isFinite(n) || n <= 0) return null;
  return Math.round(tonnes || n < 100 ? n * 1000 : n);
}

function slabOf(gvw: number): { name: string; lo: number; hi: number } {
  return SLABS.find((s) => gvw >= s.lo && gvw <= s.hi) ?? SLABS[SLABS.length - 1];
}

function inferType(typeCol: string, model: string, variant: string): { type: VType | null; from: 'column' | 'text' | 'unknown' } {
  const test = (t: string): VType | null => {
    if (/TIPPER|DUMPER/.test(t)) return 'Tipper';
    if (/PICK ?UP|PIK ?UP/.test(t)) return 'Pickup';
    if (/TRUCK|CARRIER/.test(t)) return 'Truck';
    return null;
  };
  const col = typeCol.trim() ? test(cleanText(typeCol)) : null;
  if (col) return { type: col, from: 'column' };
  const txt = test(cleanText(model + ' ' + variant));
  return txt ? { type: txt, from: 'text' } : { type: null, from: 'unknown' };
}

function numbersOf(text: string): string[] {
  return Array.from(new Set(text.match(/\d{2,}/g) ?? []));
}

function normalise(raw: RawRow, partner: PartnerId): Norm {
  const modelMoved = !raw.model.trim() && !!raw.variant.trim();
  const modelText = modelMoved ? raw.variant : raw.model;
  const variantText = modelMoved ? '' : raw.variant;
  const model = cleanText(modelText);
  const variant = cleanText(variantText);
  const concat = cleanText(modelText + ' ' + variantText);
  const t = inferType(raw.type, modelText, variantText);
  return {
    makeKey: normaliseMake(raw.make),
    model,
    variant,
    concat,
    hasVariant: !!variant,
    fuel: decodeFuel(raw.fuel, partner),
    gvw: parseGvw(raw.gvw),
    type: t.type,
    typeFrom: t.from,
    numbers: numbersOf(concat),
    modelMoved,
  };
}

const MASTER_NORM: MasterNorm[] = MASTER.map((row) => {
  const model = cleanText(row.model);
  const variant = cleanText(row.variant);
  const concat = cleanText(row.model + ' ' + row.variant);
  return {
    row,
    makeKey: normaliseMake(row.make),
    model,
    variant,
    concat,
    hasVariant: !!variant,
    fuel: row.fuel,
    gvw: row.gvw,
    type: row.type,
    typeFrom: 'column' as const,
    numbers: numbersOf(concat),
    modelMoved: false,
  };
});

/* ------------------------------------------------------------------ *
 *  The matching pipeline (rules gates -> fuzzy -> confidence -> bands)
 * ------------------------------------------------------------------ */

function confidenceOf(
  mode: 'standard' | 'concat',
  model: number,
  variant: number | null,
  num: number,
  gvw: number,
  type: number,
): number {
  const typeKnown = type >= 0;
  let wModel = mode === 'concat' ? WEIGHTS.model + WEIGHTS.variant : WEIGHTS.model;
  const wVar = mode === 'concat' ? 0 : WEIGHTS.variant;
  if (!typeKnown) wModel += WEIGHTS.type; // unknown type: its weight is handed to model text
  const wType = typeKnown ? WEIGHTS.type : 0;
  const total = wModel + wVar + WEIGHTS.number + WEIGHTS.gvw + wType;
  const sum =
    (model / 100) * wModel +
    ((variant ?? 0) / 100) * wVar +
    num * WEIGHTS.number +
    gvw * WEIGHTS.gvw +
    (typeKnown ? (type / 100) * WEIGHTS.type : 0);
  return (sum / total) * 100;
}

function numberScore(p: string[], m: string[]): number {
  if (!p.length && !m.length) return 1;
  if (!m.length) return 0.85; // master has none: mild penalty
  if (!p.length) return 0.8;
  if (p.every((n) => m.includes(n))) return 1;
  return 0.2;
}

function scoreCandidate(p: Norm, m: MasterNorm, partner: PartnerId, makeRatio: number): Candidate {
  const failed: string[] = [];

  // gate: vehicle type
  let gType: GateCell;
  if (!p.type) gType = { state: 'skip', text: 'type unknown' };
  else if (p.type === m.row.type) gType = { state: 'pass', text: p.type };
  else {
    gType = { state: 'fail', text: p.type + ' vs ' + m.row.type };
    failed.push('vehicle type');
  }

  // gate: fuel (bi-fuel overlaps count)
  let gFuel: GateCell;
  if (!p.fuel) gFuel = { state: 'skip', text: 'fuel unreadable' };
  else {
    const a = new Set(p.fuel.split('+'));
    const overlap = (m.fuel ?? '').split('+').some((f) => a.has(f));
    if (overlap) gFuel = { state: 'pass', text: p.fuel };
    else {
      gFuel = { state: 'fail', text: p.fuel + ' vs ' + m.fuel };
      failed.push('fuel');
    }
  }

  // gate: GVW slab + direction (partner may not exceed master)
  let gGvw: GateCell;
  let gvwClose = 0.5;
  if (p.gvw === null || m.gvw === null) gGvw = { state: 'skip', text: 'GVW unreadable' };
  else {
    const sp = slabOf(p.gvw);
    const sm = slabOf(m.gvw);
    const slack = PARTNERS[partner].gvwSlack;
    if (sp.name !== sm.name) {
      gGvw = { state: 'fail', text: 'slab ' + sp.name + ' vs ' + sm.name };
      failed.push('GVW slab');
    } else if (p.gvw > m.gvw + slack) {
      gGvw = { state: 'fail', text: p.gvw + ' kg is above ' + m.gvw + ' kg' };
      failed.push('GVW direction');
    } else {
      gGvw = { state: 'pass', text: sm.name };
      const width = sm.hi === Infinity ? 40000 : sm.hi - sm.lo;
      gvwClose = Math.max(0, 1 - Math.abs(p.gvw - m.gvw) / width);
    }
  }

  // gate: model numbers (partner numbers must be a subset of the master's)
  let gNum: GateCell;
  if (p.numbers.length && m.numbers.length) {
    if (p.numbers.every((n) => m.numbers.includes(n))) gNum = { state: 'pass', text: p.numbers.join(', ') };
    else {
      gNum = { state: 'fail', text: p.numbers.join(', ') + ' vs ' + m.numbers.join(', ') };
      failed.push('model number');
    }
  } else gNum = { state: 'skip', text: 'no number to compare' };

  // fuzzy signals
  const mode: 'standard' | 'concat' = p.hasVariant && m.hasVariant ? 'standard' : 'concat';
  const sModel = mode === 'standard' ? tokenSetRatio(p.model, m.model) : tokenSetRatio(p.concat, m.concat);
  const sVariant = mode === 'standard' ? tokenSortRatio(p.variant, m.variant) : null;
  const sNumber = numberScore(p.numbers, m.numbers);
  const sType = !p.type ? -1 : p.type === m.row.type ? 100 : 0;
  const raw = confidenceOf(mode, sModel, sVariant, sNumber, gvwClose, sType);

  return {
    m,
    gates: { type: gType, fuel: gFuel, gvw: gGvw, num: gNum },
    failed,
    mode,
    sMake: makeRatio,
    sModel,
    sVariant,
    sNumber,
    sGvw: gvwClose,
    sType,
    raw,
    confidence: failed.length ? 0 : raw,
  };
}

function matchRow(rawRow: RawRow, partner: PartnerId, gatesEnforced: boolean): Outcome {
  const norm = normalise(rawRow, partner);
  const total = MASTER_NORM.length;

  // group by normalised make (exact first, then a typo-tolerant fallback)
  let groupKey: string | null = null;
  let groupRatio = 0;
  if (norm.makeKey) {
    const keys = Array.from(new Set(MASTER_NORM.map((m) => m.makeKey)));
    if (keys.includes(norm.makeKey)) {
      groupKey = norm.makeKey;
      groupRatio = 100;
    } else {
      for (const k of keys) {
        const rr = ratio(norm.makeKey, k);
        if (rr > groupRatio) {
          groupRatio = rr;
          if (rr >= MAKE_FALLBACK_AT) groupKey = k;
        }
      }
    }
  }
  const group = groupKey ? MASTER_NORM.filter((m) => m.makeKey === groupKey) : [];
  const candidates = group
    .map((m) => scoreCandidate(norm, m, partner, ratio(norm.makeKey, m.makeKey)))
    .sort((a, b) => b.raw - a.raw);
  const survivors = candidates.filter((c) => c.failed.length === 0).sort((a, b) => b.confidence - a.confidence);

  const base = {
    raw: rawRow,
    partner,
    norm,
    groupKey,
    groupRatio,
    groupSize: group.length,
    total,
    groupIds: group.map((g) => g.row.id),
    candidates,
    survivors,
    gatesEnforced,
  };

  if (!groupKey) {
    return {
      ...base,
      winner: null,
      decision: 'none',
      bypassedWrong: false,
      reason:
        'No master rows for make "' + (norm.makeKey || 'blank') + '" (closest group scored ' + Math.round(groupRatio) + ', below the ' + MAKE_FALLBACK_AT + ' fallback). Nothing to compare.',
    };
  }

  const pool = gatesEnforced ? survivors : [...candidates].sort((a, b) => b.raw - a.raw);
  if (!pool.length) {
    const reasons = Array.from(new Set(candidates.flatMap((c) => c.failed)));
    const best = candidates[0];
    return {
      ...base,
      winner: null,
      decision: 'none',
      bypassedWrong: false,
      reason:
        'All ' + candidates.length + ' candidates in the ' + groupKey + ' group failed a rule gate (' + reasons.join(', ') + '). Text alone would have scored ' +
        Math.round(best.raw) + ', but gates are absolute, so there is no match.',
    };
  }
  const winner = pool[0];
  const score = gatesEnforced ? winner.confidence : winner.raw;
  const decision: Decision = score >= MATCH_AT ? 'match' : score >= REVIEW_AT ? 'review' : 'none';
  const wrong = !gatesEnforced && winner.failed.length > 0 && decision !== 'none';
  let reason: string;
  if (wrong) {
    reason =
      'Gates are OFF, so ' + winner.m.row.id + ' wins on text alone (' + Math.round(winner.raw) + '). It fails: ' + winner.failed.join(', ') +
      '. This is a wrong mapping that the gates would have blocked.';
  } else if (decision === 'match') {
    reason = 'Confidence ' + score.toFixed(1) + ' is at or above ' + MATCH_AT + ' and every gate passed. Best of ' + pool.length + ' surviving candidate' + (pool.length === 1 ? '' : 's') + '.';
  } else if (decision === 'review') {
    reason = 'Confidence ' + score.toFixed(1) + ' is between ' + REVIEW_AT + ' and ' + MATCH_AT + '. Gates passed but the text is only a partial match, so a person should confirm.';
  } else {
    reason = 'Best surviving candidate scored ' + score.toFixed(1) + ', below the ' + REVIEW_AT + ' review floor.';
  }
  return { ...base, winner, decision, bypassedWrong: wrong, reason };
}

/* ------------------------------------------------------------------ *
 *  Component
 * ------------------------------------------------------------------ */

@Component({
  selector: 'app-matching-demo',
  standalone: true,
  imports: [DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="demo" aria-labelledby="md-title">
      <div class="demo__bar">
        <strong class="demo__title" id="md-title">Catalogue matching engine</strong>
        <span class="demo__tag">Interactive &middot; runs in your browser</span>
      </div>

      <div class="demo__body">
        <details class="master" open>
          <summary>Internal master catalogue ({{ masterRows.length }} rows, grouped by make)</summary>
          <div class="tbl">
            <table>
              <caption class="sr-only">Internal master catalogue</caption>
              <thead>
                <tr><th>ID</th><th>Make</th><th>Model</th><th>Variant</th><th>Fuel</th><th>GVW kg</th><th>Type</th></tr>
              </thead>
              <tbody>
                @for (m of masterRows; track m.id) {
                  <tr [class.in-group]="outcome() !== null && outcome()!.groupIds.includes(m.id)">
                    <td>{{ m.id }}</td><td>{{ m.make }}</td><td>{{ m.model }}</td><td>{{ m.variant }}</td>
                    <td>{{ m.fuel }}</td><td>{{ m.gvw }}</td><td>{{ m.type }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </details>

        <div class="grid-2">
          <div class="col">
            <label class="field">
              <span>Partner catalogue</span>
              <select (change)="setPartner($any($event.target).value)">
                <option value="A" [selected]="partner() === 'A'">Partner A</option>
                <option value="B" [selected]="partner() === 'B'">Partner B</option>
                <option value="C" [selected]="partner() === 'C'">Partner C</option>
              </select>
            </label>
            <p class="hint">{{ partnerInfo().blurb }}</p>

            <div class="row" role="group" aria-label="Where the row to match comes from">
              <button type="button" class="dbtn dbtn--sm" [attr.aria-pressed]="mode() === 'pick'" (click)="setMode('pick')">Pick a partner row</button>
              <button type="button" class="dbtn dbtn--sm" [attr.aria-pressed]="mode() === 'custom'" (click)="setMode('custom')">Type my own row</button>
            </div>

            @if (mode() === 'pick') {
              <div class="tbl plist">
                <table>
                  <caption class="sr-only">{{ partnerInfo().label }} rows as the partner spells them</caption>
                  <thead>
                    <tr><th>Use</th><th>make</th><th>model</th><th>variant</th><th>fuel</th><th>gvw</th>@if (partner() === 'A') {<th>type</th>}</tr>
                  </thead>
                  <tbody>
                    @for (row of partnerRows(); track $index) {
                      <tr [class.sel]="selected() === $index">
                        <td>
                          <button type="button" class="dbtn dbtn--sm pick" [attr.aria-pressed]="selected() === $index" [attr.aria-label]="'Use row ' + ($index + 1) + ': ' + row.make + ' ' + row.model + ' ' + row.variant" (click)="selected.set($index)">{{ $index + 1 }}</button>
                        </td>
                        <td>{{ row.make }}</td>
                        <td>{{ row.model || '(blank)' }}</td>
                        <td>{{ row.variant || '(blank)' }}</td>
                        <td>{{ row.fuel }}</td>
                        <td>{{ row.gvw }}</td>
                        @if (partner() === 'A') {<td>{{ row.type }}</td>}
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            } @else {
              <div class="form">
                <label class="field"><span>Make</span><input type="text" [value]="cMake()" (input)="cMake.set($any($event.target).value)" placeholder="TATA MOTORS LTD" autocomplete="off" /></label>
                <label class="field"><span>Model</span><input type="text" [value]="cModel()" (input)="cModel.set($any($event.target).value)" placeholder="ACE GOLD" autocomplete="off" /></label>
                <label class="field"><span>Variant</span><input type="text" [value]="cVariant()" (input)="cVariant.set($any($event.target).value)" placeholder="DELUXE" autocomplete="off" /></label>
                <label class="field"><span>Fuel</span><input type="text" [value]="cFuel()" (input)="cFuel.set($any($event.target).value)" [attr.placeholder]="partnerInfo().fuelHint" autocomplete="off" /></label>
                <label class="field"><span>GVW</span><input type="text" [value]="cGvw()" (input)="cGvw.set($any($event.target).value)" [attr.placeholder]="partnerInfo().gvwHint" inputmode="decimal" autocomplete="off" /></label>
                <label class="field">
                  <span>Vehicle type</span>
                  <select (change)="cType.set($any($event.target).value)">
                    <option value="" [selected]="cType() === ''">Not given</option>
                    <option value="TRUCK" [selected]="cType() === 'TRUCK'">Truck</option>
                    <option value="PICK-UP" [selected]="cType() === 'PICK-UP'">Pick-up</option>
                    <option value="TIPPER" [selected]="cType() === 'TIPPER'">Tipper</option>
                  </select>
                </label>
              </div>
            }

            <div class="row">
              <button type="button" class="dbtn dbtn--primary" [disabled]="!canMatch()" (click)="runMatch()">Match</button>
              <button type="button" class="dbtn" (click)="runFile()">Match entire partner file ({{ partnerRows().length }} rows)</button>
            </div>
            <label class="chk">
              <input type="checkbox" [checked]="gatesOff()" (change)="gatesOff.set($any($event.target).checked)" />
              <span>Turn rule gates off (shows the wrong match they prevent)</span>
            </label>
          </div>

          <div class="col">
            <div class="why">
              <strong>Why the gates matter</strong>
              <p class="hint">
                A CNG Ace Gold from Partner A reads almost word for word like a petrol master row, so text similarity alone would happily map it. The fuel gate rejects it no matter how good the text is.
              </p>
              <button type="button" class="dbtn dbtn--sm" (click)="tryExample()">Try this example</button>
            </div>
            <div class="kvs">
              <div class="kv"><strong>{{ weightLabel }}</strong><span>weights: model / variant / number / GVW / type</span></div>
              <div class="kv"><strong>&ge; {{ matchAt }}</strong><span>Matched</span></div>
              <div class="kv"><strong>{{ reviewAt }}&ndash;{{ matchAt }}</strong><span>Needs review</span></div>
            </div>
          </div>
        </div>

        <div aria-live="polite" class="result">
          @if (outcome(); as o) {
            <ol class="stages">
              <!-- 1 Normalise -->
              @if (revealed() >= 1) {
                <li class="stage">
                  <h3 class="stage__h"><span class="num">1</span> Normalise</h3>
                  <div class="tbl">
                    <table>
                      <thead><tr><th>Field</th><th>Partner wrote</th><th>Engine uses</th></tr></thead>
                      <tbody>
                        @for (n of normRows(); track n.field) {
                          <tr><td>{{ n.field }}</td><td class="mono">{{ n.before }}</td><td class="mono">{{ n.after }} @if (n.note) {<span class="pill info">{{ n.note }}</span>}</td></tr>
                        }
                      </tbody>
                    </table>
                  </div>
                </li>
              }

              <!-- 2 Group -->
              @if (revealed() >= 2) {
                <li class="stage">
                  <h3 class="stage__h"><span class="num">2</span> Group by make</h3>
                  <p class="hint">
                    @if (o.groupKey) {
                      Make <strong class="mono">{{ o.norm.makeKey }}</strong> matched group <strong class="mono">{{ o.groupKey }}</strong>
                      @if (o.groupRatio < 100) { by fuzzy fallback (ratio {{ o.groupRatio | number: '1.0-0' }}) }
                      &mdash; compared <strong>{{ o.groupSize }}</strong> of <strong>{{ o.total }}</strong> master rows, pruned <strong>{{ prunedPct() }}%</strong>.
                    } @else {
                      No master group for <strong class="mono">{{ o.norm.makeKey || 'blank' }}</strong> &mdash; compared <strong>0</strong> of <strong>{{ o.total }}</strong> rows, pruned <strong>100%</strong>.
                    }
                  </p>
                  <div class="bar" role="img" [attr.aria-label]="'Compared ' + o.groupSize + ' of ' + o.total + ' master rows'">
                    <i class="bar__fill" [style.width.%]="(o.groupSize / o.total) * 100"></i>
                  </div>
                  <div class="dots" aria-hidden="true">
                    @for (m of masterRows; track m.id; let i = $index) {
                      <span class="dot" [class.on]="o.groupIds.includes(m.id)" [style.animation-delay.ms]="i * 40" [title]="m.id"></span>
                    }
                  </div>
                </li>
              }

              <!-- 3 Gates -->
              @if (revealed() >= 3) {
                <li class="stage">
                  <h3 class="stage__h"><span class="num">3</span> Rule gates @if (!o.gatesEnforced) {<span class="pill warn">gates off</span>}</h3>
                  @if (o.candidates.length) {
                    <div class="tbl">
                      <table>
                        <thead><tr><th>Candidate</th><th>Type</th><th>Fuel</th><th>GVW slab</th><th>Model no.</th><th>Verdict</th></tr></thead>
                        <tbody>
                          @for (c of o.candidates; track c.m.row.id; let i = $index) {
                            <tr class="cand" [class.rej]="c.failed.length > 0" [style.animation-delay.ms]="i * 90">
                              <td><strong>{{ c.m.row.id }}</strong> {{ c.m.row.model }} {{ c.m.row.variant }}</td>
                              <td>{{ gateIcon(c.gates.type.state) }} <span class="g">{{ c.gates.type.text }}</span></td>
                              <td>{{ gateIcon(c.gates.fuel.state) }} <span class="g">{{ c.gates.fuel.text }}</span></td>
                              <td>{{ gateIcon(c.gates.gvw.state) }} <span class="g">{{ c.gates.gvw.text }}</span></td>
                              <td>{{ gateIcon(c.gates.num.state) }} <span class="g">{{ c.gates.num.text }}</span></td>
                              <td>
                                @if (c.failed.length) { <span class="pill bad">Rejected</span> <span class="g">text alone: {{ c.raw | number: '1.0-0' }}</span> }
                                @else { <span class="pill ok">Survives</span> }
                              </td>
                            </tr>
                          }
                        </tbody>
                      </table>
                    </div>
                    <p class="hint small">Pass = &#10003; &nbsp; Fail = &#10007; &nbsp; Skipped (unknown value) = &ndash;. Failing any single gate rejects the candidate.</p>
                  } @else {
                    <p class="hint">No candidates to gate.</p>
                  }
                </li>
              }

              <!-- 4 Fuzzy -->
              @if (revealed() >= 4) {
                <li class="stage">
                  <h3 class="stage__h"><span class="num">4</span> Fuzzy score</h3>
                  @if (scored().length) {
                    <div class="scored">
                      @for (c of scored(); track c.m.row.id; let i = $index) {
                        <div class="sc" [class.best]="o.winner === c">
                          <div class="sc__head"><strong>{{ c.m.row.id }}</strong> {{ c.m.row.model }} {{ c.m.row.variant }}
                            <span class="pill mute">{{ c.mode === 'concat' ? 'concat mode' : 'standard mode' }}</span>
                          </div>
                          @for (b of bars(c); track b.label) {
                            <div class="mini">
                              <span class="mini__l">{{ b.label }}</span>
                              <span class="mini__t"><i class="mini__f" [style.width.%]="b.value" [style.animation-delay.ms]="i * 90"></i></span>
                              <span class="mini__v">{{ b.text }}</span>
                            </div>
                          }
                          <div class="mini total">
                            <span class="mini__l">Confidence</span>
                            <span class="mini__t conf">
                              <i class="mini__f" [style.width.%]="shownConf(o, c)"></i>
                              <b class="mark" [style.left.%]="reviewAt"></b>
                              <b class="mark" [style.left.%]="matchAt"></b>
                            </span>
                            <span class="mini__v"><strong>{{ shownConf(o, c) | number: '1.0-1' }}</strong></span>
                          </div>
                        </div>
                      }
                    </div>
                    @if (hiddenCount() > 0) { <p class="hint small">+ {{ hiddenCount() }} more lower-scoring candidate(s) not shown.</p> }
                    <p class="hint small">Bars: make = plain ratio, model = token_set_ratio, variant = token_sort_ratio. Ticks mark the review ({{ reviewAt }}) and match ({{ matchAt }}) thresholds.</p>
                  } @else {
                    <p class="hint">Nothing survived the gates, so nothing is scored.</p>
                  }
                </li>
              }

              <!-- 5 Decision -->
              @if (revealed() >= 5) {
                <li class="stage stage--final">
                  <h3 class="stage__h"><span class="num">5</span> Decision</h3>
                  <div class="row">
                    @if (o.bypassedWrong) { <span class="pill bad pop">Wrong match (gates off)</span> }
                    @else if (o.decision === 'match') { <span class="pill ok pop">&#10003; Matched</span> }
                    @else if (o.decision === 'review') { <span class="pill warn pop">Needs review</span> }
                    @else { <span class="pill bad pop">&#10007; No match</span> }
                    @if (o.winner) {
                      <span class="mono">&rarr; {{ o.winner.m.row.id }} &middot; {{ o.winner.m.row.make }} {{ o.winner.m.row.model }} {{ o.winner.m.row.variant }} &middot; {{ o.winner.m.row.fuel }} &middot; {{ o.winner.m.row.gvw }} kg</span>
                    }
                  </div>
                  <p class="hint">{{ o.reason }}</p>
                </li>
              }
            </ol>
          } @else {
            <p class="hint">Pick a row (or type your own) and press <strong>Match</strong> to watch the pipeline run, or match the whole partner file at once.</p>
          }

          @if (fileRows(); as fr) {
            <div class="file">
              <h3 class="stage__h">Whole partner file &middot; {{ partnerInfo().label }}</h3>
              <div class="bar" role="img" [attr.aria-label]="'Progress ' + fileShown() + ' of ' + fr.length">
                <i class="bar__fill" [style.width.%]="(fileShown() / fr.length) * 100"></i>
              </div>
              <div class="kvs">
                <div class="kv"><strong>{{ fileSummary().match }}</strong><span>Matched</span></div>
                <div class="kv"><strong>{{ fileSummary().review }}</strong><span>Needs review</span></div>
                <div class="kv"><strong>{{ fileSummary().none }}</strong><span>No match</span></div>
                <div class="kv"><strong>{{ fileSummary().avoidedPct }}%</strong><span>comparisons avoided by grouping ({{ fileSummary().avoided }} of {{ fileSummary().naive }})</span></div>
              </div>
              <div class="tbl">
                <table>
                  <thead><tr><th>#</th><th>Partner row</th><th>Decision</th><th>Master row</th><th>Score</th><th>Why</th><th></th></tr></thead>
                  <tbody>
                    @for (f of fileShownRows(); track f.i) {
                      <tr class="cand">
                        <td>{{ f.i + 1 }}</td>
                        <td>{{ rowText(f.raw) }}</td>
                        <td>
                          @if (f.out.decision === 'match') { <span class="pill ok">&#10003; Matched</span> }
                          @else if (f.out.decision === 'review') { <span class="pill warn">Review</span> }
                          @else { <span class="pill bad">&#10007; No match</span> }
                        </td>
                        <td>{{ f.out.winner ? f.out.winner.m.row.id : '-' }}</td>
                        <td>{{ f.out.winner ? (f.out.winner.confidence | number: '1.0-0') : '-' }}</td>
                        <td class="why-c">{{ shortReason(f.out) }}</td>
                        <td><button type="button" class="dbtn dbtn--sm" (click)="inspect(f.i)">Inspect</button></td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
          }
        </div>
      </div>

      <p class="demo__note">
        Synthetic data only: a 14-row master and tiny made-up partner files. Simplified versus the real engine: it also compares wheel counts, runs several passes
        from strict to loose over hundreds of thousands of rows, and blends token_set, partial and plain ratio for model text (here token_set only). The make, fuel,
        GVW and weight thresholds are the real ones; partner normalisers here are a handful of rules, not the full config. Unknown vehicle type hands its weight to model text.
      </p>
    </section>
  `,
  styles: [
    DEMO_STYLES,
    `
      .mono { font-family: var(--font-mono); font-size: 0.8rem; }
      .small { font-size: 0.78rem; color: var(--text-3); }
      .master summary { cursor: pointer; font-weight: 600; font-size: 0.9rem; padding: 6px 0; min-height: 32px; }
      .master summary:focus-visible { outline: 2px solid var(--accent-text); outline-offset: 2px; }
      .master .tbl { margin-top: 8px; max-height: 280px; overflow-y: auto; }
      tr.in-group td { background: color-mix(in srgb, var(--lime) 12%, transparent); }
      .plist { max-height: 260px; overflow-y: auto; }
      tr.sel td { background: color-mix(in srgb, var(--lime) 12%, transparent); }
      .pick { min-width: 44px; min-height: 44px; padding: 0 10px; border-radius: var(--r-sm); }
      .form { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); }
      .chk { display: flex; gap: 10px; align-items: center; min-height: 44px; font-size: 0.88rem; color: var(--text-2); cursor: pointer; }
      .chk input { width: 20px; height: 20px; accent-color: var(--lime); flex: none; }
      .why { padding: 14px; border: 1px dashed var(--line-2); border-radius: var(--r-md); display: grid; gap: 8px; justify-items: start; background: var(--bg-2); }

      .result { min-height: 40px; display: grid; gap: 18px; }
      .stages { list-style: none; margin: 0; padding: 0; display: grid; gap: 14px; }
      .stage { border: 1px solid var(--line); border-radius: var(--r-md); padding: 14px; background: var(--bg-2); display: grid; gap: 10px; animation: md-in .45s var(--ease-out) both; min-width: 0; }
      .stage--final { border-color: var(--accent-line); }
      .stage__h { margin: 0; font-size: 0.92rem; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
      .num { display: inline-grid; place-items: center; width: 24px; height: 24px; border-radius: 50%; background: var(--accent-soft); color: var(--accent-text); font-family: var(--font-mono); font-size: 0.74rem; }
      @keyframes md-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }

      .bar { height: 10px; border-radius: 99px; background: var(--surface-2); border: 1px solid var(--line); overflow: hidden; }
      .bar__fill { display: block; height: 100%; background: var(--lime); border-radius: 99px; transform-origin: left; animation: md-grow .8s var(--ease-out) both; }
      @keyframes md-grow { from { transform: scaleX(0); } to { transform: scaleX(1); } }
      .dots { display: flex; flex-wrap: wrap; gap: 6px; }
      .dot { width: 18px; height: 18px; border-radius: 4px; background: var(--surface-2); border: 1px solid var(--line); opacity: 0.45; animation: md-dot .5s var(--ease-out) both; }
      .dot.on { background: var(--lime); border-color: transparent; opacity: 1; }
      @keyframes md-dot { from { transform: scale(0.4); opacity: 0; } }

      .cand { animation: md-in .4s var(--ease-out) both; }
      tr.rej td { opacity: 0.6; }
      tr.rej { animation: md-in .4s var(--ease-out) both, md-shake .5s .4s ease-in-out 1; }
      tr.rej td:first-child { text-decoration: line-through; text-decoration-color: var(--coral); }
      @keyframes md-shake { 0%,100% { transform: translateX(0); } 20% { transform: translateX(-5px); } 40% { transform: translateX(5px); } 60% { transform: translateX(-3px); } 80% { transform: translateX(3px); } }
      .g { font-size: 0.76rem; color: var(--text-3); }

      .scored { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); }
      .sc { border: 1px solid var(--line); border-radius: var(--r-sm); padding: 12px; background: var(--surface); display: grid; gap: 6px; min-width: 0; }
      .sc.best { border-color: var(--accent-line); }
      .sc__head { font-size: 0.82rem; display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
      .mini { display: grid; grid-template-columns: 72px minmax(0, 1fr) 46px; gap: 8px; align-items: center; font-size: 0.74rem; }
      .mini__l { color: var(--text-3); font-family: var(--font-mono); }
      .mini__t { position: relative; height: 8px; border-radius: 99px; background: var(--surface-2); border: 1px solid var(--line); overflow: hidden; }
      .mini__f { display: block; height: 100%; background: var(--sky); transform-origin: left; animation: md-grow .8s var(--ease-out) both; border-radius: 99px; }
      .mini.total .mini__f { background: var(--lime); }
      .mini__v { text-align: right; font-variant-numeric: tabular-nums; color: var(--text-2); }
      .conf .mark { position: absolute; top: -1px; bottom: -1px; width: 2px; background: var(--text-3); opacity: 0.8; }

      .pop { animation: md-pop .5s var(--ease-out) both; }
      @keyframes md-pop { from { transform: scale(0.6); opacity: 0; } }

      .file { display: grid; gap: 12px; }
      .why-c { white-space: normal !important; min-width: 220px; font-size: 0.78rem; color: var(--text-2); }
      .tbl td { vertical-align: top; }
      .tbl .cand td.mono { white-space: normal; }
    `,
  ],
})
export class MatchingDemoComponent {
  private readonly device = inject(DeviceService);
  private readonly destroyRef = inject(DestroyRef);
  private timers: Array<ReturnType<typeof setTimeout>> = [];
  private ticker: ReturnType<typeof setInterval> | null = null;

  readonly masterRows = MASTER;
  readonly matchAt = MATCH_AT;
  readonly reviewAt = REVIEW_AT;
  readonly weightLabel = [WEIGHTS.model, WEIGHTS.variant, WEIGHTS.number, WEIGHTS.gvw, WEIGHTS.type].join('/');

  readonly partner = signal<PartnerId>('A');
  readonly mode = signal<'pick' | 'custom'>('pick');
  readonly selected = signal(0);
  readonly cMake = signal('');
  readonly cModel = signal('');
  readonly cVariant = signal('');
  readonly cFuel = signal('');
  readonly cGvw = signal('');
  readonly cType = signal('');
  readonly gatesOff = signal(false);

  readonly outcome = signal<Outcome | null>(null);
  readonly revealed = signal(0);
  readonly fileRows = signal<FileRow[] | null>(null);
  readonly fileShown = signal(0);

  readonly partnerInfo = computed(() => PARTNERS[this.partner()]);
  readonly partnerRows = computed(() => PARTNER_ROWS[this.partner()]);
  readonly canMatch = computed(() => (this.mode() === 'pick' ? true : this.cMake().trim().length > 0 && (this.cModel().trim().length > 0 || this.cVariant().trim().length > 0)));

  readonly prunedPct = computed(() => {
    const o = this.outcome();
    return o ? Math.round((1 - o.groupSize / o.total) * 100) : 0;
  });

  readonly normRows = computed(() => {
    const o = this.outcome();
    if (!o) return [];
    const n = o.norm;
    const raw = o.raw;
    const fuelNote = n.fuel === null ? 'unreadable: gate skipped' : /^\d$/.test(raw.fuel.trim()) ? 'numeric code decoded' : raw.fuel.trim().length === 1 ? 'letter code decoded' : '';
    const slab = n.gvw === null ? '' : slabOf(n.gvw).name;
    return [
      { field: 'Make', before: raw.make || '(blank)', after: n.makeKey || '(blank)', note: '' },
      { field: 'Model', before: raw.model || '(blank)', after: n.modelMoved ? cleanText(raw.variant) : n.model || '(blank)', note: n.modelMoved ? 'taken from variant column' : '' },
      { field: 'Variant', before: raw.variant || '(blank)', after: n.hasVariant ? n.variant : '(none: concat mode)', note: '' },
      { field: 'Fuel', before: raw.fuel || '(blank)', after: n.fuel ?? '(unknown)', note: fuelNote },
      { field: 'GVW', before: raw.gvw || '(blank)', after: n.gvw === null ? '(unknown)' : n.gvw + ' kg', note: slab ? 'slab ' + slab : '' },
      { field: 'Type', before: raw.type || '(not given)', after: n.type ?? '(unknown)', note: n.typeFrom === 'text' ? 'inferred from text' : '' },
    ];
  });

  readonly scored = computed(() => {
    const o = this.outcome();
    if (!o) return [];
    const pool = o.gatesEnforced ? o.survivors : [...o.candidates].sort((a, b) => b.raw - a.raw);
    return pool.slice(0, 3);
  });
  readonly hiddenCount = computed(() => {
    const o = this.outcome();
    if (!o) return 0;
    const n = o.gatesEnforced ? o.survivors.length : o.candidates.length;
    return Math.max(0, n - 3);
  });

  readonly fileShownRows = computed(() => (this.fileRows() ?? []).slice(0, this.fileShown()));
  readonly fileSummary = computed(() => {
    const shown = this.fileShownRows();
    let match = 0;
    let review = 0;
    let none = 0;
    let avoided = 0;
    let naive = 0;
    for (const f of shown) {
      if (f.out.decision === 'match') match++;
      else if (f.out.decision === 'review') review++;
      else none++;
      avoided += f.out.total - f.out.groupSize;
      naive += f.out.total;
    }
    return { match, review, none, avoided, naive, avoidedPct: naive ? Math.round((avoided / naive) * 100) : 0 };
  });

  constructor() {
    this.destroyRef.onDestroy(() => this.stopAll());
  }

  gateIcon(state: 'pass' | 'fail' | 'skip'): string {
    return state === 'pass' ? '✓' : state === 'fail' ? '✗' : '–';
  }

  bars(c: Candidate): Array<{ label: string; value: number; text: string }> {
    return [
      { label: 'make', value: c.sMake, text: Math.round(c.sMake) + '' },
      { label: 'model', value: c.sModel, text: Math.round(c.sModel) + '' },
      c.sVariant === null
        ? { label: 'variant', value: 0, text: 'n/a' }
        : { label: 'variant', value: c.sVariant, text: Math.round(c.sVariant) + '' },
      { label: 'number', value: c.sNumber * 100, text: Math.round(c.sNumber * 100) + '' },
      { label: 'GVW', value: c.sGvw * 100, text: Math.round(c.sGvw * 100) + '' },
      c.sType < 0 ? { label: 'type', value: 0, text: 'skip' } : { label: 'type', value: c.sType, text: Math.round(c.sType) + '' },
    ];
  }

  rowText(x: RawRow): string {
    return [x.make, x.model, x.variant].filter(Boolean).join(' ') + ' | ' + x.fuel;
  }

  shownConf(o: Outcome, c: Candidate): number {
    return o.gatesEnforced ? c.confidence : c.raw;
  }

  shortReason(o: Outcome): string {
    if (o.decision === 'none' && !o.groupKey) return 'make not in catalogue';
    if (o.decision === 'none' && !o.winner) {
      const reasons = Array.from(new Set(o.candidates.flatMap((c) => c.failed)));
      return 'gate: ' + reasons.join(', ');
    }
    if (o.decision === 'none') return 'below review floor';
    if (o.decision === 'review') return 'partial text match';
    return 'gates passed, strong text';
  }

  setPartner(p: string): void {
    this.stopAll();
    this.partner.set(p as PartnerId);
    this.selected.set(0);
    this.outcome.set(null);
    this.revealed.set(0);
    this.fileRows.set(null);
    this.fileShown.set(0);
  }

  setMode(m: 'pick' | 'custom'): void {
    this.mode.set(m);
  }

  runMatch(): void {
    const raw: RawRow =
      this.mode() === 'pick'
        ? this.partnerRows()[this.selected()]
        : { make: this.cMake(), model: this.cModel(), variant: this.cVariant(), fuel: this.cFuel(), gvw: this.cGvw(), type: this.cType() };
    this.stopAll();
    this.outcome.set(matchRow(raw, this.partner(), !this.gatesOff()));
    this.revealStages();
  }

  tryExample(): void {
    this.setPartner('A');
    this.mode.set('custom');
    this.cMake.set('TATA MOTORS LTD');
    this.cModel.set('ACE GOLD');
    this.cVariant.set('DELUXE');
    this.cFuel.set('CNG');
    this.cGvw.set('1610');
    this.cType.set('');
    this.gatesOff.set(false);
    this.runMatch();
  }

  inspect(i: number): void {
    this.mode.set('pick');
    this.selected.set(i);
    this.runMatch();
  }

  runFile(): void {
    this.stopAll();
    const p = this.partner();
    const rows: FileRow[] = PARTNER_ROWS[p].map((raw, i) => ({ i, raw, out: matchRow(raw, p, true) }));
    this.fileRows.set(rows);
    if (this.device.reducedMotion) {
      this.fileShown.set(rows.length);
      return;
    }
    this.fileShown.set(0);
    this.ticker = setInterval(() => {
      const next = this.fileShown() + 1;
      this.fileShown.set(next);
      if (next >= rows.length) this.stopAll();
    }, 160);
  }

  private revealStages(): void {
    if (this.device.reducedMotion) {
      this.revealed.set(5);
      return;
    }
    this.revealed.set(1);
    for (let n = 2; n <= 5; n++) {
      this.timers.push(setTimeout(() => this.revealed.set(n), (n - 1) * 900));
    }
  }

  private stopAll(): void {
    this.timers.forEach((t) => clearTimeout(t));
    this.timers = [];
    if (this.ticker !== null) {
      clearInterval(this.ticker);
      this.ticker = null;
    }
  }
}
