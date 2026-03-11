import { NextRequest, NextResponse } from 'next/server';
import { getStore } from '@/lib/store';
import { verifyWidgetToken, signWidgetToken } from '@/lib/widgetToken';
import { extractOriginHost } from '@/lib/observability';
import { domainAllowed } from '@/lib/domainCheck';

const GRACE_SECONDS = 300; // allow refresh up to 5 minutes after expiry

export async function POST(req: NextRequest) {
  try {
    const { businessId } = await req.json();
    if (!businessId) return NextResponse.json({ error: 'businessId required' }, { status: 400 });

    const business = await getStore().getBusinessConfig(businessId);
    if (!business) return NextResponse.json({ error: 'Invalid businessId' }, { status: 404 });

    const origin = req.headers.get('origin');
    const host = extractOriginHost(req);
    const isSameHost = host && host === req.nextUrl.hostname;
    if (host && !isSameHost && !domainAllowed(host, business.allowedDomains)) {
      return NextResponse.json({ error: 'Origin not allowed' }, { status: 403 });
    }

    const oldToken = req.headers.get('x-widget-token');
    const tokenHost = host || req.nextUrl.hostname;
    const check = verifyWidgetToken(oldToken, { businessId, host: tokenHost }, { graceSeconds: GRACE_SECONDS });
    if (!check.ok) {
      return NextResponse.json({ error: `Token refresh denied: ${check.reason}` }, { status: 401 });
    }

    const newToken = signWidgetToken({ businessId, host: tokenHost });
    const res = NextResponse.json({ widgetToken: newToken });
    if (origin && host && (isSameHost || domainAllowed(host, business.allowedDomains))) {
      res.headers.set('Access-Control-Allow-Origin', origin);
      res.headers.set('Vary', 'Origin');
    }
    return res;
  } catch {
    return NextResponse.json({ error: 'Token refresh failed' }, { status: 400 });
  }
}

export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get('origin');
  const res = new NextResponse(null, { status: 204 });
  res.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type, x-widget-token');
  if (origin) {
    res.headers.set('Access-Control-Allow-Origin', origin);
    res.headers.set('Vary', 'Origin');
  }
  return res;
}
