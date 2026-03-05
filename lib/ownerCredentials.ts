import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7;

function base64UrlEncode(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function tokenSecret(): string {
  const s = process.env.OWNER_AUTH_SECRET || process.env.ADMIN_PASSWORD;
  if (!s) throw new Error('OWNER_AUTH_SECRET is not configured');
  return s;
}

function sign(payloadB64: string): string {
  return createHmac('sha256', tokenSecret()).update(payloadB64).digest('base64url');
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function issueOwnerToken(ownerId: string): string {
  const payload = {
    ownerId,
    exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS
  };
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const sig = sign(payloadB64);
  return `${payloadB64}.${sig}`;
}

export function verifyOwnerToken(token: string): { ownerId: string } | null {
  const [payloadB64, providedSig] = token.split('.');
  if (!payloadB64 || !providedSig) return null;

  const expectedSig = sign(payloadB64);
  const ok = safeEqual(providedSig, expectedSig);
  if (!ok) return null;

  try {
    const payload = JSON.parse(base64UrlDecode(payloadB64)) as { ownerId?: string; exp?: number };
    if (!payload.ownerId || !payload.exp) return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return { ownerId: payload.ownerId };
  } catch {
    return null;
  }
}

export function hashOwnerPassword(password: string): string {
  const salt = randomBytes(16).toString('base64url');
  const derived = scryptSync(password, salt, 64).toString('base64url');
  return `scrypt:${salt}:${derived}`;
}

export function verifyOwnerPassword(password: string, stored: string): boolean {
  const parts = stored.split(':');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const [, salt, expected] = parts;
  const actual = scryptSync(password, salt, 64).toString('base64url');
  return safeEqual(actual, expected);
}

export function getSupabaseServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase credentials are not configured');
  return createClient(url, key);
}
