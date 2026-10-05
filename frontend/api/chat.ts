import type { VercelRequest, VercelResponse } from '@vercel/node';
import { buildSystemPrompt, offlineAnswer, relatedLinks, retrieve } from './_rag';

/**
 * Portfolio assistant endpoint (RAG chat) — a Vercel serverless function in the
 * same project/domain as the site, so there is no separate backend and no CORS.
 *
 * Flow per request:  validate → rate-limit → retrieve the relevant facts about
 * Suraj (api/_rag.ts) → ask a language model to answer *only* from them, streaming
 * the reply back as server-sent events.
 *
 * Which model? Whichever key is configured in the Vercel dashboard (never in code):
 *   ANTHROPIC_API_KEY                      → Claude (default model: claude-haiku-4-5-20251001)
 *   OPENAI_API_KEY                         → OpenAI-compatible chat API (default: gpt-4o-mini)
 *   GEMINI_API_KEY / GROQ_API_KEY          → via their OpenAI-compatible endpoints
 *   CHAT_MODEL        (optional)           → override the model name
 *   OPENAI_BASE_URL / ANTHROPIC_BASE_URL   → point at another compatible host
 *   CHAT_ALLOWED_ORIGINS (optional, CSV)   → extra allowed browser origins
 * With no key (or if the model is unreachable) it still answers — extractively,
 * straight from the retrieved facts — so the widget never dead-ends.
 */

type Role = 'user' | 'assistant';
interface ChatMessage {
  role: Role;
  content: string;
}
interface Provider {
  kind: 'anthropic' | 'openai';
  key: string;
  base: string;
  model: string;
}

const MAX_MESSAGES = 12;
const MAX_USER_CHARS = 600;
const MAX_ASSISTANT_CHARS = 2500;
const MAX_OUTPUT_TOKENS = 450;
const MAX_REPLY_CHARS = 3000;
const UPSTREAM_TIMEOUT_MS = 25_000;

// ------------------------------------------------------------------ guards ---

// Best-effort, per-instance rate limits (see api/contact.ts for the same trade-off):
// a speed bump against casual abuse, not a hard guarantee. Set a spend limit with
// your model provider as the real backstop.
const PER_MINUTE = 10;
const PER_HOUR = 60;
const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 3_600_000);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < 3_600_000)) hits.delete(k);
  return recent.length > PER_HOUR || recent.filter((t) => now - t < 60_000).length > PER_MINUTE;
}

