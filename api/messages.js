export const config = { runtime: 'edge' };

// Allowed origins — set ALLOWED_ORIGINS in Vercel env vars as comma-separated URLs
// e.g. "https://mhardolkar-family-recipe-agent.vercel.app,https://yourdomain.com"
// Leave unset to allow all origins (dev mode).
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : [];

const MAX_MESSAGES   = 20;      // max conversation turns per request
const MAX_BODY_CHARS = 16_000;  // ~4k tokens of input; blocks runaway payloads
const MAX_TOKENS_CAP = 1024;    // server-side ceiling — client cannot exceed this

function isAllowedOrigin(req) {
  if (ALLOWED_ORIGINS.length === 0) return true;
  const origin = req.headers.get('origin') || req.headers.get('referer') || '';
  return ALLOWED_ORIGINS.some(allowed => origin.startsWith(allowed));
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  if (!isAllowedOrigin(req)) {
    return json({ error: { message: 'Forbidden' } }, 403);
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return json({ error: { message: 'API key not configured on server.' } }, 500);
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  // Input validation — same pattern as the food app's size guards
  const messages = body.messages;
  if (!Array.isArray(messages) || messages.length === 0) {
    return json({ error: { message: 'messages must be a non-empty array.' } }, 400);
  }
  if (messages.length > MAX_MESSAGES) {
    return json({ error: { message: `Too many messages (max ${MAX_MESSAGES}).` } }, 400);
  }
  if (JSON.stringify(messages).length > MAX_BODY_CHARS) {
    return json({ error: { message: 'Request body too large.' } }, 400);
  }

  // Model and token cap set server-side — never trust the client for these
  body.model = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001';
  body.max_tokens = Math.min(body.max_tokens || MAX_TOKENS_CAP, MAX_TOKENS_CAP);
  delete body.stream; // always non-streaming to avoid 30s Edge timeout

  const upstream = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await upstream.json();
  return json(data, upstream.status);
}
