import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json({
    ok: true,
    hasOpenAIKey: Boolean(process.env.OPENAI_API_KEY),
    hasSupabase: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
  });
}
