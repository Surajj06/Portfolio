import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  signal,
} from '@angular/core';
import { DeviceService } from '../../services/device.service';
import { DEMO_STYLES } from './demo-styles';

/* ------------------------------------------------------------------ */
/*  Faithful port of the real scoring rules (TierService in the API)  */
/* ------------------------------------------------------------------ */

type Tier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';
type Region = 'North' | 'South' | 'East' | 'West';
type Role = 'agent' | 'admin' | 'master';

const TIER_ORDER: Tier[] = ['bronze', 'silver', 'gold', 'platinum', 'diamond'];

/** The settings table the real service reads (SystemSettings cache), seeded values. */
const SEED_SETTINGS: Record<string, string> = {
  'tier.bronze.min_policies': '0',
  'tier.silver.min_policies': '11',
  'tier.gold.min_policies': '26',
  'tier.platinum.min_policies': '51',
  'tier.diamond.min_policies': '101',
  'tier.bronze.multiplier': '1.0',
  'tier.silver.multiplier': '1.2',
  'tier.gold.multiplier': '1.5',
  'tier.platinum.multiplier': '2.0',
  'tier.diamond.multiplier': '3.0',
  'points.car': '100',
  'points.two_wheeler': '50',
  'points.gcv': '120',
  'points.pcv': '120',
  'points.individual_health': '150',
  'points.family_health': '180',
  'points.term_life': '200',
  'points.travel': '80',
  'points.default': '100',
};

/** The PolicyType enum, as named in the API. */
const POLICY_TYPES: string[] = [
  'Car', 'TwoWheeler', 'GCV', 'PCV',
  'IndividualHealth', 'FamilyHealth', 'MultiIndividual',
  'MiscD', 'FamilyTravel', 'StudentTravel', 'IndividualTravel',
  'SavingInvestmentLife', 'TermLife', 'Home', 'Business',
  'Marine', 'PersonalAccident', 'Cyber', 'GroupMediclaim',
  'OneCrTerm', 'PublicLiability', 'Mos_Bite', 'PetDog', 'ProfessionalIndemnity', 'Workmen',
];

const SIM_TYPES = ['Car', 'TwoWheeler', 'IndividualHealth', 'FamilyHealth', 'TermLife', 'GCV', 'PCV', 'Home'];
const FILTER_TYPES = ['Car', 'TwoWheeler', 'IndividualHealth', 'TermLife'];

/** C# Math.Round(double): midpoints go to the even neighbour. */
function roundHalfEven(x: number): number {
  const f = Math.floor(x);
  const diff = x - f;
  if (diff < 0.5) return f;
  if (diff > 0.5) return f + 1;
  return f % 2 === 0 ? f : f + 1;
}

interface PointsBreakdown {
  key: string;
  found: boolean;
  base: number;
  multKey: string;
  mult: number;
  raw: number;
  points: number;
}

/** CalculatePoints: key = "points." + enumName.ToLower(); miss -> points.default (100); x tier multiplier; Math.Round. */
function calculatePoints(type: string, tier: Tier, s: Record<string, string>): PointsBreakdown {
  const key = 'points.' + type.toLowerCase();
  const found = Object.prototype.hasOwnProperty.call(s, key);
  const baseStr = found ? (s[key] as string) : (s['points.default'] ?? '100');
  const base = parseInt(baseStr, 10);
  const multKey = 'tier.' + tier + '.multiplier';
  const mult = Math.fround(parseFloat(s[multKey] ?? '1.0'));
  const raw = Math.fround(base * mult);
  return { key, found, base, multKey, mult, raw, points: roundHalfEven(raw) };
}

function minPolicies(tier: Tier, s: Record<string, string>): number {
  const dflt: Record<Tier, string> = { bronze: '0', silver: '11', gold: '26', platinum: '51', diamond: '101' };
  return parseInt(s['tier.' + tier + '.min_policies'] ?? dflt[tier], 10);
}

/** DetermineNewTier: highest threshold first; thresholds 11 / 26 / 51 / 101 by default. */
function determineNewTier(policies: number, s: Record<string, string>): Tier {
  if (policies >= minPolicies('diamond', s)) return 'diamond';
  if (policies >= minPolicies('platinum', s)) return 'platinum';
  if (policies >= minPolicies('gold', s)) return 'gold';
  if (policies >= minPolicies('silver', s)) return 'silver';
  return 'bronze';
}

interface TypeTally { n: number; pts: number }

interface Agent {
  id: string;
  name: string;
  code: string;
  branch: string;
  region: Region;
  n: number;
  pts: number;
  premium: number;
  tier: Tier;
  retention: number;
  byType: Record<string, TypeTally>;
}

interface Team {
  id: string;
  name: string;
  region: Region;
  played: number;
  won: number;
  lost: number;
  policies: number;
  round: number;
}

interface FeedEvent {
  id: number;
  time: string;
  type: 'PolicySold' | 'TierUpgraded' | 'LeaderboardUpdated' | 'LiveMatchScore' | 'MatchUpdated';
  text: string;
}