function allowedHosts(): Set<string> {
  const env = process.env;
  const hosts = new Set(['aisurajjha.in', 'www.aisurajjha.in', 'localhost', '127.0.0.1']);
  for (const v of [env['VERCEL_URL'], env['VERCEL_BRANCH_URL'], env['VERCEL_PROJECT_PRODUCTION_URL']]) if (v) hosts.add(v.replace(/^https?:\/\//, ''));
  for (const v of (env['CHAT_ALLOWED_ORIGINS'] ?? '').split(',')) if (v.trim()) hosts.add(v.trim().replace(/^https?:\/\//, ''));
  return hosts;
}

/** Browsers always send Origin on cross-site POSTs; reject any that isn't this site. */
function originAllowed(req: VercelRequest): boolean {
  const origin = req.headers['origin'];
  if (!origin || typeof origin !== 'string') return true; // non-browser callers carry no cross-site risk
  try {
    const url = new URL(origin);
    return allowedHosts().has(url.host) || allowedHosts().has(url.hostname);
  } catch {
    return false;
  }
}

function cleanText(input: string, max: number): string {
  let out = '';
  for (let i = 0; i < input.length && out.length < max * 2; i++) {
    const code = input.charCodeAt(i);
    if (code <= 8 || code === 11 || code === 12 || (code >= 14 && code <= 31)) continue; // control chars
    out += input[i];
  }
  return out.replace(/\s{3,}/g, '  ').trim().slice(0, max);
}

function parseMessages(body: unknown): ChatMessage[] | null {
  let data: unknown = body;
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch {
      return null;
    }
  }
  const raw = (data as { messages?: unknown } | null)?.messages;
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 40) return null;

  const messages: ChatMessage[] = [];
  for (const item of raw.slice(-MAX_MESSAGES)) {
    const role = (item as { role?: unknown })?.role;
    const content = (item as { content?: unknown })?.content;
    if ((role !== 'user' && role !== 'assistant') || typeof content !== 'string') return null;
    const text = cleanText(content, role === 'user' ? MAX_USER_CHARS : MAX_ASSISTANT_CHARS);
    if (!text) continue;
    const last = messages[messages.length - 1];
    if (last && last.role === role) last.content += `\n${text}`; // providers want alternating turns
    else messages.push({ role, content: text });
  }
  while (messages[0]?.role === 'assistant') messages.shift();
  return messages.length && messages[messages.length - 1].role === 'user' ? messages : null;
}

// --------------------------------------------------------------- providers ---

function resolveProvider(): Provider | null {
  const env = process.env;
  const model = env['CHAT_MODEL']?.trim();
  const trim = (u: string) => u.replace(/\/+$/, '');
  if (env['ANTHROPIC_API_KEY']) {
    return { kind: 'anthropic', key: env['ANTHROPIC_API_KEY'], base: trim(env['ANTHROPIC_BASE_URL'] || 'https://api.anthropic.com'), model: model || 'claude-haiku-4-5-20251001' };
  }
  if (env['OPENAI_API_KEY']) {
    return { kind: 'openai', key: env['OPENAI_API_KEY'], base: trim(env['OPENAI_BASE_URL'] || 'https://api.openai.com/v1'), model: model || 'gpt-4o-mini' };
  }
  if (env['GEMINI_API_KEY']) {
    return { kind: 'openai', key: env['GEMINI_API_KEY'], base: trim(env['OPENAI_BASE_URL'] || 'https://generativelanguage.googleapis.com/v1beta/openai'), model: model || 'gemini-2.5-flash' };
  }
  if (env['GROQ_API_KEY']) {
    return { kind: 'openai', key: env['GROQ_API_KEY'], base: trim(env['OPENAI_BASE_URL'] || 'https://api.groq.com/openai/v1'), model: model || 'llama-3.1-8b-instant' };
  }
  return null;
}

/** Yields the `data:` payload of each server-sent event in a streaming response. */
async function* sseData(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let cut: number;
      while ((cut = buffer.search(/\r?\n\r?\n/)) !== -1) {
        const event = buffer.slice(0, cut);
        buffer = buffer.slice(cut).replace(/^\r?\n\r?\n/, '');
        const data = event
          .split(/\r?\n/)
          .filter((l) => l.startsWith('data:'))
          .map((l) => l.slice(5).trimStart())
          .join('\n');
        if (data) yield data;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

class UpstreamError extends Error {
  constructor(message: string, readonly status: number, readonly detail: string) {
    super(message);
  }
}

async function post(url: string, headers: Record<string, string>, payload: Record<string, unknown>, signal: AbortSignal): Promise<Response> {
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
  if (!res.ok || !res.body) throw new UpstreamError(`upstream ${res.status}`, res.status, (await res.text().catch(() => '')).slice(0, 300));
  return res;
}

async function* streamModel(provider: Provider, system: string, messages: ChatMessage[], signal: AbortSignal): AsyncGenerator<string> {
  if (provider.kind === 'anthropic') {
    const res = await post(
      `${provider.base}/v1/messages`,
      { 'x-api-key': provider.key, 'anthropic-version': '2023-06-01' },
      { model: provider.model, max_tokens: MAX_OUTPUT_TOKENS, temperature: 0.3, system, messages, stream: true },
      signal
    );
    for await (const data of sseData(res.body!)) {
      let event: { type?: string; delta?: { type?: string; text?: string }; error?: { message?: string } };
      try {
        event = JSON.parse(data);
      } catch {
        continue;
      }
      if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta' && event.delta.text) yield event.delta.text;
      else if (event.type === 'error') throw new UpstreamError('stream error', 500, event.error?.message ?? '');
      else if (event.type === 'message_stop') return;
    }
    return;
  }

  const res = await post(
    `${provider.base}/chat/completions`,
    { authorization: `Bearer ${provider.key}` },
    {
      model: provider.model,
      max_tokens: MAX_OUTPUT_TOKENS,
      temperature: 0.3,
      stream: true,
      messages: [{ role: 'system', content: system }, ...messages]
    },
    signal
  );
  for await (const data of sseData(res.body!)) {
    if (data === '[DONE]') return;
    try {
      const delta = (JSON.parse(data) as { choices?: { delta?: { content?: string } }[] }).choices?.[0]?.delta?.content;
      if (delta) yield delta;
    } catch {
      /* keep-alive or partial frame */
    }
  }
}

// ----------------------------------------------------------------- handler ---

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }
  if (!originAllowed(req)) return res.status(403).json({ error: 'Forbidden.' });

  const ip = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ?? req.socket?.remoteAddress ?? 'unknown';
  if (rateLimited(ip)) return res.status(429).json({ error: 'You are sending messages quickly — please try again in a minute.' });

  const messages = parseMessages(req.body);
  if (!messages) return res.status(400).json({ error: 'Send a "messages" array that ends with a user message.' });

  const question = messages[messages.length - 1].content;
  const earlier = messages.slice(0, -1).filter((m) => m.role === 'user').map((m) => m.content);
  const found = retrieve(question, earlier);
  const provider = resolveProvider();

  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('X-Accel-Buffering', 'no');
  const send = (event: Record<string, unknown>) => void res.write(`data: ${JSON.stringify(event)}\n\n`);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  res.on('close', () => controller.abort());

  let produced = 0;
  let mode: 'model' | 'retrieval' = provider ? 'model' : 'retrieval';
  send({ type: 'meta', mode, related: relatedLinks(found.chunks) });

  try {
    if (provider) {
      try {
        for await (const delta of streamModel(provider, buildSystemPrompt(found.chunks), messages, controller.signal)) {
          produced += delta.length;
          send({ type: 'delta', text: delta });
          if (produced > MAX_REPLY_CHARS) break;
        }
      } catch (err) {
        // Never leak upstream details to visitors; keep them in the function logs.
        const info = err instanceof UpstreamError ? `${err.status} ${err.detail}` : err instanceof Error ? err.message : String(err);
        console.error('Chat model call failed:', info);
        if (!produced) {
          mode = 'retrieval';
          send({ type: 'meta', mode, related: relatedLinks(found.chunks) });
        }
      }
    }
    if (!produced) {
      // No key configured, or the model was unreachable: answer from the retrieved facts.
      for (const part of offlineAnswer(question, found).split(/(?<=\n\n)/)) send({ type: 'delta', text: part });
    }
    send({ type: 'done' });
  } finally {
    clearTimeout(timer);
    res.end();
  }
}
