import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseServiceClient, hashOwnerPassword } from '@/lib/ownerCredentials';
import { isAdminAuthed } from '@/lib/adminAuth';
import { logAdminAudit } from '@/lib/adminAudit';

const upsertSchema = z.object({
  username: z.string().trim().min(3).max(64),
  password: z.string().min(8).max(200),
  businessId: z.string().trim().min(1)
});

const actionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('deactivate'), ownerId: z.string().uuid() }),
  z.object({ action: z.literal('activate'), ownerId: z.string().uuid() }),
  z.object({ action: z.literal('reset_password'), ownerId: z.string().uuid(), newPassword: z.string().min(8).max(200) }),
  z.object({ action: z.literal('delete_owner'), ownerId: z.string().uuid() })
]);

export async function GET(req: NextRequest) {
  try {
    if (!isAdminAuthed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const supabase = getSupabaseServiceClient();

    const { data: owners, error: ownersErr } = await supabase
      .from('owner_accounts')
      .select('id, username, is_active, created_at')
      .order('created_at', { ascending: false })
      .limit(100);
    if (ownersErr) return NextResponse.json({ error: ownersErr.message }, { status: 400 });

    const { data: links } = await supabase
      .from('business_owners')
      .select('owner_user_id, business_id, businesses(slug, name)');

    const byOwner = new Map<string, Array<{ businessId: string; name: string }>>();
    for (const row of links || []) {
      const ownerId = String((row as any).owner_user_id || '');
      const biz = (row as any).businesses;
      if (!ownerId || !biz?.slug) continue;
      const list = byOwner.get(ownerId) || [];
      list.push({ businessId: biz.slug, name: biz.name || biz.slug });
      byOwner.set(ownerId, list);
    }

    return NextResponse.json({
      owners: (owners || []).map((o: any) => ({
        id: o.id,
        username: o.username,
        isActive: o.is_active,
        createdAt: o.created_at,
        businesses: byOwner.get(o.id) || []
      }))
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!isAdminAuthed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const parsed = upsertSchema.parse(await req.json());
    const supabase = getSupabaseServiceClient();
    const username = parsed.username.toLowerCase();
    const passwordHash = hashOwnerPassword(parsed.password);

    const { data: owner, error: ownerErr } = await supabase
      .from('owner_accounts')
      .upsert({ username, password_hash: passwordHash, is_active: true, updated_at: new Date().toISOString() }, { onConflict: 'username' })
      .select('id, username')
      .single();
    if (ownerErr || !owner) return NextResponse.json({ error: ownerErr?.message || 'Failed to create owner' }, { status: 400 });

    const { data: business } = await supabase
      .from('businesses')
      .select('id')
      .eq('slug', parsed.businessId)
      .single();
    if (!business) return NextResponse.json({ error: 'Business not found for assignment' }, { status: 404 });

    const { error: unlinkErr } = await supabase
      .from('business_owners')
      .delete()
      .eq('owner_user_id', owner.id);
    if (unlinkErr) return NextResponse.json({ error: unlinkErr.message }, { status: 400 });

    const { error: linkErr } = await supabase
      .from('business_owners')
      .upsert(
        { business_id: business.id, owner_user_id: owner.id },
        { onConflict: 'business_id,owner_user_id' }
      );
    if (linkErr) return NextResponse.json({ error: linkErr.message }, { status: 400 });

    await logAdminAudit(req, {
      action: 'owner_upsert',
      targetType: 'owner',
      targetId: owner.id,
      meta: { username: owner.username, businessId: parsed.businessId }
    });

    return NextResponse.json({ ok: true, owner: { id: owner.id, username: owner.username } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    if (!isAdminAuthed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const payload = actionSchema.parse(await req.json());
    const supabase = getSupabaseServiceClient();

    if (payload.action === 'deactivate' || payload.action === 'activate') {
      const isActive = payload.action === 'activate';
      const { error } = await supabase
        .from('owner_accounts')
        .update({ is_active: isActive, updated_at: new Date().toISOString() })
        .eq('id', payload.ownerId);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      await logAdminAudit(req, {
        action: isActive ? 'owner_activate' : 'owner_deactivate',
        targetType: 'owner',
        targetId: payload.ownerId
      });
      return NextResponse.json({ ok: true });
    }

    if (payload.action === 'delete_owner') {
      const { error: unlinkErr } = await supabase
        .from('business_owners')
        .delete()
        .eq('owner_user_id', payload.ownerId);
      if (unlinkErr) return NextResponse.json({ error: unlinkErr.message }, { status: 400 });

      const { error: deleteErr } = await supabase
        .from('owner_accounts')
        .delete()
        .eq('id', payload.ownerId);
      if (deleteErr) return NextResponse.json({ error: deleteErr.message }, { status: 400 });

      await logAdminAudit(req, {
        action: 'owner_delete',
        targetType: 'owner',
        targetId: payload.ownerId
      });

      return NextResponse.json({ ok: true });
    }

    const { error } = await supabase
      .from('owner_accounts')
      .update({ password_hash: hashOwnerPassword(payload.newPassword), updated_at: new Date().toISOString() })
      .eq('id', payload.ownerId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    await logAdminAudit(req, {
      action: 'owner_reset_password',
      targetType: 'owner',
      targetId: payload.ownerId
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