interface Row {
  agent: Agent;
  rank: number;
  n: number;
  pts: number;
  delta: number;
}

const SEED_AGENTS: { id: string; region: Region; n: number; retention: number }[] = [
  { id: 'a', region: 'North', n: 9, retention: 93.5 },
  { id: 'b', region: 'South', n: 24, retention: 91.2 },
  { id: 'c', region: 'East', n: 49, retention: 95.0 },
  { id: 'd', region: 'West', n: 99, retention: 97.4 },
  { id: 'e', region: 'North', n: 17, retention: 88.0 },
  { id: 'f', region: 'South', n: 33, retention: 90.6 },
  { id: 'g', region: 'East', n: 5, retention: 100 },
  { id: 'h', region: 'West', n: 62, retention: 94.1 },
];

const SEED_CYCLE = ['Car', 'TwoWheeler', 'IndividualHealth', 'TermLife'];

function seedAgent(idx: number): Agent {
  const spec = SEED_AGENTS[idx] as { id: string; region: Region; n: number; retention: number };
  const letter = spec.id.toUpperCase();
  const byType: Record<string, TypeTally> = {};
  let pts = 0;
  let tier: Tier = 'bronze';
  for (let i = 0; i < spec.n; i++) {
    const type = SEED_CYCLE[(i + idx) % SEED_CYCLE.length] as string;
    const p = calculatePoints(type, tier, SEED_SETTINGS).points;
    const t = byType[type] ?? { n: 0, pts: 0 };
    byType[type] = { n: t.n + 1, pts: t.pts + p };
    pts += p;
    tier = determineNewTier(i + 1, SEED_SETTINGS);
  }
  return {
    id: spec.id,
    name: 'Agent ' + letter,
    code: 'AG-' + String(idx + 1).padStart(3, '0'),
    branch: 'Branch ' + (Math.floor(idx / 2) + 1),
    region: spec.region,
    n: spec.n,
    pts,
    premium: spec.n * (17000 + idx * 650),
    tier,
    retention: spec.retention,
    byType,
  };
}

const TEAM_SEED: Team[] = [
  { id: 'falcons', name: 'Team Falcons', region: 'North', played: 4, won: 3, lost: 0, policies: 120, round: 0 },
  { id: 'herons', name: 'Team Herons', region: 'South', played: 4, won: 2, lost: 1, policies: 98, round: 0 },
  { id: 'otters', name: 'Team Otters', region: 'East', played: 4, won: 1, lost: 3, policies: 85, round: 0 },
  { id: 'lynxes', name: 'Team Lynxes', region: 'West', played: 4, won: 1, lost: 3, policies: 70, round: 0 },
];

/** Burst particles for the tier-upgrade celebration (pure CSS, no library). */
const BURST = Array.from({ length: 22 }, (_, i) => {
  const angle = (i / 22) * Math.PI * 2;
  const dist = 70 + (i % 4) * 22;
  const colours = ['var(--lime)', 'var(--sky)', 'var(--amber)', 'var(--coral)', 'var(--violet)', 'var(--mint)'];
  return {
    dx: Math.round(Math.cos(angle) * dist) + 'px',
    dy: Math.round(Math.sin(angle) * dist) + 'px',
    rot: (i * 47) % 360 + 'deg',
    delay: (i % 5) * 20 + 'ms',
    colour: colours[i % colours.length] as string,
  };
});

