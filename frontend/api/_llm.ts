/**
 * Shared plumbing for the model-backed endpoints (api/chat.ts and api/voice.ts):
 * provider selection from environment keys, upstream error handling, the
 * same-origin check and a small per-IP rate limiter. Files starting with an
 * underscore are not deployed as functions.
 */
import type { VercelRequest } from '@vercel/node';

export interface Provider {
  kind: 'anthropic' | 'openai';
  key: string;
  base: string;
  model: string;
  /** Tried in order if `model` is rejected as unknown / not accessible. */
  fallbackModels?: string[];
}


/**
 * Best-effort, per-instance rate limiter (see api/contact.ts for the same trade-off):
 * a speed bump against casual abuse, not a hard guarantee. Set a spend limit with
 * your model provider as the real backstop.
 */
export function createRateLimiter(perMinute: number, perHour: number): (ip: string) => boolean {
  const hits = new Map<string, number[]>();
  return (ip: string): boolean => {
    const now = Date.now();
    const recent = (hits.get(ip) ?? []).filter((t) => now - t < 3_600_000);
    recent.push(now);
    hits.set(ip, recent);
    if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < 3_600_000)) hits.delete(k);
    return recent.length > perHour || recent.filter((t) => now - t < 60_000).length > perMinute;
  };
}

export function allowedHosts(): Set<string> {
  const env = process.env;
  const hosts = new Set(['aisurajjha.in', 'www.aisurajjha.in', 'localhost', '127.0.0.1']);
  for (const v of [env['VERCEL_URL'], env['VERCEL_BRANCH_URL'], env['VERCEL_PROJECT_PRODUCTION_URL']]) if (v) hosts.add(v.replace(/^https?:\/\//, ''));
  for (const v of (env['CHAT_ALLOWED_ORIGINS'] ?? '').split(',')) if (v.trim()) hosts.add(v.trim().replace(/^https?:\/\//, ''));
  return hosts;
}

/** Browsers always send Origin on cross-site POSTs; reject any that isn't this site. */
export function originAllowed(req: VercelRequest): boolean {
  const origin = req.headers['origin'];
  if (!origin || typeof origin !== 'string') return true; // non-browser callers carry no cross-site risk
  try {
    const url = new URL(origin);
    return allowedHosts().has(url.host) || allowedHosts().has(url.hostname);
  } catch {
    return false;
  }
}

export function cleanText(input: string, max: number): string {
  let out = '';
  for (let i = 0; i < input.length && out.length < max * 2; i++) {
    const code = input.charCodeAt(i);
    if (code <= 8 || code === 11 || code === 12 || (code >= 14 && code <= 31)) continue; // control chars
    out += input[i];
  }
  return out.replace(/\s{3,}/g, '  ').trim().slice(0, max);
}


/** Best guess at the caller's IP for rate limiting (Vercel sets x-forwarded-for). */
export function clientIp(req: { headers: Record<string, unknown>; socket?: { remoteAddress?: string } }): string {
  return (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ?? req.socket?.remoteAddress ?? 'unknown';
}

// --------------------------------------------------------------- providers ---

export function resolveProvider(): Provider | null {
  const env = process.env;
  // Keys are trimmed: a stray space or newline from copy-paste makes the Authorization header invalid.
  const key = (name: string) => env[name]?.trim() || undefined;
  const model = env['CHAT_MODEL']?.trim();
  const trim = (u: string) => u.trim().replace(/\/+$/, '');
  // This portfolio uses Groq's free plan. Prefer its key over unrelated keys
  // left on the project, and recover from stale/retired CHAT_MODEL values.
  if (key('GROQ_API_KEY')) {
    return {
      kind: 'openai', key: key('GROQ_API_KEY')!,
      base: trim(env['GROQ_BASE_URL'] || 'https://api.groq.com/openai/v1'),
      model: model || 'openai/gpt-oss-20b',
      fallbackModels: ['openai/gpt-oss-20b', 'openai/gpt-oss-120b']
    };
  }
  if (key('ANTHROPIC_API_KEY')) {
    return { kind: 'anthropic', key: key('ANTHROPIC_API_KEY')!, base: trim(env['ANTHROPIC_BASE_URL'] || 'https://api.anthropic.com'), model: model || 'claude-haiku-4-5-20251001' };
  }
  if (key('OPENAI_API_KEY')) {
    return { kind: 'openai', key: key('OPENAI_API_KEY')!, base: trim(env['OPENAI_BASE_URL'] || 'https://api.openai.com/v1'), model: model || 'gpt-4o-mini' };
  }
  if (key('GEMINI_API_KEY')) {
    return { kind: 'openai', key: key('GEMINI_API_KEY')!, base: trim(env['OPENAI_BASE_URL'] || 'https://generativelanguage.googleapis.com/v1beta/openai'), model: model || 'gemini-2.5-flash' };
  }
  return null;
}

/** The provider's own machine-readable error code (e.g. "model_not_found"), if it sent a safe-looking one. */
export function errorCode(detail: string): string | undefined {
  try {
    const parsed = JSON.parse(detail) as { error?: { code?: unknown; type?: unknown } | string };
    const code = typeof parsed.error === 'object' ? (parsed.error?.code ?? parsed.error?.type) : undefined;
    return typeof code === 'string' && /^[A-Za-z0-9_.-]{1,48}$/.test(code) ? code : undefined;
  } catch {
    return undefined;
  }
}

/** Strips anything that looks like a credential before it can reach a log line. */
export function redact(text: string): string {
  return text.replace(/Bearer\s+\S+/gi, 'Bearer [redacted]').replace(/\b(gsk_|sk-|AIza)[A-Za-z0-9_-]+/g, '[redacted]');
}

/** A coarse, safe-to-share reason the model wasn't used (no secrets, no upstream text). */
export function failureReason(err: unknown): string {
  if (err instanceof UpstreamError) {
    if (err.status === 401 || err.status === 403) return 'auth';
    if (err.status === 404) return 'model';
    if (err.status === 400) return /model_(?:not_found|decommissioned|not_supported)|does not exist|decommissioned|no longer supported/i.test(err.detail) ? 'model' : 'request';
    if (err.status === 429) return 'rate-limit';
    if (err.status >= 500) return 'provider';
    return 'upstream';
  }
  if (err instanceof Error) {
    if (err.name === 'AbortError') return 'timeout';
    if (/invalid header|invalid character/i.test(err.message)) return 'key-format';
  }
  return 'network';
}

export class UpstreamError extends Error {
  readonly code?: string;
  constructor(message: string, readonly status: number, readonly detail: string, readonly retryAfter?: number) {
    super(message);
    this.code = errorCode(detail);
  }
}

export async function post(url: string, headers: Record<string, string>, payload: Record<string, unknown>, signal: AbortSignal): Promise<Response> {
  const send = (body: Record<string, unknown>) => fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body), signal });
  let res = await send(payload);
  if (res.status === 400 && 'temperature' in payload) {
    // A few newer models refuse an explicit temperature — retry once without it.
    const text = await res.text();
    if (/temperature/i.test(text)) {
      const { temperature: _drop, ...rest } = payload;
      res = await send(rest);
    } else {
      throw new UpstreamError('bad request', 400, text.slice(0, 300));
    }
  }
  if (!res.ok || !res.body) throw new UpstreamError(`upstream ${res.status}`, res.status, (await res.text().catch(() => '')).slice(0, 300), Math.min(3600, Math.max(1, Number(res.headers.get('retry-after')) || 60)));
  return res;
}

