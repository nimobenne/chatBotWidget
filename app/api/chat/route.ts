import { NextRequest, NextResponse } from 'next/server';
import { runAssistant, validateChatInput } from '@/lib/ai';
import { getSupabaseStore } from '@/lib/store.supabase';

export const runtime = 'nodejs';

const rateMap = new Map<string, { count: number; resetAt: number }>();

function sanitize(text: string): string {
  return text.replace(/[\u0000-\u001F\u007F]/g, '').trim();
}

function extractHost(origin: string | null): string {
  if (!origin) return '';
  try {
    return new URL(origin).hostname.toLowerCase();
  } catch {
    return '';
  }
}

function domainAllowed(host: string, allowedDomains: string[]): boolean {
  const normalized = host.toLowerCase();
  return allowedDomains.some((entry) => normalized === String(entry).toLowerCase().trim());
}

function checkRateLimit(key: string, max = 30, windowMs = 60_000): boolean {
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
  try {
    const body = await req.json();
    const parsed = validateChatInput(body);
    const sessionId = sanitize(parsed.sessionId);
    const message = sanitize(parsed.message);
    const slug = parsed.businessId || (process.env.NODE_ENV !== 'production' ? 'demo_barber' : '');

    if (!slug) {
      return NextResponse.json({ error: 'Widget misconfigured: businessId missing' }, { status: 400 });
    }

    const store = getSupabaseStore();
    const business = await store.getBusinessBySlug(slug);
    if (!business) {
      return NextResponse.json(
        { error: 'This chat widget is not configured. Please contact the business.' },
        { status: 404 }
      );
    }

    const origin = req.headers.get('origin');
    const host = extractHost(origin);
    const isSameHost = host && host === req.nextUrl.hostname;
    if (host && !isSameHost && !domainAllowed(host, business.allowed_domains || [])) {
      return NextResponse.json({ error: 'Widget not authorized on this domain.' }, { status: 403 });
    }

    const ip = (req.headers.get('x-forwarded-for') || 'local').split(',')[0].trim();
    if (!checkRateLimit(`${slug}:${ip}`)) {
      return NextResponse.json({ error: 'Too many messages, try again soon.' }, { status: 429 });
    }

    const result = await runAssistant({ businessId: slug, sessionId, message });

    const res = NextResponse.json(result);
    if (origin && host && (isSameHost || domainAllowed(host, business.allowed_domains || []))) {
      res.headers.set('Access-Control-Allow-Origin', origin);
      res.headers.set('Vary', 'Origin');
    }
    return res;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export const OPTIONS = async (req: NextRequest) => {
  const origin = req.headers.get('origin') || '*';
  const res = new NextResponse(null, { status: 204 });
  res.headers.set('Access-Control-Allow-Origin', origin);
  res.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  return res;
};