function fmt(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "TwoWheeler" -> "Two Wheeler", "Mos_Bite" -> "Mos Bite". */
function typeLabel(t: string): string {
  return t.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2');
}

@Component({
  selector: 'app-gamification-demo',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    DEMO_STYLES,
    `
      .ctl { align-items: flex-end; }
      .ctl .field { flex: 1 1 180px; }
      .panel { display: grid; gap: 14px; align-content: start; min-width: 0; padding: 16px; border: 1px solid var(--line); border-radius: var(--r-md); background: var(--bg-2); }
      .panel > h3 { margin: 0; font-size: 0.74rem; font-family: var(--font-mono); letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-3); font-weight: 500; }
      .form { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); }
      .maths { margin: 0; padding: 0; list-style: none; display: grid; gap: 6px; font-family: var(--font-mono); font-size: 0.78rem; line-height: 1.5; color: var(--text-2); }
      .maths li { display: grid; grid-template-columns: 1.6rem 1fr; gap: 8px; }
      .maths b { color: var(--accent-text); font-weight: 600; }
      .maths .res { color: var(--text); font-size: 0.86rem; }
      .tier { text-transform: capitalize; }
      .tier--bronze { color: #b87333; border-color: color-mix(in srgb, #b87333 50%, transparent); }
      .tier--silver { color: var(--text-2); }
      .tier--gold { color: var(--amber); border-color: color-mix(in srgb, var(--amber) 50%, transparent); }
      .tier--platinum { color: var(--sky); border-color: color-mix(in srgb, var(--sky) 50%, transparent); }
      .tier--diamond { color: var(--violet); border-color: color-mix(in srgb, var(--violet) 50%, transparent); }
      :root[data-theme='light'] .tier--gold { color: #8a5a00; }
      :root[data-theme='light'] .tier--platinum { color: #0a6a94; }
      .meter { position: relative; height: 10px; border-radius: 99px; background: var(--surface-2); border: 1px solid var(--line); overflow: hidden; }
      .meter > i { position: absolute; inset: 0 auto 0 0; background: var(--lime); border-radius: 99px; transition: width .6s var(--ease-out); }
      .tierhead { display: flex; flex-wrap: wrap; gap: 8px 12px; align-items: center; justify-content: space-between; }
      .tierhead small { color: var(--text-3); font-size: 0.78rem; }
      .burst { position: absolute; inset: 0; pointer-events: none; display: grid; place-items: center; overflow: hidden; }
      .burst .banner { z-index: 2; padding: 10px 18px; border-radius: var(--r-pill); background: var(--cta-bg); color: var(--cta-ink); font-weight: 700; font-size: 0.9rem; animation: pop .5s var(--ease-out) both; }
      .burst .p { position: absolute; width: 8px; height: 14px; border-radius: 2px; opacity: 0; animation: fly 1.3s var(--ease-out) var(--delay) both; }
      @keyframes fly {
        0% { opacity: 1; transform: translate(0, 0) rotate(0); }
        100% { opacity: 0; transform: translate(var(--dx), var(--dy)) rotate(var(--rot)); }
      }
      @keyframes pop { from { transform: scale(.6); opacity: 0; } to { transform: scale(1); opacity: 1; } }
      .cardwrap { position: relative; }
      .lb { margin: 0; padding: 0; list-style: none; display: grid; gap: 6px; }
      .lb li { display: grid; grid-template-columns: 2.4rem minmax(0, 1fr) auto auto; gap: 10px; align-items: center; min-height: 52px; padding: 8px 12px; border: 1px solid var(--line); border-radius: var(--r-sm); background: var(--surface); }
      .lb li.me { border-color: var(--accent-line); background: var(--accent-soft); }
      .lb li.bump { animation: bump 1s ease-out; }
      @keyframes bump { 0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--lime) 60%, transparent); } 100% { box-shadow: 0 0 0 12px transparent; } }
      .rank { font-family: var(--font-mono); font-size: 0.95rem; font-weight: 700; text-align: center; }
      .who { min-width: 0; display: grid; }
      .who strong { font-size: 0.92rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .who small { color: var(--text-3); font-size: 0.74rem; }
      .score { text-align: right; font-variant-numeric: tabular-nums; line-height: 1.25; }
      .score strong { font-size: 0.95rem; }
      .score small { display: block; font-size: 0.72rem; color: var(--text-3); }
      .delta { font-family: var(--font-mono); font-size: 0.7rem; color: var(--text-3); }
      .delta.up { color: var(--mint); }
      .delta.down { color: var(--coral); }
      :root[data-theme='light'] .delta.up { color: #0b7a55; }
      :root[data-theme='light'] .delta.down { color: #b3341a; }
      .stand { width: 100%; }
      .stand td.num, .stand th.num { text-align: right; font-variant-numeric: tabular-nums; }
      .match { display: grid; gap: 4px; font-size: 0.82rem; color: var(--text-2); }
      .stream { max-height: 240px; }
      .stream li { flex-wrap: wrap; }
      .stream .t { font-weight: 600; }
      .mini { display: grid; gap: 10px; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); }
      details summary { cursor: pointer; min-height: 44px; display: flex; align-items: center; font-weight: 600; font-size: 0.9rem; }
      details summary:focus-visible { outline: 2px solid var(--accent-text); outline-offset: 2px; border-radius: var(--r-sm); }
      .result { margin: 0; font-size: 0.9rem; color: var(--text); min-height: 1.4em; }
      .empty { margin: 0; padding: 14px; text-align: center; color: var(--text-3); font-size: 0.85rem; border: 1px dashed var(--line-2); border-radius: var(--r-sm); }
      @media (max-width: 480px) {
        .lb li { grid-template-columns: 2rem minmax(0, 1fr) auto; }
        .lb li .tierpill { display: none; }
      }
    `,
  ],
  template: `
    <div class="demo">
      <div class="demo__bar">
        <strong class="demo__title">Sales leaderboard, live</strong>
        <span class="demo__tag">Interactive &middot; runs in your browser</span>
      </div>

      <div class="demo__body">
        <div class="row ctl">
          <label class="field">
            <span>Signed in as</span>
            <select #roleSel (change)="setRole(roleSel.value)">
              <option value="agent" [selected]="role() === 'agent'">Agent</option>
              <option value="admin" [selected]="role() === 'admin'">Admin</option>
              <option value="master" [selected]="role() === 'master'">Master</option>
            </select>
          </label>
          <p class="hint" style="flex: 2 1 260px">{{ roleHint() }}</p>
        </div>

        <div class="grid-2">
          <!-- ===== Log a sale ===== -->
          <section class="panel" aria-labelledby="g-log">
            <h3 id="g-log">Log a sale</h3>
            <div class="form">
              <label class="field">
                <span>Policy type</span>
                <select #typeSel (change)="typeKey.set(typeSel.value)">
                  @for (t of policyTypes; track t) {
                    <option [value]="t" [selected]="t === typeKey()">{{ label(t) }}</option>
                  }
                </select>
              </label>
              <label class="field">
                <span>Premium (&#8377;)</span>
                <input type="number" min="0" step="500" inputmode="numeric" [value]="premium()" #premInput (change)="setPremium(premInput.value)" />
              </label>
              <label class="field">
                <span>Agent</span>
                <select #agentSel (change)="agentId.set(agentSel.value)" [disabled]="role() === 'agent'">
                  @for (a of agents(); track a.id) {
                    <option [value]="a.id" [selected]="a.id === effectiveAgentId()">{{ a.name }}{{ a.id === 'a' ? ' (you)' : '' }}</option>
                  }
                </select>
              </label>
              <label class="field">
                <span>Quantity</span>
                <select #qtySel (change)="qty.set(+qtySel.value)">
                  <option value="1" [selected]="qty() === 1">1 sale</option>
                  <option value="5" [selected]="qty() === 5">5 sales</option>
                  <option value="10" [selected]="qty() === 10">10 sales</option>
                </select>
              </label>
            </div>
            <div class="row">
              <button type="button" class="dbtn dbtn--primary" (click)="logSale()">Log {{ qty() === 1 ? 'sale' : qty() + ' sales' }}</button>
              <button type="button" class="dbtn" (click)="resetAll()">Reset demo</button>
            </div>

            <ol class="maths" aria-label="Points calculation for the selected sale">
              <li><b>1</b><span>Lookup <code>{{ calc().key }}</code> {{ calc().found ? 'found' : 'not found, fall back to points.default' }}: <b>{{ calc().base }}</b> base points</span></li>
              <li><b>2</b><span>Tier multiplier <code>{{ calc().multKey }}</code> = <b>{{ multText() }}</b></span></li>
              <li><b>3</b><span>{{ calc().base }} &times; {{ multText() }} = {{ calc().raw.toFixed(2) }}, then Math.Round</span></li>
              <li class="res"><b>=</b><span>{{ calc().points }} points for this sale</span></li>
            </ol>

            <div class="cardwrap">
              <div class="tierhead">
                <span><strong>{{ selected().name }}</strong>
                  <span class="pill tier tier--{{ selected().tier }}">{{ selected().tier }}</span></span>
                <small>{{ selected().n }} policies &middot; {{ tierNote() }}</small>
              </div>
              <div class="meter" role="progressbar" aria-label="Progress to next tier" aria-valuemin="0" aria-valuemax="100" [attr.aria-valuenow]="progress()">
                <i [style.width.%]="progress()"></i>
              </div>
              @if (celebrate(); as c) {
                <div class="burst" aria-hidden="true">
                  @for (p of burst; track $index) {
                    <span class="p" [style.--dx]="p.dx" [style.--dy]="p.dy" [style.--rot]="p.rot" [style.--delay]="p.delay" [style.background]="p.colour"></span>
                  }
                  <span class="banner">{{ c }}</span>
                </div>
              }
            </div>
            <p class="result" aria-live="polite">{{ result() }}</p>
          </section>

          <!-- ===== Leaderboard ===== -->
          <section class="panel" aria-labelledby="g-lb">
            <h3 id="g-lb">Leaderboard</h3>
            <div class="form">
              <label class="field">
                <span>Region</span>
                <select #regSel (change)="setRegion(regSel.value)">
                  <option value="" [selected]="region() === ''">All regions</option>
                  @for (r of regions; track r) {
                    <option [value]="r" [selected]="region() === r">Region {{ r }}</option>
                  }
                </select>
              </label>
              <label class="field">
                <span>Policy type</span>
                <select #fSel (change)="setFilterType(fSel.value)">
                  <option value="" [selected]="filterType() === ''">All types</option>
                  @for (t of filterTypes; track t) {
                    <option [value]="t" [selected]="filterType() === t">{{ label(t) }}</option>
                  }
                </select>
              </label>
            </div>
            <div class="row">
              <button type="button" class="dbtn dbtn--sm" [attr.aria-pressed]="simulating()" (click)="toggleSim()">
                {{ simulating() ? 'Stop simulating' : 'Simulate other agents selling' }}
              </button>
              @if (canAdmin()) {
                <button type="button" class="dbtn dbtn--sm" (click)="exportCsv()">Export CSV</button>
              }
            </div>

            @if (rows().length) {
              <ol class="lb" aria-label="Leaderboard, ranked by policies then points">
                @for (r of rows(); track r.agent.id) {
                  <li [attr.data-flip]="r.agent.id" [class.me]="r.agent.id === 'a'" [class.bump]="bumpId() === r.agent.id">
                    <span class="rank">{{ r.rank }}</span>
                    <span class="who">
                      <strong>{{ r.agent.name }}{{ r.agent.id === 'a' ? ' (you)' : '' }}</strong>
                      <small>Region {{ r.agent.region }} &middot; <span [class]="deltaClass(r.delta)">{{ deltaText(r.delta) }}</span></small>
                    </span>
                    <span class="pill tier tier--{{ r.agent.tier }} tierpill">{{ r.agent.tier }}</span>
                    <span class="score"><strong>{{ r.n }}</strong> policies<small>{{ fmt(r.pts) }} pts</small></span>
                  </li>
                }
              </ol>
            } @else {
              <p class="empty">No sales match these filters yet.</p>
            }
            @if (!canAdmin()) {
              <p class="hint">Agents see the board and their own row. Export, match results and settings need a higher role.</p>
            } @else {
              <p class="hint">{{ totals() }}</p>
            }
          </section>
        </div>

        <div class="grid-2">
          <!-- ===== Team standings ===== -->
          <section class="panel" aria-labelledby="g-st">
            <h3 id="g-st">Team standings (win 2, tie 1, loss 0)</h3>
            <div class="tbl">
              <table class="stand">
                <thead>
                  <tr><th>#</th><th>Team</th><th class="num">P</th><th class="num">W</th><th class="num">T</th><th class="num">L</th><th class="num">Pts</th><th class="num">Round</th></tr>
                </thead>
                <tbody>
                  @for (t of standings(); track t.team.id; let i = $index) {
                    <tr>
                      <td>{{ i + 1 }}</td>
                      <td>{{ t.team.name }} <span class="pill mute">{{ t.team.region }}</span></td>
                      <td class="num">{{ t.team.played }}</td>
                      <td class="num">{{ t.team.won }}</td>
                      <td class="num">{{ t.tied }}</td>
                      <td class="num">{{ t.team.lost }}</td>
                      <td class="num"><strong>{{ t.points }}</strong></td>
                      <td class="num">{{ t.team.round }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
            <div class="match" aria-live="polite">
              @for (m of matches(); track m) { <span>{{ m }}</span> }
            </div>
            @if (canAdmin()) {
              <div class="row"><button type="button" class="dbtn dbtn--sm" (click)="finalizeRound()">Finalize match round</button></div>
            }
          </section>

          <!-- ===== Event stream ===== -->
          <section class="panel" aria-labelledby="g-ev">
            <h3 id="g-ev">Event stream (typed hub messages)</h3>
            <ul class="log stream" aria-live="polite" aria-label="Events pushed to every connected client">
              @for (e of events(); track e.id) {
                <li><time>{{ e.time }}</time><span class="pill {{ evClass(e.type) }}">{{ e.type }}</span><span>{{ e.text }}</span></li>
              } @empty {
                <li>Waiting for the first sale. Log one, or turn on the simulator.</li>
              }
            </ul>
          </section>
        </div>

        @if (role() === 'master') {
          <details class="panel">
            <summary>System settings (master only)</summary>
            <p class="hint">Edits change the scoring for the next sale. Existing agents keep their stored tier until their next sale, as in the real service.</p>
            <div class="mini">
              @for (k of editableKeys; track k) {
                <label class="field">
                  <span>{{ k }}</span>
                  <input type="number" step="any" min="0" [value]="settings()[k]" #sInput (change)="setSetting(k, sInput.value)" />
                </label>
              }
            </div>
          </details>
        }
      </div>

      <p class="demo__note">
        Everything here is synthetic: invented agents, regions and teams, and numbers that exist only in this page.
        Points, tiers, ranking and standings use the same rules and default thresholds as the real service
        (tier thresholds 11 / 26 / 51 / 101, base points by policy type, multiplier by tier, 2 / 1 / 0 for win / tie / loss).
        Simplified: a logged sale counts as verified immediately (the real flow has an admin verification step),
        the board has no date-period filter, and events are delivered in-page instead of over SignalR.
      </p>
    </div>
  `,
})
export class GamificationDemoComponent {
  private readonly device = inject(DeviceService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  protected readonly policyTypes = POLICY_TYPES;
  protected readonly filterTypes = FILTER_TYPES;
  protected readonly regions: Region[] = ['North', 'South', 'East', 'West'];
  protected readonly burst = BURST;
  protected readonly editableKeys = [
    'points.default', 'points.car', 'points.gcv',
    'tier.silver.min_policies', 'tier.gold.min_policies', 'tier.platinum.min_policies', 'tier.diamond.min_policies',
    'tier.silver.multiplier', 'tier.gold.multiplier', 'tier.platinum.multiplier', 'tier.diamond.multiplier',
  ];

  readonly role = signal<Role>('agent');
  readonly settings = signal<Record<string, string>>({ ...SEED_SETTINGS });
  readonly agents = signal<Agent[]>(SEED_AGENTS.map((_, i) => seedAgent(i)));
  readonly teams = signal<Team[]>(TEAM_SEED.map((t) => ({ ...t })));
  readonly events = signal<FeedEvent[]>([]);
  readonly typeKey = signal('Car');
  readonly premium = signal(18000);
  readonly agentId = signal('a');
  readonly qty = signal(1);
  readonly region = signal<Region | ''>('');
  readonly filterType = signal('');
  readonly simulating = signal(false);
  readonly celebrate = signal<string | null>(null);
  readonly result = signal('');
  readonly bumpId = signal('');
  readonly deltas = signal<Record<string, number>>({});

  private eventSeq = 0;
  private simTimer: ReturnType<typeof setInterval> | null = null;
  private burstTimer: ReturnType<typeof setTimeout> | null = null;
  private bumpTimer: ReturnType<typeof setTimeout> | null = null;

  readonly effectiveAgentId = computed(() => (this.role() === 'agent' ? 'a' : this.agentId()));
  readonly selected = computed(() => this.agents().find((a) => a.id === this.effectiveAgentId()) ?? (this.agents()[0] as Agent));
  readonly canAdmin = computed(() => this.role() !== 'agent');

  readonly calc = computed(() => calculatePoints(this.typeKey(), this.selected().tier, this.settings()));
  readonly multText = computed(() => {
    const m = this.calc().mult;
    return Number.isInteger(m) ? m.toFixed(1) : String(parseFloat(m.toFixed(4)));
  });

  private nextTier(a: Agent): Tier | null {
    const i = TIER_ORDER.indexOf(a.tier);
    return i < TIER_ORDER.length - 1 ? (TIER_ORDER[i + 1] as Tier) : null;
  }

  readonly progress = computed(() => {
    const a = this.selected();
    const s = this.settings();
    const next = this.nextTier(a);
    if (!next) return 100;
    const lo = minPolicies(a.tier, s);
    const hi = minPolicies(next, s);
    if (hi <= lo) return 100;
    return Math.max(0, Math.min(100, Math.round(((a.n - lo) / (hi - lo)) * 100)));
  });

  readonly tierNote = computed(() => {
    const a = this.selected();
    const next = this.nextTier(a);
    if (!next) return 'top tier reached';
    const left = Math.max(0, minPolicies(next, this.settings()) - a.n);
    return left + ' to ' + cap(next);
  });

  /** The leaderboard under the current filters: ORDER BY policies DESC, points DESC. */
  readonly rows = computed<Row[]>(() => {
    const reg = this.region();
    const type = this.filterType();
    const deltas = this.deltas();
    const list = this.agents()
      .filter((a) => !reg || a.region === reg)
      .map((a) => {
        const t = type ? a.byType[type] : undefined;
        return { agent: a, n: type ? (t?.n ?? 0) : a.n, pts: type ? (t?.pts ?? 0) : a.pts };
      })
      .filter((x) => x.n > 0)
      .sort((x, y) => y.n - x.n || y.pts - x.pts);
    return list.map((x, i) => ({ ...x, rank: i + 1, delta: deltas[x.agent.id] ?? 0 }));
  });

  readonly standings = computed(() =>
    this.teams()
      .map((team) => {
        const tied = team.played - team.won - team.lost;
        return { team, tied, points: team.won * 2 + tied };
      })
      .sort((x, y) => y.points - x.points || y.team.policies - x.team.policies),
  );

  readonly matches = computed(() => {
    const t = this.teams();
    const out: string[] = [];
    for (let i = 0; i < t.length; i += 2) {
      const h = t[i] as Team;
      const a = t[i + 1] as Team;
      out.push('This round: ' + h.name + ' ' + h.round + ' - ' + a.round + ' ' + a.name);
    }
    return out;
  });

  readonly totals = computed(() => {
    const list = this.agents();
    const n = list.reduce((s, a) => s + a.n, 0);
    const p = list.reduce((s, a) => s + a.pts, 0);
    return 'All regions: ' + fmt(n) + ' verified policies, ' + fmt(p) + ' points across ' + list.length + ' agents.';
  });

  readonly roleHint = computed(() => {
    switch (this.role()) {
      case 'agent':
        return 'Agent: logs own sales, sees the board and own tier. Cannot export, finalize matches or edit settings.';
      case 'admin':
        return 'Admin (AdminPlus policy): can log on behalf of any agent, export the board as CSV and finalize match rounds.';
      default:
        return 'Master (MasterOnly policy): everything an admin can do, plus the system settings that drive scoring.';
    }
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.stopSim();
      if (this.burstTimer) clearTimeout(this.burstTimer);
      if (this.bumpTimer) clearTimeout(this.bumpTimer);
    });
  }

