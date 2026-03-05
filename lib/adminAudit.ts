import { NextRequest } from 'next/server';
import { getSupabaseServiceClient } from './ownerCredentials';

export async function logAdminAudit(
  req: NextRequest,
  params: {
    action: string;
    targetType: string;
    targetId: string;
    meta?: Record<string, unknown>;
  }
) {
  try {
    const supabase = getSupabaseServiceClient();
    const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim();
    const ua = req.headers.get('user-agent') || '';

    await supabase.from('admin_audit_logs').insert({
      actor_type: 'admin',
      actor_id: 'admin',
      action: params.action,
      target_type: params.targetType,
      target_id: params.targetId,
      meta: {
        ...(params.meta || {}),
        ip,
        userAgent: ua.slice(0, 300)
      },
      created_at: new Date().toISOString()
    });
  } catch {
    // non-fatal: audit logging should never block primary operation
  }
}
