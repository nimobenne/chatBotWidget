import { NextRequest, NextResponse } from 'next/server';
import { getStore } from '@/lib/store';
import { signWidgetToken } from '@/lib/widgetToken';
import { getRequestContext } from '@/lib/observability';

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

export async function GET(req: NextRequest) {
  const ctx = getRequestContext(req, 'GET /api/widget/config');
  try {
    const businessId = req.nextUrl.searchParams.get('businessId') || '';
    if (!businessId) return NextResponse.json({ error: 'businessId required' }, { status: 400 });

    const business = await getStore().getBusinessConfig(businessId);
    if (!business) return NextResponse.json({ error: 'Invalid businessId' }, { status: 404 });

    const origin = req.headers.get('origin');
    const host = origin ? new URL(origin).hostname : '';
    const isSameHost = host && host === req.nextUrl.hostname;
    if (host && !isSameHost && !domainAllowed(host, business.allowedDomains)) {
      return NextResponse.json({ error: 'Origin not allowed' }, { status: 403 });
    }

    const widgetToken = host ? signWidgetToken({ businessId: business.businessId, host }) : null;
    const payload = {
      businessId: business.businessId,
      name: business.name,
      timezone: business.timezone,
      services: business.services,
      bookingMode: business.bookingMode,
      contact: business.contact,
      styling: business.styling,
      widgetToken
    };
    const res = NextResponse.json(payload);
    if (origin && host && (isSameHost || domainAllowed(host, business.allowedDomains))) {
      res.headers.set('Access-Control-Allow-Origin', origin);
      res.headers.set('Vary', 'Origin');
    }
    ctx.log('info', 'Widget config served', { businessId, host, tokenIssued: !!widgetToken });
    return res;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    ctx.log('error', 'Widget config failed', { error: message });
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
