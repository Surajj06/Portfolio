/**
 * Shared look for every interactive project demo. Each demo component puts
 * `DEMO_STYLES` first in its `styles: [...]` array and adds its own rules after.
 * Everything uses the site's design tokens, so dark/light themes work for free.
 *
 * Markup vocabulary (all classes are scoped to the demo component that uses them):
 *   .demo            outer panel
 *   .demo__bar       title row: <strong class="demo__title"> + <span class="demo__tag">
 *   .demo__body      padded content area
 *   .demo__note      small honest caption under the demo
 *   .field           label + input/select/textarea stack
 *   .row / .col      flex helpers
 *   .pill (+ .ok .warn .bad .info .mute)   status pills
 *   .tbl             compact responsive table wrapper
 *   .kv              small stat tile (strong + span)
 */
export const DEMO_STYLES = `
  :host { display: block; }
  .demo {
    position: relative;
    border: 1px solid var(--line-2);
    border-radius: var(--r-lg);
    background: var(--surface);
    overflow: hidden;
    color: var(--text);
  }
  .demo__bar {
    display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
    padding: 14px 18px;
    border-bottom: 1px solid var(--line);
    background: var(--surface-2);
  }
  .demo__title { font-size: 0.95rem; font-weight: 700; letter-spacing: -0.01em; }
  .demo__tag {
    margin-left: auto;
    font-family: var(--font-mono); font-size: 0.68rem; letter-spacing: 0.08em; text-transform: uppercase;
    color: var(--text-3);
  }
  /* minmax(0,1fr): a wide table must scroll inside its .tbl wrapper, never stretch the card. */
  .demo__body { padding: clamp(14px, 2.4vw, 24px); display: grid; gap: 18px; grid-template-columns: minmax(0, 1fr); }
  .demo__body > *, .col > *, .grid-2 > *, .kvs > * { min-width: 0; }
  .demo__note { margin: 0; padding: 0 clamp(14px, 2.4vw, 24px) clamp(14px, 2.4vw, 22px); font-size: 0.82rem; line-height: 1.5; color: var(--text-3); }

  .row { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
  .col { display: grid; gap: 10px; }
  .grid-2 { display: grid; gap: 18px; grid-template-columns: minmax(0, 1fr); }
  @media (min-width: 860px) { .grid-2 { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); } }

  .field { display: grid; gap: 6px; min-width: 0; }
  .field > span { font-family: var(--font-mono); font-size: 0.68rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-3); }
  .field input, .field select, .field textarea {
    width: 100%; min-height: 44px; padding: 10px 14px;
    border: 1px solid var(--line-2); border-radius: var(--r-sm);
    background: var(--bg-2); color: var(--text);
    font: inherit; font-size: 0.95rem;
  }
  .field textarea { min-height: 96px; resize: vertical; font-family: var(--font-mono); font-size: 0.85rem; }
  .field input:focus-visible, .field select:focus-visible, .field textarea:focus-visible { outline: 2px solid var(--accent-text); outline-offset: 2px; }
  .field input[type='range'] { padding: 0; min-height: 30px; accent-color: var(--lime); }

  .dbtn {
    display: inline-flex; align-items: center; justify-content: center; gap: 8px;
    min-height: 44px; padding: 0 18px;
    border: 1px solid var(--line-2); border-radius: var(--r-pill);
    background: transparent; color: var(--text);
    font: inherit; font-size: 0.9rem; font-weight: 600; cursor: pointer;
    transition: background-color .2s ease, border-color .2s ease, transform .3s var(--ease-out);
  }
  .dbtn:hover:not(:disabled) { border-color: var(--text); background: var(--surface-2); }
  .dbtn:active:not(:disabled) { transform: scale(0.96); }
  .dbtn:disabled { opacity: 0.45; cursor: not-allowed; }
  .dbtn--primary { background: var(--cta-bg); color: var(--cta-ink); border-color: transparent; }
  .dbtn--primary:hover:not(:disabled) { background: var(--cta-bg); border-color: transparent; transform: translateY(-1px); }
  .dbtn--sm { min-height: 36px; padding: 0 14px; font-size: 0.82rem; }
  .dbtn[aria-pressed='true'] { background: var(--accent-soft); border-color: var(--accent-line); }

  .pill {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 3px 10px; border-radius: var(--r-pill);
    font-family: var(--font-mono); font-size: 0.7rem; letter-spacing: 0.04em; text-transform: uppercase;
    border: 1px solid var(--line-2); color: var(--text-2); white-space: nowrap;
  }
  .pill.ok   { color: var(--mint);  border-color: color-mix(in srgb, var(--mint) 45%, transparent);  background: color-mix(in srgb, var(--mint) 10%, transparent); }
  .pill.warn { color: var(--amber); border-color: color-mix(in srgb, var(--amber) 45%, transparent); background: color-mix(in srgb, var(--amber) 10%, transparent); }
  .pill.bad  { color: var(--coral); border-color: color-mix(in srgb, var(--coral) 45%, transparent); background: color-mix(in srgb, var(--coral) 10%, transparent); }
  .pill.info { color: var(--sky);   border-color: color-mix(in srgb, var(--sky) 45%, transparent);   background: color-mix(in srgb, var(--sky) 10%, transparent); }
  .pill.mute { color: var(--text-3); }
  :root[data-theme='light'] .pill.ok   { color: #0b7a55; }
  :root[data-theme='light'] .pill.warn { color: #8a5a00; }
  :root[data-theme='light'] .pill.bad  { color: #b3341a; }
  :root[data-theme='light'] .pill.info { color: #0a6a94; }

  .tbl { max-width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch; border: 1px solid var(--line); border-radius: var(--r-sm); }
  .tbl table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
  .tbl th, .tbl td { padding: 9px 12px; text-align: left; border-bottom: 1px solid var(--line); white-space: nowrap; }
  .tbl th { font-family: var(--font-mono); font-size: 0.66rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-3); background: var(--surface-2); font-weight: 500; }
  .tbl tr:last-child td { border-bottom: 0; }

  .kv { display: grid; gap: 2px; padding: 12px 14px; border: 1px solid var(--line); border-radius: var(--r-sm); background: var(--bg-2); min-width: 0; }
  .kv strong { font-size: 1.25rem; letter-spacing: -0.03em; font-variant-numeric: tabular-nums; }
  .kv span { font-size: 0.74rem; color: var(--text-3); }
  .kvs { display: grid; gap: 10px; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); }

  .log { margin: 0; padding: 12px 14px; list-style: none; display: grid; gap: 6px; max-height: 260px; overflow: auto;
    border: 1px solid var(--line); border-radius: var(--r-sm); background: var(--bg-2);
    font-family: var(--font-mono); font-size: 0.78rem; line-height: 1.45; color: var(--text-2); }
  .log li { display: flex; gap: 10px; align-items: baseline; }
  .log time { color: var(--text-3); flex: none; }

  .hint { margin: 0; font-size: 0.85rem; line-height: 1.5; color: var(--text-2); }
  .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }

  @media (prefers-reduced-motion: reduce) {
    * { animation-duration: 0.001ms !important; animation-iteration-count: 1 !important; transition-duration: 0.001ms !important; }
  }
`;
