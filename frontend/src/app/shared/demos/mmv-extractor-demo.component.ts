import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, ViewChild, computed, inject, signal } from '@angular/core';
import { DeviceService } from '../../services/device.service';
import { DEMO_STYLES } from './demo-styles';

/* ================================================================== *
 *  1. Synthetic "site": a plain data structure + a fake answer function
 *     that speaks the same three master-data calls the real tool uses.
 * ================================================================== */

type VSpec = [label: string, gvw: number | null];
interface SiteVariant { id: number; label: string; gvw: number | null }
/** 'empty-once' = the site hiccups once (empty answer, then the real one). 'malformable' = target of the malformed toggle. */
interface SiteModel { id: number; name: string; variants: SiteVariant[]; flag?: 'empty-once' | 'malformable' }
interface SiteMake { id: number; name: string; models: SiteModel[] }
interface SiteType { id: number; name: string; makes: SiteMake[] }

const MAKE_IDS: Record<string, number> = { TATA: 727, 'ASHOK LEYLAND': 731, MAHINDRA: 739, EICHER: 744, MARUTI: 756 };

function buildSite(): SiteType[] {
  let md = 5000;
  let vr = 90000;
  const model = (name: string, vs: VSpec[], flag?: SiteModel['flag']): SiteModel => ({
    id: ++md,
    name,
    flag,
    variants: vs.map(([label, gvw]) => ({ id: ++vr, label, gvw })),
  });
  const make = (name: string, models: SiteModel[]): SiteMake => ({ id: MAKE_IDS[name], name, models });
  return [
    {
      id: 1,
      name: 'Truck',
      makes: [
        make('TATA', [
          model('LPT 1109', [['1109 GVW - DIESEL', 1109], ['1109 GVW - CNG', 1109]]),
          model('LPT 1412', [['LPT 1412 - CNG', null], ['LPT 1412 BSVI - DIESEL', null]]),
          model('407 GOLD SFC', [['1945 GVW - DIESEL', 1954], ['2,350 GVW - DIESEL', 2350]]),
          model('SIGNA 4825.TK', [['SIGNA 4825.TK - DIESEL', null], ['SIGNA 4825.TK BSVI - DIESEL', null]], 'empty-once'),
        ]),
        make('ASHOK LEYLAND', [
          model('2518', [['2518 T - DIESEL', null], ['2518 BSIV - DIESEL', null]]),
          model('PARTNER', [['PARTNER 6T - BIOFUEL', null], ['PARTNER 6T - DIESEL', null]]),
        ]),
        make('EICHER', [
          model('PRO 2049', [['PRO 2049 XP - DIESEL', 4995], ['PRO 2049 - CNG', 4995]]),
          model('PRO 3015', []),
        ]),
        make('MAHINDRA', [model('BLAZO X', [['BLAZO X 35 - DIESEL', null]])]),
      ],
    },
    {
      id: 3,
      name: 'Tipper',
      makes: [
        make('TATA', [
          model('LPK 2518', [['LPK 2518 - DIESEL', null], ['LPK 2518 BSVI - DIESEL', null]]),
          model('SIGNA 2823.K', [['SIGNA 2823.K - DIESEL', null], ['2823 GVW - DIESEL', 2823]], 'malformable'),
        ]),
        make('EICHER', [model('PRO 6025T', [['PRO 6025T TIPPER - DIESEL', null]])]),
        make('ASHOK LEYLAND', [model('2820 TIPPER', [['2820 TIPPER - DIESEL', null], ['2820 TIPPER - LNG', null]])]),
      ],
    },
    {
      id: 10,
      name: 'Pickup & Delivery Van',
      makes: [
        make('TATA', [
          model('ACE', [
            ['ACE EX BSIII - DIESEL', null],
            ['ACE GOLD CX BSVI - PETROL', null],
            ['ACE GOLD - CNG', null],
            ['ACE MEGA XL - DIESEL', null],
          ]),
          model('INTRA V30', [['INTRA V30 - DIESEL', null]]),
        ]),
        make('MAHINDRA', [
          model('JEETO', [['JEETO PLUS - CNG', null], ['JEETO MINIVAN - DIESEL', null]]),
          model('SUPRO', [['SUPRO PROFIT TRUCK - CNG', null]]),
        ]),
        make('MARUTI', [model('SUPER CARRY', [['SUPER CARRY - CNG', null], ['SUPER CARRY HARD TOP - PETROL', null]])]),
        make('ASHOK LEYLAND', [model('DOST', [['DOST LS - DIESEL', null], ['DOST+ - DIESEL', null]])]),
      ],
    },
  ];
}

const SITE: SiteType[] = buildSite();
const SITE_MODELS = new Map<number, SiteModel>();
for (const t of SITE) for (const mk of t.makes) for (const md of mk.models) SITE_MODELS.set(md.id, md);

const SITE_STATS = (() => {
  let makes = 0;
  let models = 0;
  let variants = 0;
  for (const t of SITE) {
    makes += t.makes.length;
    for (const mk of t.makes) {
      models += mk.models.length;
      for (const md of mk.models) variants += md.variants.length;
    }
  }
  return { types: SITE.length, makes, models, variants, scopes: SITE.length + makes + models };
})();

type Endpoint = 'get-makes' | 'get-models' | 'get-variant';
interface Payload { SubClassId: number; MakeId?: number; ModelId?: number }
interface SiteCtx { malformed: boolean; drop: boolean; arm429: boolean }
interface SiteReply { status: number; body: unknown }

/** The fake "site". Pure apart from the ctx flags the visitor flips. Throws like a failed fetch when the network is dropped. */
function siteAnswer(ep: Endpoint, p: Payload, ctx: SiteCtx, emptyOnce: Set<number>): SiteReply {
  if (ctx.drop) throw new Error('page unreachable (network dropped)');
  if (ctx.arm429) {
    ctx.arm429 = false;
    return { status: 429, body: null };
  }
  const type = SITE.find((t) => t.id === p.SubClassId);
  if (ep === 'get-makes') {
    return { status: 200, body: { makes: (type?.makes ?? []).map((m) => ({ Id: m.id, Name: m.name })) } };
  }
  if (ep === 'get-models') {
    const mk = type?.makes.find((m) => m.id === p.MakeId);
    return { status: 200, body: { data: (mk?.models ?? []).map((d) => ({ ModelId: d.id, ModelName: d.name })) } };
  }
  const md = SITE_MODELS.get(p.ModelId ?? -1);
  if (!md) return { status: 200, body: { status: 'success', variant: [] } };
  if (md.flag === 'empty-once' && !emptyOnce.has(md.id)) {
    emptyOnce.add(md.id);
    return { status: 200, body: { status: 'success', variant: [] } };
  }
  const rows = md.variants.map((v) => ({ VehicleId: v.id, VariantName: v.label }));
  if (md.flag === 'malformable' && ctx.malformed) {
    // a renamed key: the answer arrives, but it is not the documented shape
    return { status: 200, body: { status: 'success', variants: rows } };
  }
  const gvw: Record<string, number> = {};
  for (const v of md.variants) if (v.gvw !== null) gvw[String(v.id)] = v.gvw;
  return { status: 200, body: { status: 'success', variant: rows, gvw } };
}

/* ================================================================== *
 *  2. Pure parsing + label rules (ports of api/client.py and utils/labels.py)
 * ================================================================== */

class ApiError extends Error {}
class ApiShapeError extends ApiError {}
class BlockedError extends Error {}
class StopRequested extends Error {}

const KNOWN_FUELS = new Set([
  'DIESEL', 'PETROL', 'CNG', 'LPG', 'LNG', 'ELECTRIC', 'BATTERY', 'EV', 'HYBRID', 'HYDROGEN', 'PETROL+CNG', 'PETROL+LPG', 'DIESEL+CNG',
]);
const BLOCK_STATUSES = new Set([403, 429, 503]);
const GVW_IN_LABEL = /^\s*(\d[\d,]*)\s*GVW\b/i;

export const cleanText = (s: string): string => s.replace(/\s+/g, ' ').trim();

