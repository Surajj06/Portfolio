export interface Message { role: 'user' | 'assistant'; content: string }
export type ReplySize = 'short' | 'standard' | 'detailed';

// A conservative estimate, not the provider's tokenizer. Budgets include UTF-8
// text so non-English input cannot bypass limits through a character-count cap.
export const estimateTokens = (text: string): number => Math.ceil(Buffer.byteLength(text, 'utf8') / 3);
export const MAX_CONTEXT_TOKENS = 1250;
export const MAX_HISTORY_TOKENS = 450;

export function responsePlan(question: string): { size: ReplySize; tokens: number; instruction: string } {
  if (/\b(short|brief\w*|concise|one[- ](sentence|line)|quick|tl;?dr|summari[sz]e)\b/i.test(question)) {
    return { size: 'short', tokens: 160, instruction: 'Answer in 1–2 sentences, at most 60 words. Honor a request for one sentence.' };
  }
  if (/\b(detail\w*|in[- ]depth|explain|architecture|compare|comparison|step[- ]by[- ]step|how .*work|tell me more|elaborate|long(er)?)\b/i.test(question)) {
    return { size: 'detailed', tokens: 720, instruction: 'Give a useful explanation, up to 260 words. Use a few short paragraphs or bullets, covering only what was asked. Stop sooner if the documents contain little evidence.' };
  }
  return { size: 'standard', tokens: 360, instruction: 'Match the question: one sentence for a simple fact, otherwise 2–5 sentences or a short list, at most 130 words. No boilerplate closing question.' };
}

export function trimToTokens(text: string, budget: number): string {
  let out = text;
  while (out && estimateTokens(out) > budget) out = out.slice(0, Math.max(0, Math.floor(out.length * 0.9)));
  return out;
}

export function compactHistory(messages: Message[]): Message[] {
  const latest = messages[messages.length - 1];
  let remaining = MAX_HISTORY_TOKENS;
  const history: Message[] = [];
  for (let i = messages.length - 2; i >= 0 && history.length < 4; i--) {
    const m = messages[i];
    const content = trimToTokens(m.content, Math.min(remaining - 8, m.role === 'assistant' ? 180 : 140));
    if (!content || remaining < 30) break;
    history.unshift({ ...m, content });
    remaining -= estimateTokens(content) + 8;
  }
  while (history[0]?.role === 'assistant') history.shift();
  return [...history, latest];
}
