import type { VercelRequest, VercelResponse } from '@vercel/node';
import { buildSystemPrompt, offlineAnswer, relatedLinks, retrieve } from './_rag';
import { compactHistory, responsePlan } from './_chat-policy';
import { Provider, UpstreamError, createRateLimiter, errorCode, failureReason, originAllowed, post, redact, resolveProvider, cleanText } from './_llm';

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
 *   GROQ_API_KEY (preferred)               → Groq (default: openai/gpt-oss-20b)
 *   GEMINI_API_KEY                         → Gemini's OpenAI-compatible endpoint
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
const rateLimited = createRateLimiter(6, 30);

const MAX_MESSAGES = 7;
const MAX_USER_CHARS = 600;
const MAX_ASSISTANT_CHARS = 1200;
const MAX_REPLY_CHARS = 6500;
const UPSTREAM_TIMEOUT_MS = 25_000;

// ------------------------------------------------------------------ guards ---

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
    if (last && last.role === role) last.content = `${last.content}\n${text}`.slice(-(role === 'user' ? MAX_USER_CHARS : MAX_ASSISTANT_CHARS));
    else messages.push({ role, content: text });
  }
  while (messages[0]?.role === 'assistant') messages.shift();
  return messages.length && messages[messages.length - 1].role === 'user' ? messages : null;
}

/** The model that last answered successfully on this instance — tried first next time. */
let preferredModel: string | undefined;

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

async function* streamModel(provider: Provider, system: string, messages: ChatMessage[], signal: AbortSignal): AsyncGenerator<string> {
  const plan = responsePlan(messages[messages.length - 1].content);
  if (provider.kind === 'anthropic') {
    const res = await post(
      `${provider.base}/v1/messages`,
      { 'x-api-key': provider.key, 'anthropic-version': '2023-06-01' },
      { model: provider.model, max_tokens: plan.tokens, temperature: 0.3, system, messages, stream: true },
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
    throw new UpstreamError('incomplete stream', 502, 'Stream ended without a completion event');
  }

  const res = await post(
    `${provider.base}/chat/completions`,
    { authorization: `Bearer ${provider.key}` },
    {
      model: provider.model,
      max_completion_tokens: plan.tokens + (provider.model.startsWith('openai/gpt-oss-') ? 512 : 0),
      ...(provider.model.startsWith('openai/gpt-oss-') ? { reasoning_effort: 'low', include_reasoning: false } : {}),
      temperature: 0.3,
      stream: true,
      messages: [{ role: 'system', content: system }, ...messages]
    },
    signal
  );
  for await (const data of sseData(res.body!)) {
    if (data === '[DONE]') return;
    try {
      const event = JSON.parse(data) as { error?: { message?: string }; choices?: { delta?: { content?: string }; finish_reason?: string }[] };
      if (event.error) throw new UpstreamError('stream error', 500, event.error.message ?? '');
      const delta = event.choices?.[0]?.delta?.content;
      if (delta) yield delta;
      if (event.choices?.[0]?.finish_reason === 'length') throw new UpstreamError('output limit', 502, 'Reply reached the completion limit');
    } catch (err) {
      if (err instanceof UpstreamError) throw err;
      /* keep-alive or partial frame */
    }
  }
  throw new UpstreamError('incomplete stream', 502, 'Stream ended without a completion event');
}

// ----------------------------------------------------------------- handler ---

// Per-instance backoff prevents repeated requests during a provider cooldown.
// Groq's organization-wide limits remain the authoritative free-tier backstop.
let cooldownUntil = 0;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }
  if (!originAllowed(req)) return res.status(403).json({ error: 'Forbidden.' });

  const ip = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ?? req.socket?.remoteAddress ?? 'unknown';
  if (rateLimited(ip)) {
    res.setHeader('Retry-After', '60');
    return res.status(429).json({ error: 'You are sending messages quickly — please try again in a minute.' });
  }

  const messages = parseMessages(req.body);
  if (!messages) return res.status(400).json({ error: 'Send a "messages" array that ends with a user message.' });

  const question = messages[messages.length - 1].content;
  const earlier = messages.slice(0, -1).filter((m) => m.role === 'user').map((m) => m.content);
  const found = retrieve(question, earlier);
  const provider = resolveProvider();
  const history = compactHistory(messages);

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
  let reason = provider ? undefined : 'not-configured';
  let interrupted = false;
  send({ type: 'meta', mode, reason, related: relatedLinks(found.chunks) });

  try {
    if (provider) {
      const system = buildSystemPrompt(found.chunks, question);
      const candidates = [...new Set([preferredModel, provider.model, ...(provider.fallbackModels ?? [])])].filter((m): m is string => !!m);
      let failure: unknown;
      for (const model of candidates) {
        try {
          if (Date.now() < cooldownUntil) throw new UpstreamError('cooldown', 429, '');
          for await (const delta of streamModel({ ...provider, model }, system, history, controller.signal)) {
            const text = delta.slice(0, MAX_REPLY_CHARS - produced);
            produced += text.length;
            send({ type: 'delta', text });
            if (produced >= MAX_REPLY_CHARS) { interrupted = true; break; }
          }
          if (!produced) throw new UpstreamError('empty response', 502, 'No answer text received');
          preferredModel = model;
          failure = undefined;
          break;
        } catch (err) {
          failure = err;
          if (err instanceof UpstreamError && err.status === 429 && err.retryAfter) cooldownUntil = Date.now() + err.retryAfter * 1000;
          // Never leak upstream details to visitors; keep them in the function logs.
          const info = err instanceof UpstreamError ? `${err.status} ${err.detail}` : err instanceof Error ? `${err.name}: ${err.message}` : String(err);
          console.error(`Chat model call failed (${model}):`, redact(info));
          // Only a rejected *model name* is worth retrying with another model.
          if (produced || failureReason(err) !== 'model') break;
        }
      }
      if (failure && !produced) {
        mode = 'retrieval';
        reason = failureReason(failure);
        send({ type: 'meta', mode, reason, code: failure instanceof UpstreamError ? failure.code : undefined, related: relatedLinks(found.chunks) });
      }
      if (failure && produced) interrupted = true;
    }
    if (!produced) {
      // No key configured, or the model was unreachable: answer from the retrieved facts.
      for (const part of offlineAnswer(question, found).split(/(?<=\n\n)/)) send({ type: 'delta', text: part });
      if (mode !== 'retrieval') send({ type: 'meta', mode: 'retrieval', reason: 'provider' });
    }
    if (interrupted) send({ type: 'meta', mode: 'model', reason: 'interrupted' });
    send({ type: 'done' });
  } finally {
    clearTimeout(timer);
    controller.abort();
    res.end();
  }
}