/** 'ACE EX BSIII - DIESEL' -> ['ACE EX BSIII','DIESEL']. Only a recognised fuel is split off. */
export function splitLabel(label: string): [string, string] {
  const s = cleanText(label);
  const i = s.lastIndexOf(' - ');
  if (i >= 0) {
    const left = s.slice(0, i).trim();
    const right = s.slice(i + 3).trim();
    if (left && KNOWN_FUELS.has(right.toUpperCase().replace(/ /g, ''))) return [left, right];
  }
  return [s, ''];
}

/** Text after the last ' - ' when it is NOT a known fuel (so a new fuel type can be spotted), else ''. */
export function unknownTail(label: string): string {
  const s = cleanText(label);
  const i = s.lastIndexOf(' - ');
  if (i >= 0) {
    const right = s.slice(i + 3).trim();
    if (right && !KNOWN_FUELS.has(right.toUpperCase().replace(/ /g, ''))) return right;
  }
  return '';
}

/** '1945 GVW - DIESEL' -> 1945 (only used to cross-check the API's own gvw value). */
export function gvwInLabel(label: string): number | null {
  const m = GVW_IN_LABEL.exec(cleanText(label));
  return m ? parseInt(m[1].replace(/,/g, ''), 10) : null;
}

interface Item { id: number; name: string }
interface Note { kind: string; detail: string }
interface Parsed<T> { items: T[]; notes: Note[] }
interface VarItem { vid: number; label: string; name: string; fuel: string; gvw: number | null; warn: boolean }
interface RawVariant { vid: number; label: string; gvw: number | null }

function asInt(v: unknown, what: string): number {
  if (typeof v === 'boolean') throw new ApiShapeError(`${what} is a boolean: ${String(v)}`);
  const f = Number(String(v).trim());
  if (!Number.isFinite(f) || String(v).trim() === '') throw new ApiShapeError(`${what} is not a number: ${JSON.stringify(v)}`);
  if (!Number.isInteger(f)) throw new ApiShapeError(`${what} is not a whole number: ${JSON.stringify(v)}`);
  return f;
}

/** A missing key is an error, never an empty list: a changed answer can't be mistaken for "no data". */
function listOf(js: unknown, key: string, what: string): unknown[] {
  if (typeof js !== 'object' || js === null || !(key in js)) {
    const keys = typeof js === 'object' && js !== null ? Object.keys(js).slice(0, 6).join(', ') : typeof js;
    throw new ApiShapeError(`${what}: key '${key}' missing in response (keys: ${keys})`);
  }
  const v = (js as Record<string, unknown>)[key];
  if (v === null || v === undefined) return [];
  if (!Array.isArray(v)) throw new ApiShapeError(`${what}: '${key}' is not a list`);
  return v;
}

function parseIdName(js: unknown, listKey: string, idKey: string, nameKey: string, what: string, dupKind: string): Parsed<Item> {
  const items: Item[] = [];
  const notes: Note[] = [];
  const seen = new Set<number>();
  listOf(js, listKey, what).forEach((raw, i) => {
    const it = raw as Record<string, unknown> | null;
    if (typeof it !== 'object' || it === null || !(idKey in it) || !(nameKey in it)) {
      throw new ApiShapeError(`${what}: item ${i} lacks ${idKey}/${nameKey}`);
    }
    const id = asInt(it[idKey], idKey);
    const name = cleanText(String(it[nameKey] ?? ''));
    if (seen.has(id)) {
      notes.push({ kind: dupKind, detail: `id ${id} (${name}) listed more than once; first kept` });
      return;
    }
    seen.add(id);
    items.push({ id, name });
  });
  return { items, notes };
}

function parseVariants(js: unknown): Parsed<RawVariant> {
  const rows = listOf(js, 'variant', 'get-variant');
  const gvwMap = ((js as Record<string, unknown>)['gvw'] ?? {}) as Record<string, unknown>;
  const items: RawVariant[] = [];
  const notes: Note[] = [];
  const seen = new Set<number>();
  rows.forEach((raw, i) => {
    const it = raw as Record<string, unknown> | null;
    if (typeof it !== 'object' || it === null || !('VehicleId' in it) || !('VariantName' in it)) {
      throw new ApiShapeError(`get-variant: item ${i} lacks VehicleId/VariantName`);
    }
    const vid = asInt(it['VehicleId'], 'VehicleId');
    const label = cleanText(String(it['VariantName'] ?? ''));
    if (seen.has(vid)) {
      notes.push({ kind: 'DUPLICATE_VARIANT_ID', detail: `VehicleId ${vid} (${label}) listed more than once; first kept` });
      return;
    }
    seen.add(vid);
    const g = gvwMap[String(vid)];
    items.push({ vid, label, gvw: typeof g === 'number' ? g : null });
  });
  return { items, notes };
}

/* ================================================================== *
 *  3. The extraction engine: a generator that mirrors the Python loop.
 *     Every `yield {wait}` is "a pause the UI must show"; the component's
 *     driver turns it into a timer. Stop is checked between calls, like STOP.is_set().
 * ================================================================== */

type NodeState = 'pending' | 'fetching' | 'open' | 'done' | 'failed' | 'empty';
type Tone = 'ok' | 'warn' | 'bad' | 'info' | 'mute';
type Gen<T> = Generator<{ wait: number }, T, void>;
type ScopeStatus = 'running' | 'done' | 'failed';

interface TickerEntry { n: number; endpoint: string; payload: string; status: string; tone: Tone }
interface LogLine { n: number; text: string; tone: Tone }
interface Anomaly { kind: string; detail: string }
interface MasterRow { key: string; srno: number; type: string; make: string; model: string; variant: string; gvw: string; fuel: string }
interface EndInfo { reason: 'complete' | 'stopped' | 'blocked'; detail: string }

interface TreeVariant { key: string; label: string; warn: boolean }
interface TreeModel { key: string; id: number; name: string; variants: TreeVariant[] }
interface TreeMake { key: string; id: number; name: string; models: TreeModel[] }
interface TreeType { key: string; id: number; name: string; makes: TreeMake[] }

interface Snap {
  tree: TreeType[];
  states: Record<string, NodeState>;
  cursorKey: string | null;
  path: string[];
  ticker: TickerEntry[];
  log: LogLine[];
  rowsTail: MasterRow[];
  rowCount: number;
  anomalies: Anomaly[];
  typesDone: number;
  makes: number;
  models: number;
  variants: number;
  calls: number;
  savedCalls: number;
  autosaves: number;
  lastSaveRows: number;
  scopesDone: number;
  scopesFailed: number;
  scopesTotal: number;
  progress: number;
  resumeDone: number;
  resumeFailed: number;
  hasResume: boolean;
  endDetail: string;
  arm429: boolean;
}

// Demo-scale pacing (ms). The real tool: 0.35-0.9 s per call, 4-10 s extra every 150 calls, 4 s empty recheck, 3 s x attempt backoff, autosave 45 s.
const DELAY_MIN = 300;
const DELAY_MAX = 600;
const LONG_PAUSE_EVERY = 12;
const LONG_PAUSE_MIN = 900;
const LONG_PAUSE_MAX = 1500;
const EMPTY_RECHECK_MS = 800;
const RETRY_DELAY_MS = 700;
const ROW_REVEAL_MS = 55;
const SKIP_MS = 65;
const AUTOSAVE_EVERY_CALLS = 8;
const MAX_RETRIES = 3;
const MAX_CONSECUTIVE_FAILS = 8;

function payloadText(p: Payload): string {
  const parts = [`SubClassId:${p.SubClassId}`];
  if (p.MakeId !== undefined) parts.push(`MakeId:${p.MakeId}`);
  if (p.ModelId !== undefined) parts.push(`ModelId:${p.ModelId}`);
  return `{${parts.join(', ')}}`;
}

export class ExtractorEngine {
  readonly ctx: SiteCtx = { malformed: false, drop: false, arm429: false };
  slow = 1;
  stopFlag = false;

