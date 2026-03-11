import { NextRequest, NextResponse } from 'next/server';
import { getStore } from '@/lib/store';
import { signWidgetToken } from '@/lib/widgetToken';
import { getRequestContext, extractOriginHost } from '@/lib/observability';
import { domainAllowed } from '@/lib/domainCheck';

export async function GET(req: NextRequest) {
  const ctx = getRequestContext(req, 'GET /api/widget/config');
  try {
    const businessId = req.nextUrl.searchParams.get('businessId') || '';
    if (!businessId) return NextResponse.json({ error: 'businessId required' }, { status: 400 });

    const business = await getStore().getBusinessConfig(businessId);
    if (!business) return NextResponse.json({ error: 'Invalid businessId' }, { status: 404 });

    const origin = req.headers.get('origin');
    const rawHost = extractOriginHost(req);
    const isSameHost = !rawHost || rawHost === req.nextUrl.hostname;
    if (rawHost && !isSameHost && !domainAllowed(rawHost, business.allowedDomains)) {
      return NextResponse.json({ error: 'Origin not allowed' }, { status: 403 });
    }

    // Fall back to the server hostname when no Origin header (same-origin requests)
    const signingHost = rawHost || req.nextUrl.hostname;
    const widgetToken = signWidgetToken({ businessId: business.businessId, host: signingHost });
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
    if (origin && rawHost && (isSameHost || domainAllowed(rawHost, business.allowedDomains))) {
      res.headers.set('Access-Control-Allow-Origin', origin);
      res.headers.set('Vary', 'Origin');
    }
    ctx.log('info', 'Widget config served', { businessId, host: signingHost, tokenIssued: !!widgetToken });
    return res;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    ctx.log('error', 'Widget config failed', { error: message });
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