  protected fmt = fmt;
  protected label = typeLabel;

  protected deltaText(d: number): string {
    if (d > 0) return 'up ' + d;
    if (d < 0) return 'down ' + Math.abs(d);
    return 'no change';
  }
  protected deltaClass(d: number): string {
    return 'delta ' + (d > 0 ? 'up' : d < 0 ? 'down' : '');
  }
  protected evClass(t: FeedEvent['type']): string {
    switch (t) {
      case 'PolicySold': return 'ok';
      case 'TierUpgraded': return 'warn';
      case 'LiveMatchScore':
      case 'MatchUpdated': return 'info';
      default: return 'mute';
    }
  }

  /* ---------------- handlers ---------------- */

  setRole(v: string): void {
    if (v === 'agent' || v === 'admin' || v === 'master') this.role.set(v);
    if (v === 'agent') this.agentId.set('a');
  }

  setPremium(v: string): void {
    const n = parseFloat(v);
    this.premium.set(Number.isFinite(n) && n >= 0 ? n : 0);
  }

  setRegion(v: string): void {
    this.withFlip(() => this.region.set(v as Region | ''));
  }

  setFilterType(v: string): void {
    this.withFlip(() => this.filterType.set(v));
  }

  setSetting(key: string, v: string): void {
    const n = parseFloat(v);
    if (!Number.isFinite(n) || n < 0) return;
    this.settings.update((s) => ({ ...s, [key]: key.endsWith('multiplier') ? String(n) : String(Math.round(n)) }));
  }