  private readonly emptyOnce = new Set<number>();
  private readonly progress = new Map<string, { status: ScopeStatus; error: string }>();
  private readonly makes = new Map<number, Item[]>();
  private readonly models = new Map<string, Item[]>();
  private readonly variants = new Map<string, VarItem[]>();
  private readonly nodes = new Map<string, NodeState>();
  private readonly anomalyKeys = new Set<string>();
  private anomalies: Anomaly[] = [];
  private ticker: TickerEntry[] = [];
  private logs: LogLine[] = [];
  private tickN = 0;
  private calls = 0;
  private savedCalls = 0;
  private autosaves = 0;
  private lastSavedRows = -1;
  private fails = 0;
  private cursorKey: string | null = null;
  private path: string[] = ['', '', ''];
  private resumeDone = 0;
  private resumeFailed = 0;
  private hasResume = false;
  private endDetail = '';

  /* ---------- run control ---------- */
  beginRun(): void {
    this.stopFlag = false;
    this.fails = 0;
    this.endDetail = '';
    let d = 0;
    let f = 0;
    this.progress.forEach((v) => {
      if (v.status === 'done') d++;
      else if (v.status === 'failed') f++;
    });
    this.hasResume = d > 0 || f > 0;
    this.resumeDone = d;
    this.resumeFailed = f;
    this.log(
      this.hasResume
        ? `Resuming from the progress table: ${d} done scope(s) will be skipped, ${f} failed scope(s) retried`
        : 'Fresh run: progress table is empty',
      'info',
    );
  }

  *run(): Gen<EndInfo> {
    try {
      for (const t of SITE) {
        this.path = [t.name, '', ''];
        try {
          yield* this.doType(t);
        } catch (e) {
          if (this.fatal(e)) throw e;
          this.fail(`makes:${t.id}`, e, `t:${t.id}`);
        }
      }
      this.cursorKey = null;
      this.path = ['', '', ''];
      this.autosave('exit');
      const failed = this.countStatus('failed');
      this.log(
        failed ? `Run finished with ${failed} failed scope(s): they stay marked failed and are retried next run` : 'Run finished: every scope is done',
        failed ? 'warn' : 'ok',
      );
      return { reason: 'complete', detail: '' };
    } catch (e) {
      if (e instanceof StopRequested) {
        return this.halt('stopped', 'Stopped on request. The in-flight call was abandoned and its scope stays marked running, so a resume asks it again.');
      }
      if (e instanceof BlockedError) {
        this.ctx.arm429 = false; // the demo site "recovers" so Resume can continue
        return this.halt('blocked', e.message);
      }
      throw e;
    }
  }

  private halt(reason: 'stopped' | 'blocked', detail: string): EndInfo {
    this.nodes.forEach((v, k) => {
      if (v === 'fetching') this.nodes.set(k, 'pending');
    });
    this.fails = 0;
    this.endDetail = detail;
    this.log(`Clean stop: ${detail}`, 'warn');
    this.autosave('exit');
    return { reason, detail };
  }

  /* ---------- the loop: type -> make -> model -> variants ---------- */
  private *doType(t: SiteType): Gen<void> {
    const tkey = `t:${t.id}`;
    const scope = `makes:${t.id}`;
    this.cursor(tkey);
    if (!this.isDone(scope)) {
      this.begin(scope);
      this.nodes.set(tkey, 'fetching');
      const r = yield* this.fetchItems(() => this.apiMakes(t.id), `makes of ${t.name}`);
      this.noteAll(r.notes);
      this.makes.set(t.id, r.items);
      this.finish(scope);
      if (!r.items.length) {
        this.anomaly('TYPE_WITHOUT_MAKES', `${t.name}: the site lists no makes (asked twice)`);
        this.nodes.set(tkey, 'empty');
      } else {
        this.nodes.set(tkey, 'open');
      }
      this.log(`[${t.name}] ${r.items.length} makes`, 'info');
    } else {
      yield* this.skip(scope);
      this.nodes.set(tkey, 'open');
    }
    let allOk = true;
    const list = this.makes.get(t.id) ?? [];
    for (const mk of list) {
      try {
        const ok = yield* this.doMake(t, mk);
        allOk = allOk && ok;
      } catch (e) {
        if (this.fatal(e)) throw e;
        allOk = false;
        this.fail(`models:${t.id}|${mk.id}`, e, `m:${t.id}|${mk.id}`);
      }
    }
    this.nodes.set(tkey, !list.length ? 'empty' : allOk ? 'done' : 'failed');
  }

  private *doMake(t: SiteType, mk: Item): Gen<boolean> {
    const mkey = `m:${t.id}|${mk.id}`;
    const store = `${t.id}|${mk.id}`;
    const scope = `models:${store}`;
    this.path = [t.name, mk.name, ''];
    this.cursor(mkey);
    if (!this.isDone(scope)) {
      this.begin(scope);
      this.nodes.set(mkey, 'fetching');
      const r = yield* this.fetchItems(() => this.apiModels(t.id, mk.id), `models of ${mk.name}`);
      this.noteAll(r.notes);
      this.models.set(store, r.items);
      this.finish(scope);
      if (!r.items.length) this.anomaly('MAKE_WITHOUT_MODELS', `${t.name} / ${mk.name}: the site lists no models (asked twice)`);
      this.nodes.set(mkey, 'open');
      this.log(`[${t.name}/${mk.name}] ${r.items.length} models`, 'info');
    } else {
      yield* this.skip(scope);
      this.nodes.set(mkey, 'open');
    }
    let ok = true;
    const list = this.models.get(store) ?? [];
    for (const md of list) {
      try {
        yield* this.doModel(t, mk, md);
      } catch (e) {
        if (this.fatal(e)) throw e;
        ok = false;
        this.fail(`variants:${store}|${md.id}`, e, `d:${store}|${md.id}`);
      }
    }
    this.nodes.set(mkey, !list.length ? 'empty' : ok ? 'done' : 'failed');
    return ok;
  }

  /** One model, ALL its variants saved, before the next model is asked for. */
  private *doModel(t: SiteType, mk: Item, md: Item): Gen<void> {
    const store = `${t.id}|${mk.id}|${md.id}`;
    const dkey = `d:${store}`;
    const scope = `variants:${store}`;
    this.path = [t.name, mk.name, md.name];
    this.cursor(dkey);
    if (this.isDone(scope)) {
      yield* this.skip(scope);
      return;
    }
    this.begin(scope);
    this.nodes.set(dkey, 'fetching');
    const r = yield* this.fetchItems(() => this.apiVariants(t.id, md.id), `variants of ${md.name}`);
    this.noteAll(r.notes);

    const out: VarItem[] = [];
    for (const it of r.items) {
      const [name, fuel] = splitLabel(it.label);
      let warn = false;
      if (unknownTail(it.label)) {
        warn = true;
        this.anomaly('UNKNOWN_FUEL_SUFFIX', `'${it.label}': text after ' - ' is not a known fuel -> kept inside the variant name`);
      }
      const g = gvwInLabel(it.label);
      if (g !== null && it.gvw !== null && g !== it.gvw) {
        warn = true;
        this.anomaly('GVW_LABEL_MISMATCH', `'${it.label}' says ${g} but the gvw field says ${it.gvw}`);
      }
      out.push({ vid: it.vid, label: it.label, name, fuel, gvw: it.gvw, warn });
    }
    // "replace the model's children": start empty, then reveal row by row so the table streams.
    const saved: VarItem[] = [];
    this.variants.set(store, saved);
    for (const v of out) {
      saved.push(v);
      yield { wait: ROW_REVEAL_MS };
    }
    if (out.length) {
      this.nodes.set(dkey, 'done');
      this.log(`[${md.name}] ${out.length} variants saved`, 'ok');
    } else {
      this.anomaly('MODEL_WITHOUT_VARIANTS', `${t.name} / ${mk.name} / ${md.name}: no variants (asked twice) -> kept as make+model, variant blank`);
      this.nodes.set(dkey, 'empty');
      this.log(`[${md.name}] no variants even after the second ask: kept with a blank variant`, 'warn');
    }
    this.finish(scope);
  }

