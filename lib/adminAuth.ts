import { createHmac, timingSafeEqual } from 'node:crypto';
import { NextRequest } from 'next/server';

const ADMIN_TOKEN_TTL_SECONDS = 60 * 60 * 12;

function adminSecret(): string {
  const s = process.env.OWNER_AUTH_SECRET || process.env.ADMIN_PASSWORD;
  if (!s) throw new Error('OWNER_AUTH_SECRET is not configured');
  return s;
}

export function adminPassword(): string {
  return process.env.ADMIN_PASSWORD || 'password';
}

function sign(payloadB64: string): string {
  return createHmac('sha256', adminSecret()).update(payloadB64).digest('base64url');
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function issueAdminToken(): string {
  const payload = { exp: Math.floor(Date.now() / 1000) + ADMIN_TOKEN_TTL_SECONDS, role: 'admin' };
  const payloadB64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = sign(payloadB64);
  return `${payloadB64}.${sig}`;
}

export function verifyAdminToken(token: string): boolean {
  const [payloadB64, providedSig] = token.split('.');
  if (!payloadB64 || !providedSig) return false;
  const expectedSig = sign(payloadB64);
  if (!safeEqual(providedSig, expectedSig)) return false;
  try {
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as { exp?: number; role?: string };
    return payload.role === 'admin' && Number(payload.exp || 0) >= Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

export function isAdminAuthed(req: NextRequest): boolean {
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (token && verifyAdminToken(token)) return true;
  const provided = req.headers.get('x-admin-password');
  return !!provided && provided === adminPassword();
}