  logSale(): void {
    const id = this.effectiveAgentId();
    const total = this.qty();
    const type = this.typeKey();
    const before = this.rankMap();
    const first = this.captureFlip();
    let earned = 0;
    const upgrades: string[] = [];
    for (let i = 0; i < total; i++) {
      const r = this.applySale(id, type, this.premium());
      earned += r.points;
      if (r.upgrade) upgrades.push(r.upgrade);
    }
    this.afterSales(before, [id]);
    const a = this.agents().find((x) => x.id === id) as Agent;
    this.result.set(
      a.name + ' logged ' + total + ' x ' + typeLabel(type) + ': +' + fmt(earned) + ' points' +
        (upgrades.length ? ', reached ' + upgrades[upgrades.length - 1] + ' tier' : '') + '.',
    );
    const last = upgrades[upgrades.length - 1];
    if (last) this.startCelebration(cap(last) + ' tier reached');
    this.playFlipNextRender(first);
  }

  toggleSim(): void {
    if (this.simulating()) {
      this.stopSim();
      return;
    }
    this.simulating.set(true);
    this.simTimer = setInterval(() => this.simTick(), 1500);
  }

  resetAll(): void {
    this.stopSim();
    this.agents.set(SEED_AGENTS.map((_, i) => seedAgent(i)));
    this.teams.set(TEAM_SEED.map((t) => ({ ...t })));
    this.settings.set({ ...SEED_SETTINGS });
    this.events.set([]);
    this.deltas.set({});
    this.result.set('Demo reset to its starting data.');
    this.celebrate.set(null);
  }