  /** Call with retries. An EMPTY answer is asked once more before it is believed. */
  private *fetchItems<T>(call: () => Gen<Parsed<T>>, label: string): Gen<Parsed<T>> {
    let r = yield* this.retry(call, label);
    if (!r.items.length) {
      this.log(`${label}: EMPTY answer, asking again after a pause before believing it (real tool: 4 s)`, 'warn');
      yield { wait: EMPTY_RECHECK_MS };
      this.checkStop();
      r = yield* this.retry(call, `${label} (recheck of empty answer)`);
      if (r.items.length) this.log(`${label}: the second answer had data, so the first was just a hiccup`, 'ok');
    }
    return r;
  }

  private *retry<T>(call: () => Gen<T>, label: string): Gen<T> {
    let last: unknown = null;
    for (let i = 1; i <= MAX_RETRIES; i++) {
      this.checkStop();
      try {
        return yield* call();
      } catch (e) {
        if (this.fatal(e)) throw e;
        last = e;
        const msg = e instanceof Error ? e.message : String(e);
        this.log(`${label}: attempt ${i}/${MAX_RETRIES} failed: ${msg}`, 'warn');
        if (i < MAX_RETRIES) {
          yield { wait: RETRY_DELAY_MS * i };
          this.checkStop();
        }
      }
    }
    throw last;
  }

  private *skip(scope: string): Gen<void> {
    this.savedCalls++;
    this.log(`skip ${scope}: already done, no call made`, 'mute');
    yield { wait: SKIP_MS };
    this.checkStop();
  }

  /* ---------- the three typed calls ---------- */
  private *apiMakes(sid: number): Gen<Parsed<Item>> {
    const { js, entry } = yield* this.post('get-makes', { SubClassId: sid });
    return this.shaped(entry, () => parseIdName(js, 'makes', 'Id', 'Name', 'get-makes', 'DUPLICATE_MAKE_ID'));
  }

  private *apiModels(sid: number, mid: number): Gen<Parsed<Item>> {
    const { js, entry } = yield* this.post('get-models', { SubClassId: sid, MakeId: mid });
    return this.shaped(entry, () => parseIdName(js, 'data', 'ModelId', 'ModelName', 'get-models', 'DUPLICATE_MODEL_ID'));
  }

  private *apiVariants(sid: number, kid: number): Gen<Parsed<RawVariant>> {
    const { js, entry } = yield* this.post('get-variant', { SubClassId: sid, ModelId: kid });
    return this.shaped(entry, () => parseVariants(js));
  }

  private shaped<T>(entry: TickerEntry, parse: () => Parsed<T>): Parsed<T> {
    try {
      return parse();
    } catch (e) {
      entry.status = 'wrong shape';
      entry.tone = 'warn';
      throw e;
    }
  }

  /** transport + status handling + pacing, like the real client post() */
  private *post(ep: Endpoint, payload: Payload): Gen<{ js: unknown; entry: TickerEntry }> {
    this.checkStop();
    const entry: TickerEntry = { n: ++this.tickN, endpoint: ep, payload: payloadText(payload), status: 'sent', tone: 'info' };
    this.ticker.push(entry);
    if (this.ticker.length > 12) this.ticker.shift();

    let res: SiteReply;
    try {
      res = siteAnswer(ep, payload, this.ctx, this.emptyOnce);
    } catch (e) {
      yield { wait: 350 };
      this.checkStop();
      entry.status = 'network error';
      entry.tone = 'bad';
      throw this.failCall(`network/page error: ${e instanceof Error ? e.message : String(e)}`);
    }
    if (BLOCK_STATUSES.has(res.status)) {
      yield { wait: 300 };
      entry.status = `HTTP ${res.status}`;
      entry.tone = 'bad';
      throw new BlockedError(`The site answered HTTP ${res.status} to ${ep} (rate limit / block). Stopping; nothing is bypassed.`);
    }
    if (res.status !== 200) {
      entry.status = `HTTP ${res.status}`;
      entry.tone = 'bad';
      throw this.failCall(`HTTP ${res.status} from ${ep}`);
    }
    this.fails = 0;
    this.calls++;
    yield { wait: this.paceMs() };
    this.checkStop(); // a stop during the pacing wait abandons this answer, like _pace() raising StopRequested
    entry.status = '200 OK';
    entry.tone = 'ok';
    if (this.calls % AUTOSAVE_EVERY_CALLS === 0) this.autosave('timer');
    return { js: res.body, entry };
  }

  private paceMs(): number {
    let wait = DELAY_MIN + Math.random() * (DELAY_MAX - DELAY_MIN);
    if (this.calls % LONG_PAUSE_EVERY === 0) {
      wait += LONG_PAUSE_MIN + Math.random() * (LONG_PAUSE_MAX - LONG_PAUSE_MIN);
      this.log(`Long pause after ${this.calls} calls (real tool: 4-10 s extra every 150 calls)`, 'mute');
    }
    return Math.round(wait * this.slow);
  }

  /** transport-level failure: count it; 8 in a row trips the breaker */
  private failCall(msg: string): Error {
    this.fails++;
    if (this.fails >= MAX_CONSECUTIVE_FAILS) {
      return new BlockedError(
        `${this.fails} API calls failed in a row (last: ${msg}). Stopping so nothing is mis-recorded; progress is saved.`,
      );
    }
    return new ApiError(msg);
  }

  /* ---------- small helpers ---------- */
  private checkStop(): void {
    if (this.stopFlag) throw new StopRequested();
  }
  private fatal(e: unknown): boolean {
    return e instanceof BlockedError || e instanceof StopRequested;
  }
  private cursor(key: string): void {
    this.cursorKey = key;
  }
  private isDone(scope: string): boolean {
    return this.progress.get(scope)?.status === 'done';
  }
  private begin(scope: string): void {
    this.progress.set(scope, { status: 'running', error: '' });
  }
  private finish(scope: string): void {
    this.progress.set(scope, { status: 'done', error: '' });
  }
  private fail(scope: string, e: unknown, nodeKey: string): void {
    const msg = e instanceof Error ? e.message : String(e);
    this.progress.set(scope, { status: 'failed', error: msg });
    this.nodes.set(nodeKey, 'failed');
    this.log(`FAILED ${scope}: ${msg}. Marked failed, retried next run (never recorded as "no variants")`, 'bad');
  }
  private countStatus(s: ScopeStatus): number {
    let n = 0;
    this.progress.forEach((v) => {
      if (v.status === s) n++;
    });
    return n;
  }
  private noteAll(notes: Note[]): void {
    for (const n of notes) this.anomaly(n.kind, n.detail);
  }
  private anomaly(kind: string, detail: string): void {
    const key = `${kind}|${detail}`;
    if (this.anomalyKeys.has(key)) return;
    this.anomalyKeys.add(key);
    this.anomalies.push({ kind, detail });
  }
  private log(text: string, tone: Tone): void {
    this.logs.push({ n: this.calls, text, tone });
    if (this.logs.length > 40) this.logs.shift();
  }
  private autosave(why: 'timer' | 'exit'): void {
    const n = this.rows().length;
    if (n === this.lastSavedRows) return;
    this.lastSavedRows = n;
    this.autosaves++;
    this.log(
      why === 'timer'
        ? `Excel autosaved (${n} rows). Real tool: every 45 s, only if data changed`
        : `Excel saved on exit (${n} rows), also done on Ctrl+C, console close or crash`,
      'ok',
    );
  }

  /* ---------- derived views ---------- */
  rows(): MasterRow[] {
    const out: MasterRow[] = [];
    const push = (key: string, type: string, make: string, model: string, variant: string, gvw: string, fuel: string): void => {
      out.push({ key, srno: out.length + 1, type, make, model, variant, gvw, fuel });
    };
    for (const t of SITE) {
      for (const mk of this.makes.get(t.id) ?? []) {
        const mStore = `${t.id}|${mk.id}`;
        const models = this.models.get(mStore);
        if (!models) continue; // never fetched: no row yet
        if (!models.length) {
          push(`e:${mStore}`, t.name, mk.name, '', '', '', '');
          continue;
        }
        for (const md of models) {
          const vs = this.variants.get(`${mStore}|${md.id}`);
          if (!vs) continue;
          if (!vs.length) {
            push(`e:${mStore}|${md.id}`, t.name, mk.name, md.name, '', '', '');
            continue;
          }
          for (const v of vs) push(`v:${v.vid}`, t.name, mk.name, md.name, v.name, v.gvw === null ? '' : String(v.gvw), v.fuel);
        }
      }
    }
    return out;
  }

