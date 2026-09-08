import type { VercelRequest, VercelResponse } from '@vercel/node';
import nodemailer from 'nodemailer';

/**
 * Contact-form endpoint, deployed as a Vercel serverless function so the
 * whole site (frontend + this) ships as one project/domain — no separate
 * backend host, no CORS. Ports the validation/honeypot/sanitize/SMTP-send
 * behavior that previously lived in backend/PortfolioApi (kept in the repo
 * for local dev only; this is what actually runs in production).
 *
 * Required env vars (set in the Vercel dashboard, never committed):
 *   SMTP_HOST, SMTP_PORT, SMTP_SECURE ("true"/"false"), SMTP_USERNAME,
 *   SMTP_PASSWORD, SMTP_FROM_ADDRESS, CONTACT_EMAIL, CONTACT_DISPLAY_NAME
 */

interface ContactBody {
  name?: unknown;
  email?: unknown;
  message?: unknown;
  website?: unknown; // honeypot -- real users never populate this
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const WHITESPACE_RUN_RE = /\s{3,}/g;

// Drops ASCII control characters (code points 0-8, 11, 12, 14-31) using
// explicit char-code comparisons rather than a \u-escaped regex, so there
// are no invisible/non-printable bytes sitting in the source file itself.
function stripControlChars(input: string): string {
  let out = '';
  for (let i = 0; i < input.length; i++) {
    const code = input.charCodeAt(i);
    const isControl = code <= 8 || code === 11 || code === 12 || (code >= 14 && code <= 31);
    if (!isControl) out += input[i];
  }
  return out;
}

function sanitize(input: string): string {
  const trimmed = input.trim();
  const withoutControlChars = stripControlChars(trimmed);
  return withoutControlChars.replace(WHITESPACE_RUN_RE, '  ');
}

function validate(body: ContactBody): string | null {
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const message = typeof body.message === 'string' ? body.message.trim() : '';

  if (name.length < 2 || name.length > 120) return 'Name must be between 2 and 120 characters.';
  if (!email || email.length > 254 || !EMAIL_RE.test(email)) return 'A valid email address is required.';
  if (message.length < 10 || message.length > 4000) return 'Message must be between 10 and 4000 characters.';
  return null;
}

// Best-effort in-memory rate limit -- resets on cold start, and isn't shared
// across concurrent instances, so it's a speed bump against casual abuse
// rather than a hard guarantee. Good enough for a low-traffic contact form
// without adding an external store (Vercel KV/Upstash) just for this.
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60_000;
const hitsByIp = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const hits = (hitsByIp.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  hits.push(now);
  hitsByIp.set(ip, hits);
  return hits.length > RATE_LIMIT;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ success: false, message: 'Method not allowed.' });
  }

  const ip = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ?? req.socket.remoteAddress ?? 'unknown';
  if (isRateLimited(ip)) {
    return res.status(429).json({ success: false, message: 'Too many requests. Please try again in a minute.' });
  }

  const body = (req.body ?? {}) as ContactBody;

  // Honeypot: a hidden field real visitors never fill in. Respond with a
  // generic success so bots don't learn the honeypot exists.
  if (typeof body.website === 'string' && body.website.trim() !== '') {
    return res.status(200).json({ success: true, message: 'Thanks -- your message has been sent.' });
  }

  const validationError = validate(body);
  if (validationError) {
    return res.status(400).json({ success: false, message: validationError });
  }

  const name = sanitize(String(body.name));
  const email = String(body.email).trim();
  const message = sanitize(String(body.message));

  const smtpHost = process.env['SMTP_HOST'];
  const recipientEmail = process.env['CONTACT_EMAIL'];
  const recipientName = process.env['CONTACT_DISPLAY_NAME'] || 'Suraj Jha';

  if (!smtpHost || !recipientEmail) {
    // No email provider configured yet -- log so the submission is never
    // silently lost, matching the previous backend's local-dev fallback.
    console.info('Contact form submission received (SMTP not configured):', { name, email, receivedAt: new Date().toISOString() });
    return res.status(200).json({ success: true, message: 'Thanks -- your message has been sent.' });
  }

  try {
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: Number(process.env['SMTP_PORT'] ?? 587),
      secure: process.env['SMTP_SECURE'] === 'true',
      auth: {
        user: process.env['SMTP_USERNAME'],
        pass: process.env['SMTP_PASSWORD']
      }
    });

    await transporter.sendMail({
      from: { address: process.env['SMTP_FROM_ADDRESS'] || process.env['SMTP_USERNAME'] || '', name: recipientName },
      to: { address: recipientEmail, name: recipientName },
      replyTo: { address: email, name },
      subject: `Portfolio contact form -- ${name}`,
      text: `Name: ${name}\nEmail: ${email}\nReceived: ${new Date().toISOString()}\n\n${message}`
    });

    return res.status(200).json({ success: true, message: 'Thanks -- your message has been sent.' });
  } catch (err) {
    console.error('Failed to send contact form email:', err);
    return res.status(500).json({ success: false, message: 'Something went wrong. Please try again shortly.' });
  }
}