  finalizeRound(): void {
    const teams = this.teams().map((t) => ({ ...t }));
    const lines: string[] = [];
    for (let i = 0; i < teams.length; i += 2) {
      const h = teams[i] as Team;
      const a = teams[i + 1] as Team;
      const homeWon = h.round > a.round;
      const awayWon = a.round > h.round;
      h.played++; a.played++;
      if (homeWon) { h.won++; a.lost++; }
      if (awayWon) { a.won++; h.lost++; }
      h.policies += h.round;
      a.policies += a.round;
      lines.push(homeWon ? h.name + ' won by ' + (h.round - a.round) : awayWon ? a.name + ' won by ' + (a.round - h.round) : 'Match tied ' + h.round + ' - ' + a.round);
      h.round = 0;
      a.round = 0;
    }
    this.teams.set(teams);
    this.pushEvent('MatchUpdated', 'Round finalized. ' + lines.join('; ') + '.');
  }

  exportCsv(): void {
    const header = 'Rank,Agent Name,Employee Code,Branch,Region,Tier,Total Policies,Total Points,Total Premium,Retention Rate';
    const lines = this.rows().map((r) => {
      const a = r.agent;
      const share = a.n ? r.n / a.n : 0;
      return [
        r.rank, '"' + a.name + '"', a.code, a.branch, a.region, a.tier,
        r.n, r.pts, (a.premium * share).toFixed(2), a.retention.toFixed(1) + '%',
      ].join(',');
    });
    const blob = new Blob([header + '\n' + lines.join('\n') + '\n'], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'leaderboard-demo.csv';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    this.result.set('Exported ' + lines.length + ' rows to leaderboard-demo.csv (same columns as the real export).');
  }

  /* ---------------- core ---------------- */

  private applySale(id: string, type: string, premium: number): { points: number; upgrade: Tier | null } {
    const s = this.settings();
    const agent = this.agents().find((a) => a.id === id) as Agent;
    const points = calculatePoints(type, agent.tier, s).points;
    const newN = agent.n + 1;
    const newTier = determineNewTier(newN, s);
    const upgrade = newTier !== agent.tier && TIER_ORDER.indexOf(newTier) > TIER_ORDER.indexOf(agent.tier) ? newTier : null;
    const tally = agent.byType[type] ?? { n: 0, pts: 0 };
    const updated: Agent = {
      ...agent,
      n: newN,
      pts: agent.pts + points,
      premium: agent.premium + premium,
      tier: newTier,
      byType: { ...agent.byType, [type]: { n: tally.n + 1, pts: tally.pts + points } },
    };
    this.agents.update((list) => list.map((a) => (a.id === id ? updated : a)));
    this.teams.update((list) => list.map((t) => (t.region === agent.region ? { ...t, round: t.round + 1 } : t)));

    this.pushEvent('PolicySold', agent.name + ' sold a ' + typeLabel(type) + ' policy worth ₹' + fmt(premium) + ' (+' + points + ' pts)');
    if (upgrade) this.pushEvent('TierUpgraded', agent.name + ' reached ' + upgrade + ' tier!');
    const team = this.teams().find((t) => t.region === agent.region) as Team;
    const idx = this.teams().indexOf(team);
    const home = this.teams()[idx - (idx % 2)] as Team;
    const away = this.teams()[idx - (idx % 2) + 1] as Team;
    this.pushEvent('LiveMatchScore', home.name + ' ' + home.round + ' - ' + away.round + ' ' + away.name);
    return { points, upgrade };
  }

  private afterSales(before: Record<string, number>, touched: string[]): void {
    const after = this.rankMap();
    const d: Record<string, number> = {};
    for (const id of Object.keys(after)) d[id] = (before[id] ?? 0) - (after[id] ?? 0);
    this.deltas.set(d);
    const leader = this.rows()[0];
    this.pushEvent('LeaderboardUpdated', 'Board re-ranked, ' + this.agents().length + ' entries. Leader: ' + (leader ? leader.agent.name : 'none') + '.');
    const bump = touched[0] ?? '';
    this.bumpId.set(bump);
    if (this.bumpTimer) clearTimeout(this.bumpTimer);
    this.bumpTimer = setTimeout(() => this.bumpId.set(''), 1100);
  }

  /** Overall rank per agent (no filters) used for the up/down indicator. */
  private rankMap(): Record<string, number> {
    const sorted = [...this.agents()].sort((x, y) => y.n - x.n || y.pts - x.pts);
    const m: Record<string, number> = {};
    sorted.forEach((a, i) => (m[a.id] = i + 1));
    return m;
  }

  private simTick(): void {
    const list = this.agents().filter((a) => a.id !== 'a');
    const agent = list[Math.floor(Math.random() * list.length)] as Agent;
    const type = SIM_TYPES[Math.floor(Math.random() * SIM_TYPES.length)] as string;
    const premium = 8000 + Math.floor(Math.random() * 40) * 1000;
    const before = this.rankMap();
    const first = this.captureFlip();
    const r = this.applySale(agent.id, type, premium);
    this.afterSales(before, [agent.id]);
    if (r.upgrade) this.startCelebration(agent.name + ' reached ' + cap(r.upgrade));
    this.playFlipNextRender(first);
  }

  private stopSim(): void {
    if (this.simTimer) clearInterval(this.simTimer);
    this.simTimer = null;
    this.simulating.set(false);
  }

  private startCelebration(text: string): void {
    this.celebrate.set(text);
    if (this.burstTimer) clearTimeout(this.burstTimer);
    this.burstTimer = setTimeout(() => this.celebrate.set(null), this.device.reducedMotion ? 2600 : 1800);
  }

  private pushEvent(type: FeedEvent['type'], text: string): void {
    const time = new Date().toLocaleTimeString('en-GB');
    const e: FeedEvent = { id: ++this.eventSeq, time, type, text };
    this.events.update((list) => [e, ...list].slice(0, 40));
  }

  /* ---------------- FLIP ---------------- */

  private captureFlip(): Map<string, number> | null {
    if (!this.device.isBrowser || this.device.reducedMotion) return null;
    const m = new Map<string, number>();
    this.host.nativeElement.querySelectorAll<HTMLElement>('[data-flip]').forEach((el) => {
      m.set(el.dataset['flip'] ?? '', el.getBoundingClientRect().top);
    });
    return m;
  }

  private playFlipNextRender(first: Map<string, number> | null): void {
    if (!first) return;
    afterNextRender(
      () => {
        this.host.nativeElement.querySelectorAll<HTMLElement>('[data-flip]').forEach((el) => {
          const from = first.get(el.dataset['flip'] ?? '');
          if (from === undefined) return;
          const dy = from - el.getBoundingClientRect().top;
          if (Math.abs(dy) < 1 || typeof el.animate !== 'function') return;
          el.animate([{ transform: 'translateY(' + dy + 'px)' }, { transform: 'translateY(0)' }], {
            duration: 520,
            easing: 'cubic-bezier(.2,.8,.2,1)',
          });
        });
      },
      { injector: this.injector },
    );
  }

  private withFlip(mutate: () => void): void {
    const first = this.captureFlip();
    mutate();
    this.playFlipNextRender(first);
  }
}