  snapshot(): Snap {
    const tree: TreeType[] = SITE.map((t) => ({
      key: `t:${t.id}`,
      id: t.id,
      name: t.name,
      makes: (this.makes.get(t.id) ?? []).map((mk) => ({
        key: `m:${t.id}|${mk.id}`,
        id: mk.id,
        name: mk.name,
        models: (this.models.get(`${t.id}|${mk.id}`) ?? []).map((md) => ({
          key: `d:${t.id}|${mk.id}|${md.id}`,
          id: md.id,
          name: md.name,
          variants: (this.variants.get(`${t.id}|${mk.id}|${md.id}`) ?? []).map((v) => ({ key: `v:${v.vid}`, label: v.label, warn: v.warn })),
        })),
      })),
    }));
    let makes = 0;
    let models = 0;
    let variants = 0;
    this.makes.forEach((l) => (makes += l.length));
    this.models.forEach((l) => (models += l.length));
    this.variants.forEach((l) => (variants += l.length));
    let typesDone = 0;
    for (const t of SITE) if (this.nodes.get(`t:${t.id}`) === 'done') typesDone++;
    const rows = this.rows();
    const done = this.countStatus('done');
    return {
      tree,
      states: Object.fromEntries(this.nodes) as Record<string, NodeState>,
      cursorKey: this.cursorKey,
      path: [...this.path],
      ticker: [...this.ticker].reverse().slice(0, 5).map((e) => ({ ...e })),
      log: [...this.logs].reverse().slice(0, 8),
      rowsTail: rows.slice(-10),
      rowCount: rows.length,
      anomalies: [...this.anomalies],
      typesDone,
      makes,
      models,
      variants,
      calls: this.calls,
      savedCalls: this.savedCalls,
      autosaves: this.autosaves,
      lastSaveRows: this.lastSavedRows,
      scopesDone: done,
      scopesFailed: this.countStatus('failed'),
      scopesTotal: SITE_STATS.scopes,
      progress: Math.min(1, done / SITE_STATS.scopes),
      resumeDone: this.resumeDone,
      resumeFailed: this.resumeFailed,
      hasResume: this.hasResume,
      endDetail: this.endDetail,
      arm429: this.ctx.arm429,
    };
  }
}

/* ================================================================== *
 *  4. The component
 * ================================================================== */

type Phase = 'idle' | 'running' | 'stopping' | 'stopped' | 'blocked' | 'finished';
interface Banner { tone: 'ok' | 'warn' | 'bad' | 'info'; label: string; text: string; sub: string }

const GLYPHS: Record<NodeState, string> = {
  pending: '\u00b7',
  fetching: '\u2026',
  open: '\u25b8',
  done: '\u2713',
  failed: '!',
  empty: '\u2205',
};

