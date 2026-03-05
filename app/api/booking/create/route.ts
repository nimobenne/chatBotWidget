import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { getStore } from '@/lib/store';
import { createBookingRecord } from '@/lib/booking';
import { sendBookingConfirmation } from '@/lib/email';
import { getRequestContext, extractOriginHost } from '@/lib/observability';
import { verifyWidgetToken } from '@/lib/widgetToken';
import { getSupabaseServiceClient } from '@/lib/ownerCredentials';
import { getBookingBlockReason } from '@/lib/billing';
import { sendAlertEmail } from '@/lib/alerts';

const schema = z.object({
  businessId: z.string().min(1),
  serviceName: z.string().min(1),
  startTimeISO: z.string().datetime(),
  customerName: z.string().min(1),
  customerEmail: z.string().email(),
  customerPhone: z.string().optional(),
  idempotencyKey: z.string().min(8).max(200).optional()
});

function payloadHash(parsed: z.infer<typeof schema>): string {
  const basis = JSON.stringify({
    businessId: parsed.businessId,
    serviceName: parsed.serviceName,
    startTimeISO: parsed.startTimeISO,
    customerName: parsed.customerName,
    customerEmail: parsed.customerEmail,
    customerPhone: parsed.customerPhone || ''
  });
  return createHash('sha256').update(basis).digest('hex');
}

async function beginIdempotentCreate(parsed: z.infer<typeof schema>, idempotencyKey: string) {
  try {
    const supabase = getSupabaseServiceClient();
    const { data: business } = await supabase
      .from('businesses')
      .select('id')
      .eq('slug', parsed.businessId)
      .single();
    if (!business) return { enabled: false as const };

    const hash = payloadHash(parsed);
    const businessDbId = business.id;
    const now = new Date().toISOString();

    const { error: insertErr } = await supabase
      .from('booking_idempotency_keys')
      .insert({
        business_id: businessDbId,
        idempotency_key: idempotencyKey,
        request_hash: hash,
        status: 'processing',
        created_at: now,
        updated_at: now
      });

    if (!insertErr) {
      return { enabled: true as const, businessDbId, hash, replayResponse: null };
    }

    const { data: existing } = await supabase
      .from('booking_idempotency_keys')
      .select('request_hash, status, response_payload')
      .eq('business_id', businessDbId)
      .eq('idempotency_key', idempotencyKey)
      .single();

    if (!existing) return { enabled: false as const };
    if (existing.request_hash !== hash) {
      return {
        enabled: true as const,
        businessDbId,
        hash,
        replayResponse: null,
        conflict: 'Idempotency key was reused with different booking payload.'
      };
    }
    if (existing.status === 'completed' && existing.response_payload) {
      return { enabled: true as const, businessDbId, hash, replayResponse: existing.response_payload };
    }

    return {
      enabled: true as const,
      businessDbId,
      hash,
      replayResponse: null,
      inProgress: true
    };
  } catch {
    return { enabled: false as const };
  }
}

async function finalizeIdempotentCreate(args: {
  businessDbId: string;
  idempotencyKey: string;
  hash: string;
  responsePayload: Record<string, unknown>;
}) {
  try {
    const supabase = getSupabaseServiceClient();
    await supabase
      .from('booking_idempotency_keys')
      .update({
        status: 'completed',
        response_payload: args.responsePayload,
        updated_at: new Date().toISOString()
      })
      .eq('business_id', args.businessDbId)
      .eq('idempotency_key', args.idempotencyKey)
      .eq('request_hash', args.hash);
  } catch {
    // non-fatal
  }
}

