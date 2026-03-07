import { NextRequest, NextResponse } from 'next/server';
import { requireOwner } from '@/lib/ownerAuth';
import { getStore } from '@/lib/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function checkWidgetLive(targetUrl: string, slug: string) {
  try {
    const res = await fetch(targetUrl, {
      signal: AbortSignal.timeout(8_000),
      redirect: 'follow',
      headers: { 'User-Agent': 'WidgetStatusChecker/1.0' }
    });
    const html = await res.text();
    const re1 = new RegExp(`<script[^>]+widget\\.js[^>]*data-business=["']${slug}["']`, 'i');
    const re2 = new RegExp(`<script[^>]+data-business=["']${slug}["'][^>]*widget\\.js`, 'i');
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

export async function GET(req: NextRequest) {
  try {
    const { user, supabase } = await requireOwner(req);

    const businessId = req.nextUrl.searchParams.get('businessId') || '';
    const urlParam = req.nextUrl.searchParams.get('url') || '';

    if (!businessId) {
      return NextResponse.json({ error: 'businessId required' }, { status: 400 });
    }

    // Verify the caller owns this business
    const { data: bizRow } = await supabase
      .from('businesses')
      .select('id')
      .eq('slug', businessId)
      .single();

    if (!bizRow) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    const { data: ownership } = await supabase
      .from('business_owners')
      .select('id')
      .eq('owner_user_id', user.id)
      .eq('business_id', bizRow.id)
      .single();

    if (!ownership) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    let targetUrl = urlParam;
    if (!targetUrl) {
      const store = getStore();
      const business = await store.getBusinessConfig(businessId);
      if (!business) {
        return NextResponse.json({ error: 'Business not found' }, { status: 404 });
      }
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

    return checkWidgetLive(targetUrl, businessId);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