@Component({
  selector: 'app-mmv-extractor-demo',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="demo" [class.reduced]="reduced" aria-label="Master data extractor demo">
      <div class="demo__bar">
        <strong class="demo__title">MMV extractor &mdash; a crawl over a synthetic master</strong>
        <span class="demo__tag">Interactive &middot; runs in your browser</span>
      </div>

      <div class="demo__body">
        <p class="hint">
          The crawler walks <b>type &rarr; make &rarr; model &rarr; variants</b>, finishing one model before the next, using only
          numeric ids. Pause it, trigger a rate limit, break an answer, then resume and watch finished scopes get skipped.
        </p>

        <div class="ctrl">
          @if (phase() === 'idle') {
            <button type="button" class="dbtn dbtn--primary" (click)="start()">Start</button>
          }
          @if (phase() === 'running') {
            <button type="button" class="dbtn dbtn--primary" (click)="pause()">Pause (stop cleanly)</button>
          }
          @if (phase() === 'stopping') {
            <button type="button" class="dbtn" disabled>Stopping&hellip;</button>
          }
          @if (canResume()) {
            <button type="button" class="dbtn dbtn--primary" (click)="resume()">{{ resumeLabel() }}</button>
          }
          <button type="button" class="dbtn" (click)="reset()">Reset</button>
          <button type="button" class="dbtn" [disabled]="phase() !== 'running'" (click)="trigger429()">
            Simulate rate-limit (HTTP 429)
          </button>
        </div>

        <div class="ctrl">
          <button type="button" class="dbtn dbtn--sm" [attr.aria-pressed]="malformed() ? 'true' : 'false'" (click)="toggleMalformed()">
            Inject a malformed answer
          </button>
          <button type="button" class="dbtn dbtn--sm" [attr.aria-pressed]="drop() ? 'true' : 'false'" (click)="toggleDrop()">
            Drop the network
          </button>
          <label class="field field--inline">
            <span>--slow</span>
            <select [value]="slow()" (change)="setSlow($event)">
              <option value="1">1x (normal)</option>
              <option value="2">2x (slower)</option>
              <option value="0.5">0.5x (faster)</option>
            </select>
          </label>
          <button type="button" class="dbtn dbtn--sm" [disabled]="snap().rowCount === 0" (click)="downloadCsv()">
            Download rows as CSV
          </button>
        </div>
        <p class="hint hint--small">
          @if (snap().arm429) {
            A 429 is armed: the very next call will be refused.
          } @else if (malformed()) {
            Malformed mode is on: the answer for one Tipper model (SIGNA 2823.K) will come back with a renamed key.
          } @else if (drop()) {
            Network is dropped: calls fail, retry with backoff, and 8 failures in a row trip the breaker.
          } @else {
            Toggles take effect on the next call. The 429 button is live only while the crawl is running.
          }
        </p>

        <div class="status" role="status" aria-live="polite">
          @if (banner(); as b) {
            <div class="bnr" [attr.data-tone]="b.tone">
              <div class="row">
                <span class="pill" [class.ok]="b.tone === 'ok'" [class.warn]="b.tone === 'warn'" [class.bad]="b.tone === 'bad'" [class.info]="b.tone === 'info'">{{ b.label }}</span>
                <strong>{{ b.text }}</strong>
              </div>
              @if (b.sub) {
                <span class="bnr__sub">{{ b.sub }}</span>
              }
            </div>
          }
        </div>

        <div class="prog">
          <div class="prog__head">
            <span>Scopes done: {{ snap().scopesDone }} / {{ snap().scopesTotal }}</span>
            <span>failed: {{ snap().scopesFailed }} &middot; calls saved by resume: {{ snap().savedCalls }}</span>
          </div>
          <div
            class="bar"
            role="progressbar"
            aria-label="Scopes done"
            aria-valuemin="0"
            aria-valuemax="100"
            [attr.aria-valuenow]="pct()"
          >
            <i [style.transform]="barTransform()"></i>
          </div>
          <span class="prog__foot">The demo knows the total up front; the real run only learns it as it discovers makes and models.</span>
        </div>

        <div class="kvs">
          <div class="kv"><strong>{{ snap().typesDone }}/{{ stats.types }}</strong><span>types done</span></div>
          <div class="kv"><strong>{{ snap().makes }}</strong><span>makes</span></div>
          <div class="kv"><strong>{{ snap().models }}</strong><span>models</span></div>
          <div class="kv"><strong>{{ snap().variants }}</strong><span>variants</span></div>
          <div class="kv"><strong>{{ snap().calls }}</strong><span>API calls</span></div>
          <div class="kv"><strong>{{ snap().anomalies.length }}</strong><span>anomalies</span></div>
        </div>

        <div class="grid-2">
          <div class="col">
            <div class="path" aria-label="Where the crawler is">
              <span class="path__lbl">Crawler at</span>
              @for (p of snap().path; track $index) {
                @if (p) {
                  <span class="crumb">{{ p }}</span>
                }
              }
              @if (!snap().path[0]) {
                <span class="crumb crumb--idle">idle</span>
              }
            </div>
            <div class="tree" #tree aria-hidden="true">
              <span class="cursor" [class.on]="cursorOn()" [style.transform]="cursorTransform()"></span>
              @for (t of snap().tree; track t.key) {
                <div class="tgroup">
                  <span class="chip chip--type" [attr.data-k]="t.key" [attr.data-s]="st(t.key)">
                    <i class="glyph">{{ glyph(st(t.key)) }}</i>{{ t.name }} <small>#{{ t.id }}</small>
                  </span>
                  @for (m of t.makes; track m.key) {
                    <div class="mrow enter">
                      <span class="chip chip--make" [attr.data-k]="m.key" [attr.data-s]="st(m.key)">
                        <i class="glyph">{{ glyph(st(m.key)) }}</i>{{ m.name }}
                      </span>
                      <span class="models">
                        @for (d of m.models; track d.key) {
                          <span class="chip chip--model enter" [attr.data-k]="d.key" [attr.data-s]="st(d.key)">
                            <i class="glyph">{{ glyph(st(d.key)) }}</i>{{ d.name }}
                            @if (d.variants.length) {
                              <span class="vdots">
                                @for (v of d.variants; track v.key) {
                                  <i class="vd" [class.warn]="v.warn" [title]="v.label"></i>
                                }
                              </span>
                            }
                          </span>
                        }
                      </span>
                    </div>
                  }
                </div>
              }
            </div>
            <div class="legend" aria-label="Legend">
              @for (l of legend; track l.s) {
                <span class="chip chip--leg" [attr.data-s]="l.s"><i class="glyph">{{ glyph(l.s) }}</i>{{ l.label }}</span>
              }
              <span class="chip chip--leg" data-s="done"><i class="vd"></i>variant</span>
              <span class="chip chip--leg" data-s="empty"><i class="vd warn"></i>variant with anomaly</span>
            </div>
          </div>

          <div class="col">
            <div class="panel">
              <div class="panel__head">
                <strong>Request ticker</strong>
                @if (flash(); as f) {
                  <span class="pill ok flash">{{ f }}</span>
                }
              </div>
              <ul class="tick">
                @for (e of snap().ticker; track e.n) {
                  <li class="enter">
                    <code>POST {{ e.endpoint }} {{ e.payload }}</code>
                    <span class="pill" [class.ok]="e.tone === 'ok'" [class.warn]="e.tone === 'warn'" [class.bad]="e.tone === 'bad'" [class.info]="e.tone === 'info'">{{ e.status }}</span>
                    @if (e.status === 'sent') {
                      <span class="sweep" aria-hidden="true"></span>
                    }
                  </li>
                } @empty {
                  <li class="tick__empty">No calls yet. Press Start.</li>
                }
              </ul>
              <p class="hint hint--small">Calls come from the page itself, paced with a random delay; nothing is clicked.</p>
            </div>

            <div class="panel">
              <div class="panel__head"><strong>Progress log</strong><span class="hint hint--small">newest first</span></div>
              <ul class="log">
                @for (l of snap().log; track $index) {
                  <li [attr.data-tone]="l.tone"><time>#{{ l.n }}</time><span>{{ l.text }}</span></li>
                } @empty {
                  <li><time>#0</time><span>Waiting to start.</span></li>
                }
              </ul>
            </div>
          </div>
        </div>

        <div class="panel">
          <div class="panel__head">
            <strong>MMV_Master preview</strong>
            <span class="hint hint--small">last {{ snap().rowsTail.length }} of {{ snap().rowCount }} rows</span>
            @if (snap().autosaves) {
              <span class="pill mute">autosaves: {{ snap().autosaves }} &middot; last had {{ snap().lastSaveRows }} rows</span>
            }
          </div>
          <div class="tbl">
            <table>
              <thead>
                <tr>
                  <th>Srno</th>
                  <th>Vehicle_type</th>
                  <th>Vehicle_make</th>
                  <th>Vehicle_model</th>
                  <th>vehicle_variant</th>
                  <th>vehicle_gvw</th>
                  <th>vehicle_fuel</th>
                </tr>
              </thead>
              <tbody>
                @for (r of snap().rowsTail; track r.key) {
                  <tr class="rowin">
                    <td>{{ r.srno }}</td>
                    <td>{{ r.type }}</td>
                    <td>{{ r.make }}</td>
                    <td>{{ r.model || '(blank)' }}</td>
                    <td>{{ r.variant || '(blank)' }}</td>
                    <td>{{ r.gvw || '-' }}</td>
                    <td>{{ r.fuel || '-' }}</td>
                  </tr>
                } @empty {
                  <tr><td colspan="7">Rows appear here as each model's variants are saved.</td></tr>
                }
              </tbody>
            </table>
          </div>
          <p class="hint hint--small">
            Label rule: text after the last " - " becomes the fuel only if it is a known fuel; GVW comes from the API field and is cross-checked against the label.
          </p>
        </div>

        <div class="panel">
          <div class="panel__head"><strong>Anomalies</strong><span class="hint hint--small">sheet &ldquo;Anomalies&rdquo;</span></div>
          <ul class="anoms">
            @for (a of snap().anomalies; track $index) {
              <li class="enter">
                <span class="pill warn">{{ a.kind }}</span>
                <span>{{ a.detail }}</span>
              </li>
            } @empty {
              <li class="anoms__empty">None yet. Anomalies are logged, never silently fixed.</li>
            }
          </ul>
        </div>
      </div>

      <p class="demo__note">
        Synthetic data: {{ stats.types }} vehicle types, {{ stats.makes }} makes, {{ stats.models }} models and {{ stats.variants }} variants,
        served by a fake in-page function, so nothing touches a network. The loop, id-keyed progress table, resume, empty-answer recheck,
        retry/backoff, clean stop on HTTP 403/429/503, the 8-failure breaker and the label parsing mirror the real tool. Simplified: delays are
        shrunk to demo scale (long pause every {{ longPauseEvery }} calls instead of 150, autosave every {{ autosaveEvery }} calls instead of 45 s),
        progress lives in memory instead of SQLite, and the CSV stands in for the five-sheet Excel workbook. A real run of the tool collected
        13 types, 710 makes, 1,807 models and 4,534 variants.
      </p>
    </section>
  `,
  styles: [
    DEMO_STYLES,
    `
      .ctrl { display: flex; flex-wrap: wrap; gap: 10px; align-items: flex-end; }
      .field--inline { min-width: 150px; }
      .hint--small { font-size: 0.78rem; color: var(--text-3); }
      .status { min-height: 0; }

      .bnr { display: grid; gap: 6px; padding: 12px 14px; border: 1px solid var(--line-2); border-radius: var(--r-sm); background: var(--bg-2); }
      .bnr[data-tone='warn'] { border-color: color-mix(in srgb, var(--amber) 55%, transparent); }
      .bnr[data-tone='bad'] { border-color: color-mix(in srgb, var(--coral) 55%, transparent); }
      .bnr[data-tone='ok'] { border-color: color-mix(in srgb, var(--mint) 55%, transparent); }
      .bnr[data-tone='info'] { border-color: color-mix(in srgb, var(--sky) 55%, transparent); }
      .bnr__sub { font-size: 0.82rem; color: var(--text-2); line-height: 1.45; overflow-wrap: anywhere; }

      .prog { display: grid; gap: 6px; }
      .prog__head { display: flex; justify-content: space-between; gap: 10px; flex-wrap: wrap; font-family: var(--font-mono); font-size: 0.72rem; color: var(--text-2); }
      .prog__foot { font-size: 0.72rem; color: var(--text-3); }
      .bar { height: 10px; border-radius: 99px; background: var(--bg-2); border: 1px solid var(--line); overflow: hidden; }
      .bar > i { display: block; width: 100%; height: 100%; background: linear-gradient(90deg, var(--lime), var(--mint)); transform-origin: left center; transition: transform 0.45s var(--ease-out); }

      .path { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; font-family: var(--font-mono); font-size: 0.74rem; min-height: 28px; }
      .path__lbl { color: var(--text-3); text-transform: uppercase; letter-spacing: 0.08em; font-size: 0.66rem; }
      .crumb { padding: 2px 8px; border-radius: var(--r-pill); border: 1px solid var(--accent-line, var(--line-2)); background: var(--accent-soft, transparent); color: var(--text); }
      .crumb + .crumb::before { content: '\\203A'; margin-right: 6px; color: var(--text-3); }
      .crumb--idle { color: var(--text-3); background: transparent; border-color: var(--line); }

      .tree { position: relative; display: grid; gap: 14px; padding: 14px; min-height: 240px; border: 1px solid var(--line); border-radius: var(--r-md); background: var(--bg-2); overflow: hidden; align-content: start; }
      .tgroup { display: grid; gap: 8px; justify-items: start; }
      .mrow { display: flex; flex-wrap: wrap; gap: 6px 8px; align-items: flex-start; padding-left: 16px; position: relative; max-width: 100%; }
      .mrow::before { content: ''; position: absolute; left: 5px; top: 2px; bottom: 4px; width: 1px; background: var(--line-2); }
      .models { display: flex; flex-wrap: wrap; gap: 6px; min-width: 0; }

      .chip { position: relative; display: inline-flex; align-items: center; gap: 6px; max-width: 100%; padding: 4px 10px; border-radius: var(--r-pill);
        border: 1px solid var(--line-2); background: var(--surface); color: var(--text-3);
        font-family: var(--font-mono); font-size: 0.72rem; line-height: 1.3;
        transition: color 0.25s ease, border-color 0.25s ease, background-color 0.25s ease; }
      .chip small { color: var(--text-3); font-size: 0.66rem; }
      .chip--type { font-size: 0.78rem; font-weight: 600; padding: 5px 12px; }
      .glyph { font-style: normal; width: 1em; text-align: center; flex: none; }
      .chip[data-s='pending'] { opacity: 0.6; }
      .chip[data-s='open'] { color: var(--text-2); border-color: var(--accent-line, var(--line-2)); }
      .chip[data-s='fetching'] { color: var(--accent-text); border-color: var(--accent-text); background: var(--accent-soft, var(--surface)); }
      .chip[data-s='fetching']::after { content: ''; position: absolute; inset: -3px; border-radius: inherit; border: 1px solid var(--accent-text); pointer-events: none; animation: ring 1.1s ease-out infinite; }
      .chip[data-s='done'] { color: var(--mint); border-color: color-mix(in srgb, var(--mint) 50%, transparent); background: color-mix(in srgb, var(--mint) 9%, transparent); }
      .chip[data-s='failed'] { color: var(--coral); border-color: color-mix(in srgb, var(--coral) 55%, transparent); background: color-mix(in srgb, var(--coral) 9%, transparent); }
      .chip[data-s='empty'] { color: var(--amber); border-color: color-mix(in srgb, var(--amber) 55%, transparent); background: color-mix(in srgb, var(--amber) 9%, transparent); }
      :root[data-theme='light'] .chip[data-s='done'] { color: #0b7a55; }
      :root[data-theme='light'] .chip[data-s='failed'] { color: #b3341a; }
      :root[data-theme='light'] .chip[data-s='empty'] { color: #8a5a00; }
      .chip--leg { font-size: 0.68rem; padding: 2px 8px; opacity: 1 !important; }
      .chip--leg[data-s]::after { display: none; }
      .legend { display: flex; flex-wrap: wrap; gap: 6px; }

      .vdots { display: inline-flex; gap: 3px; margin-left: 2px; flex-wrap: wrap; }
      .vd { display: inline-block; width: 8px; height: 8px; border-radius: 2px; background: var(--mint); animation: pop 0.35s var(--ease-out) both; }
      .vd.warn { background: var(--amber); }
      :root[data-theme='light'] .vd { background: #0b7a55; }
      :root[data-theme='light'] .vd.warn { background: #b87500; }

      .cursor { position: absolute; left: 0; top: 0; width: 14px; height: 14px; border-radius: 50%; background: var(--lime);
        box-shadow: 0 0 0 4px color-mix(in srgb, var(--lime) 30%, transparent); opacity: 0; pointer-events: none; z-index: 3;
        transition: transform 0.5s var(--ease-out), opacity 0.25s ease; }
      .cursor.on { opacity: 1; }
      .reduced .cursor { transition: none; }
      .reduced .chip[data-s='fetching']::after, .reduced .sweep { animation: none; }

      .panel { display: grid; gap: 10px; padding: 14px; border: 1px solid var(--line); border-radius: var(--r-md); background: var(--surface); min-width: 0; }
      .panel__head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
      .panel__head strong { font-size: 0.88rem; }

      .tick { margin: 0; padding: 0; list-style: none; display: grid; gap: 8px; }
      .tick li { position: relative; display: flex; flex-wrap: wrap; gap: 6px 10px; align-items: center; justify-content: space-between; padding: 8px 10px; border: 1px solid var(--line); border-radius: var(--r-sm); background: var(--bg-2); overflow: hidden; }
      .tick code { font-family: var(--font-mono); font-size: 0.74rem; color: var(--text-2); overflow-wrap: anywhere; min-width: 0; }
      .tick__empty { color: var(--text-3); font-size: 0.82rem; }
      .sweep { position: absolute; left: 0; bottom: 0; height: 2px; width: 35%; background: var(--accent-text); animation: sweep 0.9s ease-in-out infinite; }
      .flash { animation: flash 2.2s ease-out both; }

      .log { max-height: 210px; }
      .log li { flex-wrap: wrap; gap: 2px 10px; }
      .log li > span { min-width: 0; overflow-wrap: anywhere; }
      .log li[data-tone='ok'] > span { color: var(--mint); }
      .log li[data-tone='warn'] > span { color: var(--amber); }
      .log li[data-tone='bad'] > span { color: var(--coral); }
      .log li[data-tone='mute'] > span { color: var(--text-3); }
      :root[data-theme='light'] .log li[data-tone='ok'] > span { color: #0b7a55; }
      :root[data-theme='light'] .log li[data-tone='warn'] > span { color: #8a5a00; }
      :root[data-theme='light'] .log li[data-tone='bad'] > span { color: #b3341a; }

      .anoms { margin: 0; padding: 0; list-style: none; display: grid; gap: 8px; }
      .anoms li { display: flex; flex-wrap: wrap; gap: 6px 10px; align-items: baseline; font-size: 0.82rem; color: var(--text-2); }
      .anoms li > span:last-child { min-width: 0; overflow-wrap: anywhere; }
      .anoms__empty { color: var(--text-3); }

      .enter { animation: pop 0.35s var(--ease-out) both; }
      .rowin { animation: rowin 0.5s var(--ease-out) both; }

      @keyframes pop { from { opacity: 0; transform: translateY(4px) scale(0.96); } to { opacity: 1; transform: none; } }
      @keyframes rowin { from { opacity: 0; transform: translateX(-8px); } to { opacity: 1; transform: none; } }
      @keyframes ring { from { opacity: 0.8; transform: scale(1); } to { opacity: 0; transform: scale(1.22); } }
      @keyframes sweep { from { transform: translateX(-100%); } to { transform: translateX(300%); } }
      @keyframes flash { 0% { opacity: 0; transform: translateY(-4px); } 12% { opacity: 1; transform: none; } 80% { opacity: 1; } 100% { opacity: 0.55; } }
    `,
  ],
})
export class MmvExtractorDemoComponent {
  private readonly device = inject(DeviceService);
  private readonly doc = inject(DOCUMENT);

  @ViewChild('tree') treeRef?: ElementRef<HTMLElement>;

  readonly reduced = this.device.reducedMotion;
  readonly stats = SITE_STATS;
  readonly longPauseEvery = LONG_PAUSE_EVERY;
  readonly autosaveEvery = AUTOSAVE_EVERY_CALLS;
  readonly legend: { s: NodeState; label: string }[] = [
    { s: 'pending', label: 'pending' },
    { s: 'open', label: 'children in progress' },
    { s: 'fetching', label: 'fetching' },
    { s: 'done', label: 'done' },
    { s: 'failed', label: 'failed' },
    { s: 'empty', label: 'empty' },
  ];

  private engine = new ExtractorEngine();
  readonly snap = signal<Snap>(this.engine.snapshot());
  readonly phase = signal<Phase>('idle');
  readonly malformed = signal(false);
  readonly drop = signal(false);
  readonly slow = signal('1');
  readonly flash = signal<string | null>(null);
  readonly cursorOn = signal(false);
  private readonly cursorX = signal(0);
  private readonly cursorY = signal(0);
  readonly cursorTransform = computed(() => `translate(${this.cursorX()}px, ${this.cursorY()}px)`);
  readonly pct = computed(() => Math.round(this.snap().progress * 100));
  readonly barTransform = computed(() => `scaleX(${this.snap().progress})`);

  readonly canResume = computed(() => {
    const p = this.phase();
    return p === 'stopped' || p === 'blocked' || p === 'finished';
  });
  readonly resumeLabel = computed(() => {
    const s = this.snap();
    return this.phase() === 'finished' && s.scopesFailed === 0 ? 'Run again (every scope skips)' : 'Resume';
  });

  readonly banner = computed<Banner | null>(() => {
    const p = this.phase();
    const s = this.snap();
    if (p === 'running' || p === 'stopping') {
      if (!s.hasResume) return null;
      return {
        tone: 'info',
        label: 'Resumed',
        text: `Skipping ${s.resumeDone} done scope(s) with no calls, retrying ${s.resumeFailed} failed one(s). Calls saved so far: ${s.savedCalls}.`,
        sub: '',
      };
    }
    if (p === 'stopped') {
      return {
        tone: 'warn',
        label: 'Paused',
        text: `Stopped cleanly \u2014 ${s.scopesDone} scopes done, progress saved.`,
        sub: s.endDetail,
      };
    }
    if (p === 'blocked') {
      return {
        tone: 'bad',
        label: 'Blocked',
        text: `Stopped cleanly \u2014 ${s.scopesDone} scopes done, progress saved.`,
        sub: s.endDetail,
      };
    }
    if (p === 'finished') {
      if (s.scopesFailed > 0) {
        return {
          tone: 'bad',
          label: 'Finished with failures',
          text: `${s.scopesDone} scopes done, ${s.scopesFailed} failed. Failed scopes are retried on the next run.`,
          sub: this.malformed() ? 'Turn off "Inject a malformed answer", then press Resume to retry the failed scope.' : 'Press Resume to retry them.',
        };
      }
      return {
        tone: 'ok',
        label: 'Finished',
        text: `All ${s.scopesDone} scopes done, ${s.rowCount} rows saved.`,
        sub: s.savedCalls > 0 ? `This run skipped ${s.savedCalls} already-done scopes (calls saved).` : '',
      };
    }
    return null;
  });

  private gen: Generator<{ wait: number }, EndInfo, void> | null = null;
  private pumpTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();
  private raf = 0;
  private lastAutosaves = 0;
  private lastCursorKey: string | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.clearPump();
      this.timers.forEach((t) => clearTimeout(t));
      this.timers.clear();
      if (this.raf && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(this.raf);
      this.gen = null;
    });
  }

  /* ---------- template helpers ---------- */
  st(key: string): NodeState {
    return this.snap().states[key] ?? 'pending';
  }
  glyph(s: NodeState): string {
    return GLYPHS[s];
  }

  /* ---------- controls ---------- */
  start(): void {
    if (this.phase() !== 'idle') return;
    this.launch();
  }

  resume(): void {
    if (!this.canResume()) return;
    this.launch();
  }

  pause(): void {
    if (this.phase() !== 'running' || !this.gen) return;
    this.engine.stopFlag = true;
    this.phase.set('stopping');
    this.clearPump();
    this.pump(); // resumes the generator right away: it sees the flag at its next check and ends cleanly
  }

  reset(): void {
    this.clearPump();
    this.gen = null;
    this.engine = new ExtractorEngine();
    this.engine.ctx.malformed = this.malformed();
    this.engine.ctx.drop = this.drop();
    this.engine.slow = Number(this.slow());
    this.lastAutosaves = 0;
    this.lastCursorKey = null;
    this.flash.set(null);
    this.cursorOn.set(false);
    this.phase.set('idle');
    this.snap.set(this.engine.snapshot());
  }

  trigger429(): void {
    if (this.phase() !== 'running') return;
    this.engine.ctx.arm429 = true;
    this.snap.set(this.engine.snapshot());
  }

  toggleMalformed(): void {
    this.malformed.update((v) => !v);
    this.engine.ctx.malformed = this.malformed();
  }

  toggleDrop(): void {
    this.drop.update((v) => !v);
    this.engine.ctx.drop = this.drop();
  }

  setSlow(ev: Event): void {
    const v = (ev.target as HTMLSelectElement).value;
    this.slow.set(v);
    this.engine.slow = Number(v);
  }

  downloadCsv(): void {
    const rows = this.engine.rows();
    if (!rows.length) return;
    const esc = (v: string): string => (/[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    const head = ['Srno', 'Vehicle_type', 'Vehicle_make', 'Vehicle_model', 'vehicle_variant', 'vehicle_gvw', 'vehicle_fuel'];
    const body = rows.map((r) => [String(r.srno), r.type, r.make, r.model, r.variant, r.gvw, r.fuel].map(esc).join(','));
    const blob = new Blob([`\ufeff${[head.join(','), ...body].join('\r\n')}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = this.doc.createElement('a');
    a.href = url;
    a.download = 'MMV_Master_demo.csv';
    this.doc.body.appendChild(a);
    a.click();
    a.remove();
    this.later(() => URL.revokeObjectURL(url), 1500);
  }

  /* ---------- driver: turns the engine's `yield {wait}` into timers ---------- */
  private launch(): void {
    this.engine.ctx.malformed = this.malformed();
    this.engine.ctx.drop = this.drop();
    this.engine.slow = Number(this.slow());
    this.engine.beginRun();
    this.gen = this.engine.run();
    this.phase.set('running');
    this.pump();
  }

  private pump(): void {
    this.pumpTimer = null;
    const gen = this.gen;
    if (!gen) return;
    for (;;) {
      let r: IteratorResult<{ wait: number }, EndInfo>;
      try {
        r = gen.next();
      } catch {
        this.gen = null;
        this.phase.set('stopped');
        this.sync();
        return;
      }
      if (r.done) {
        this.gen = null;
        this.sync();
        const reason = r.value.reason;
        this.phase.set(reason === 'complete' ? 'finished' : reason === 'blocked' ? 'blocked' : 'stopped');
        return;
      }
      const wait = r.value.wait;
      if (wait > 0) {
        this.sync();
        // reduced motion: keep the logic, drop the pacing theatre
        const ms = this.reduced ? Math.min(wait, 40) : wait;
        this.pumpTimer = setTimeout(() => this.pump(), ms);
        return;
      }
    }
  }

  private clearPump(): void {
    if (this.pumpTimer !== null) {
      clearTimeout(this.pumpTimer);
      this.pumpTimer = null;
    }
  }

  private later(fn: () => void, ms: number): void {
    const t = setTimeout(() => {
      this.timers.delete(t);
      fn();
    }, ms);
    this.timers.add(t);
  }

  private sync(): void {
    const s = this.engine.snapshot();
    this.snap.set(s);
    if (s.autosaves > this.lastAutosaves) {
      this.lastAutosaves = s.autosaves;
      this.flash.set(`Excel autosaved \u00b7 ${s.lastSaveRows} rows \u00b7 5 sheets`);
      this.later(() => this.flash.set(null), 2200);
    }
    if (s.cursorKey !== this.lastCursorKey) {
      this.lastCursorKey = s.cursorKey;
      this.placeCursor(s.cursorKey);
    }
  }

  /** Measure the node after Angular rendered it, then move the cursor (transform only). Browser-only: runs from timers/clicks. */
  private placeCursor(key: string | null): void {
    if (!this.device.isBrowser) return;
    if (!key) {
      this.cursorOn.set(false);
      return;
    }
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(() => {
      this.raf = 0;
      const root = this.treeRef?.nativeElement;
      const el = root?.querySelector<HTMLElement>(`[data-k="${key}"]`);
      if (!root || !el) return;
      const c = root.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      this.cursorX.set(Math.round(r.left - c.left - 8));
      this.cursorY.set(Math.round(r.top - c.top + r.height / 2 - 7));
      this.cursorOn.set(true);
    });
  }
}
