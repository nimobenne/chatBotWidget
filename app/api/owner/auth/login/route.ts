import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  getSupabaseServiceClient,
  issueOwnerToken,
  verifyOwnerPassword
} from '@/lib/ownerCredentials';

const schema = z.object({
  username: z.string().trim().min(3).max(64),
  password: z.string().min(8).max(200)
});

export async function POST(req: NextRequest) {
  try {
    const parsed = schema.parse(await req.json());
    const supabase = getSupabaseServiceClient();
    const username = parsed.username.toLowerCase();

    const { data: owner, error } = await supabase
      .from('owner_accounts')
      .select('id, username, password_hash, is_active')
      .eq('username', username)
      .single();

    if (error || !owner || owner.is_active === false) {
      return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });
    }

    const ok = verifyOwnerPassword(parsed.password, owner.password_hash || '');
    if (!ok) {
      return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });
    }

    const token = issueOwnerToken(owner.id);
    return NextResponse.json({ token, owner: { id: owner.id, username: owner.username } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
