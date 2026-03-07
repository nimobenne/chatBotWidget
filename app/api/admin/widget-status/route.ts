import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthed } from '@/lib/adminAuth';
import { getStore } from '@/lib/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (!isAdminAuthed(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const businessId = req.nextUrl.searchParams.get('businessId') || '';
  const urlParam = req.nextUrl.searchParams.get('url') || '';

  if (!businessId) {
    return NextResponse.json({ error: 'businessId required' }, { status: 400 });
  }

  const store = getStore();
  const business = await store.getBusinessConfig(businessId);
  if (!business) {
    return NextResponse.json({ error: 'Business not found' }, { status: 404 });
  }

  let targetUrl = urlParam;
  if (!targetUrl) {
    const domain = (business.allowedDomains || []).find(
      (d) => d && d !== '*' && !d.includes('localhost') && !d.includes('127.0.0.1')
    );
    if (!domain) {
      return NextResponse.json({
        live: false,
        checkedUrl: null,
        foundScript: null,
        error: 'No public domain configured in allowed domains'
      });
    }
    targetUrl = `https://${domain}`;
  }

  try {
    const res = await fetch(targetUrl, {
      signal: AbortSignal.timeout(8_000),
      redirect: 'follow',
      headers: { 'User-Agent': 'WidgetStatusChecker/1.0' }
    });
    const html = await res.text();
    const re1 = new RegExp(`<script[^>]+widget\\.js[^>]*data-business=["']${businessId}["']`, 'i');
    const re2 = new RegExp(`<script[^>]+data-business=["']${businessId}["'][^>]*widget\\.js`, 'i');
    const match = html.match(re1) || html.match(re2);
    return NextResponse.json({
      live: !!match,
      checkedUrl: targetUrl,
      foundScript: match ? match[0].slice(0, 200) : null
    });
  } catch (err) {
    return NextResponse.json({
      live: false,
      checkedUrl: targetUrl,
      foundScript: null,
      error: err instanceof Error ? err.message : 'Could not reach site'
    });
  }
}
