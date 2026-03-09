import { createHmac, timingSafeEqual } from 'node:crypto';

interface WidgetTokenPayload {
  businessId: string;
  host: string;
  exp: number;
}

function b64urlEncode(input: string): string {
  return Buffer.from(input, 'utf8').toString('base64url');
}

function b64urlDecode(input: string): string {
  return Buffer.from(input, 'base64url').toString('utf8');
}

function secret(): string {
  return (process.env.WIDGET_SIGNING_SECRET || '').trim();
}

export function widgetTokenRequired(): boolean {
  return String(process.env.WIDGET_TOKEN_REQUIRED || '').toLowerCase() === 'true';
}

export function signWidgetToken(params: { businessId: string; host: string; ttlSeconds?: number }): string | null {
  const sec = secret();
  if (!sec) return null;
  const payload: WidgetTokenPayload = {
    businessId: params.businessId,
    host: params.host,
    exp: Math.floor(Date.now() / 1000) + (params.ttlSeconds || 60 * 60)
  };
  const payloadB64 = b64urlEncode(JSON.stringify(payload));
  const sig = createHmac('sha256', sec).update(payloadB64).digest('base64url');
  return `${payloadB64}.${sig}`;
}

export function verifyWidgetToken(
  token: string | null,
  expected: { businessId: string; host: string }
): { ok: boolean; reason?: string } {
  const sec = secret();
  if (!sec) {
    // In production, always block if no signing secret is configured — prevents OpenAI cost abuse.
    if (process.env.NODE_ENV === 'production') {
      return { ok: false, reason: 'Widget signing secret not configured' };
    }
    return widgetTokenRequired() ? { ok: false, reason: 'Widget signing secret missing' } : { ok: true };
  }
  if (!token) return { ok: false, reason: 'Missing widget token' };

  const [payloadB64, sig] = token.split('.');
  if (!payloadB64 || !sig) return { ok: false, reason: 'Malformed widget token' };

  const expectedSig = createHmac('sha256', sec).update(payloadB64).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
    return { ok: false, reason: 'Invalid widget token signature' };
  }

  let payload: WidgetTokenPayload;
  try {
    payload = JSON.parse(b64urlDecode(payloadB64)) as WidgetTokenPayload;
  } catch {
    return { ok: false, reason: 'Invalid widget token payload' };
  }

  if (payload.businessId !== expected.businessId) return { ok: false, reason: 'Business mismatch' };
  if (payload.host !== expected.host) return { ok: false, reason: 'Host mismatch' };
  if (payload.exp < Math.floor(Date.now() / 1000)) return { ok: false, reason: 'Widget token expired' };

  return { ok: true };
}
