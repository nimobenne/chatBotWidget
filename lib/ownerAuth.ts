import { NextRequest } from 'next/server';
import { getSupabaseServiceClient, verifyOwnerToken } from './ownerCredentials';

type OwnerUser = { id: string; username?: string | null };

export async function requireOwner(req: NextRequest) {
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) throw new Error('Missing bearer token');

  const supabase = getSupabaseServiceClient();

  const parsed = verifyOwnerToken(token);
  if (parsed) {
    const { data: owner, error } = await supabase
      .from('owner_accounts')
      .select('id, username, is_active')
      .eq('id', parsed.ownerId)
      .single();
    if (error || !owner || owner.is_active === false) throw new Error('Unauthorized');
    const user: OwnerUser = { id: owner.id, username: owner.username };
    return { user, supabase };
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) throw new Error('Unauthorized');
  return { user: data.user as OwnerUser, supabase };
}
