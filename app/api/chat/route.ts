import { NextRequest, NextResponse } from 'next/server';
import { runAssistant, validateChatInput } from '@/lib/ai';
import { getStore } from '@/lib/store';
import { getRequestContext } from '@/lib/observability';
import { verifyWidgetToken } from '@/lib/widgetToken';

const rateMap = new Map<string, { count: number; resetAt: number }>();
// NOTE: In-memory rate limiting doesn't work with multiple server instances.
// For production (e.g., Vercel with multiple instances), use Redis or similar.

function sanitize(text: string): string {
  return text.replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, 1000);
}

function extractHost(origin: string | null): string {
  if (!origin) return '';
  try {
    return new URL(origin).hostname;
  } catch {
    return '';
  }
}

function domainAllowed(host: string, allowedDomains: string[]): boolean {
  const normalized = host.toLowerCase();
  return allowedDomains.some((entry) => {
    const rule = entry.toLowerCase().trim();
    if (!rule) return false;
    if (rule === '*') return true;
    if (rule.startsWith('*.')) return normalized.endsWith(rule.slice(1));
    return normalized === rule;
  });
}

function checkRateLimit(key: string, max = 20, windowMs = 60_000): boolean {
  const now = Date.now();
  const current = rateMap.get(key);
  if (!current || current.resetAt < now) {
    rateMap.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (current.count >= max) return false;
  current.count += 1;
  rateMap.set(key, current);
  return true;
}

export async function POST(req: NextRequest) {
  const ctx = getRequestContext(req, 'POST /api/chat');
  try {
    const body = await req.json();
    const parsed = validateChatInput(body);
    const store = getStore();
    const business = await store.getBusinessConfig(parsed.businessId);
    if (!business) return NextResponse.json({ error: 'Invalid businessId' }, { status: 404 });

    const origin = req.headers.get('origin');
    const host = extractHost(origin);
    const isSameHost = host && host === req.nextUrl.hostname;
    if (host && !isSameHost && !domainAllowed(host, business.allowedDomains)) {
      ctx.log('warn', 'Origin blocked', { businessId: parsed.businessId, host });
      return NextResponse.json({ error: 'Origin not allowed' }, { status: 403 });
    }

    const token = req.headers.get('x-widget-token');
    const tokenCheck = verifyWidgetToken(token, { businessId: parsed.businessId, host: host || req.nextUrl.hostname });
    if (!tokenCheck.ok) {
      ctx.log('warn', 'Widget token rejected', { businessId: parsed.businessId, reason: tokenCheck.reason });
      return NextResponse.json({ error: `Unauthorized widget request: ${tokenCheck.reason}` }, { status: 401 });
    }

    const ip = (req.headers.get('x-forwarded-for') || 'local').split(',')[0].trim();
    if (!checkRateLimit(`${parsed.businessId}:${ip}`)) {
      ctx.log('warn', 'Rate limited', { businessId: parsed.businessId, ip });
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const result = await runAssistant({
      businessId: parsed.businessId,
      sessionId: sanitize(parsed.sessionId),
      message: sanitize(parsed.message)
    });

    const res = NextResponse.json(result);
    if (origin && host && (isSameHost || domainAllowed(host, business.allowedDomains))) {
      res.headers.set('Access-Control-Allow-Origin', origin);
      res.headers.set('Vary', 'Origin');
    }
    ctx.log('info', 'Chat handled', { businessId: parsed.businessId });
    return res;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    ctx.log('error', 'Chat failed', { error: message });
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export const OPTIONS = async (req: NextRequest) => {
  const origin = req.headers.get('origin') || '*';
  const res = new NextResponse(null, { status: 204 });
  res.headers.set('Access-Control-Allow-Origin', origin);
  res.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type, x-widget-token');
  return res;
};