export async function POST(req: NextRequest) {
  const ctx = getRequestContext(req, 'POST /api/booking/create');
  try {
    const parsed = schema.parse(await req.json());
    const store = getStore();
    const business = await store.getBusinessConfig(parsed.businessId);
    if (!business) {
      return NextResponse.json({ error: 'Invalid businessId' }, { status: 404 });
    }

    const blockReason = await getBookingBlockReason(parsed.businessId);
    if (blockReason) {
      return NextResponse.json({ error: blockReason, code: 'BOOKING_BLOCKED_BY_BILLING' }, { status: 403 });
    }

    const origin = req.headers.get('origin');
    const host = extractOriginHost(req);
    const isSameHost = host && host === req.nextUrl.hostname;
    const isAllowed = host && business.allowedDomains.some((d) => {
      const rule = d.toLowerCase().trim();
      const normalized = host.toLowerCase();
      if (!rule) return false;
      if (rule === '*') return true;
      if (rule.startsWith('*.')) return normalized.endsWith(rule.slice(1));
      return normalized === rule;
    });
    if (host && !isSameHost && !isAllowed) {
      ctx.log('warn', 'Origin blocked', { businessId: parsed.businessId, host });
      return NextResponse.json({ error: 'Origin not allowed' }, { status: 403 });
    }

    const token = req.headers.get('x-widget-token');
    const tokenCheck = verifyWidgetToken(token, { businessId: parsed.businessId, host: host || req.nextUrl.hostname });
    if (!tokenCheck.ok) {
      ctx.log('warn', 'Widget token rejected', { businessId: parsed.businessId, reason: tokenCheck.reason });
      return NextResponse.json({ error: `Unauthorized widget request: ${tokenCheck.reason}` }, { status: 401 });
    }

    const incomingKey = (req.headers.get('x-idempotency-key') || parsed.idempotencyKey || '').trim();
    let idem:
      | { enabled: false }
      | { enabled: true; businessDbId: string; hash: string; replayResponse: any; conflict?: string; inProgress?: boolean };
    if (incomingKey) {
      idem = await beginIdempotentCreate(parsed, incomingKey);
      if (idem.enabled && idem.conflict) {
        return NextResponse.json({ error: idem.conflict }, { status: 409 });
      }
      if (idem.enabled && idem.inProgress) {
        return NextResponse.json({ error: 'Duplicate booking is currently being processed. Please retry shortly.' }, { status: 409 });
      }
      if (idem.enabled && idem.replayResponse) {
        const replayRes = NextResponse.json({ ...idem.replayResponse, idempotentReplay: true });
        if (origin && host && (isSameHost || isAllowed)) {
          replayRes.headers.set('Access-Control-Allow-Origin', origin);
          replayRes.headers.set('Vary', 'Origin');
        }
        ctx.log('info', 'Booking replayed from idempotency cache', { businessId: parsed.businessId });
        return replayRes;
      }
    } else {
      idem = { enabled: false };
    }

    const booking = await createBookingRecord({
      business,
      serviceName: parsed.serviceName,
      startTimeISO: parsed.startTimeISO,
      customerName: parsed.customerName,
      customerPhone: parsed.customerPhone || parsed.customerEmail,
      customerEmail: parsed.customerEmail,
      status: 'confirmed'
    });

    await sendBookingConfirmation({
      to: parsed.customerEmail,
      customerName: parsed.customerName,
      serviceName: parsed.serviceName,
      dateTime: parsed.startTimeISO,
      businessName: business.name,
      businessAddress: business.contact.address,
      businessPhone: business.contact.phone
    }).catch(() => null);

    const res = NextResponse.json({
      bookingId: booking.bookingId,
      startTimeISO: booking.startTimeISO,
      message: 'Booking confirmed'
    });

    if (incomingKey && idem.enabled) {
      await finalizeIdempotentCreate({
        businessDbId: idem.businessDbId,
        idempotencyKey: incomingKey,
        hash: idem.hash,
        responsePayload: {
          bookingId: booking.bookingId,
          startTimeISO: booking.startTimeISO,
          message: 'Booking confirmed'
        }
      });
    }

    if (origin && host && (isSameHost || isAllowed)) {
      res.headers.set('Access-Control-Allow-Origin', origin);
      res.headers.set('Vary', 'Origin');
    }
    ctx.log('info', 'Booking created', { businessId: parsed.businessId, bookingId: booking.bookingId, serviceName: parsed.serviceName });
    return res;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    ctx.log('error', 'Booking creation failed', { error: message });
    await sendAlertEmail({
      severity: 'error',
      title: 'Booking creation failed',
      message,
      context: { route: '/api/booking/create' }
    });
    return NextResponse.json({ error: message, code: 'BOOKING_REQUEST_INVALID' }, { status: 400 });
  }
}

export const OPTIONS = async (req: NextRequest) => {
  const origin = req.headers.get('origin') || '*';
  const res = new NextResponse(null, { status: 204 });
  res.headers.set('Access-Control-Allow-Origin', origin);
  res.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type, x-widget-token, x-idempotency-key');
  return res;
};
