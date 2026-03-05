import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { isAdminAuthed } from '@/lib/adminAuth';
import { getStore } from '@/lib/store';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || `${process.env.NEXT_PUBLIC_SITE_URL}/api/auth/google/callback`;

function oauthClient(refreshToken: string, tokenType: string, scope: string) {
  const client = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI);
  client.setCredentials({ refresh_token: refreshToken, token_type: tokenType, scope });
  return client;
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    if (!isAdminAuthed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const store = getStore();
    const businesses = await store.listBusinesses();

    const health = await Promise.all(
      businesses.map(async (business) => {
        const issues: string[] = [];
        const servicesConfigured = Array.isArray(business.services) && business.services.length > 0;
        if (!servicesConfigured) issues.push('No services configured');

        const openDays = Object.values(business.hours || {}).filter((v) => !!v).length;
        if (openDays === 0) issues.push('No open hours configured');

        const hasAllowedDomains = Array.isArray(business.allowedDomains) && business.allowedDomains.length > 0;
        if (!hasAllowedDomains) issues.push('No allowed domains configured');

        const conn = await store.getGoogleCalendarConnection(business.businessId);
        let calendarConnectedInDb = !!conn;
        let calendarUsable = false;
        let calendarError: string | null = null;
        if (!conn) {
          issues.push('Calendar not connected');
        } else {
          try {
            const auth = oauthClient(conn.refreshToken, conn.tokenType, conn.scope);
            const calendar = google.calendar({ version: 'v3', auth });
            await calendar.calendarList.list({ maxResults: 1 });
            calendarUsable = true;
          } catch (error) {
            calendarUsable = false;
            calendarError = error instanceof Error ? error.message : 'Calendar token invalid';
            issues.push('Calendar token unusable');
          }
        }

        return {
          businessId: business.businessId,
          servicesConfigured,
          openDays,
          hasAllowedDomains,
          calendarConnectedInDb,
          calendarUsable,
          calendarError,
          healthy: issues.length === 0,
          issues
        };
      })
    );

    return NextResponse.json({ health });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
