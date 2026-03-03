import { getSupabaseStore } from './store.supabase';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3';

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for Google integration.`);
  return value;
}

export function buildGoogleOAuthUrl(state: string): string {
  const clientId = requiredEnv('GOOGLE_CLIENT_ID');
  const redirectUri = requiredEnv('GOOGLE_REDIRECT_URI');
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    access_type: 'offline',
    prompt: 'consent',
    scope: 'https://www.googleapis.com/auth/calendar',
    state
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

async function refreshAccessToken(refreshToken: string): Promise<string> {
  const clientId = requiredEnv('GOOGLE_CLIENT_ID');
  const clientSecret = requiredEnv('GOOGLE_CLIENT_SECRET');

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    })
  });

  if (!res.ok) throw new Error('Failed to refresh Google access token.');
  const json = (await res.json()) as { access_token: string };
  return json.access_token;
}

export async function exchangeCodeForTokens(code: string): Promise<{ refreshToken?: string }> {
  const clientId = requiredEnv('GOOGLE_CLIENT_ID');
  const clientSecret = requiredEnv('GOOGLE_CLIENT_SECRET');
  const redirectUri = requiredEnv('GOOGLE_REDIRECT_URI');

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code'
    })
  });
  if (!res.ok) throw new Error('Failed OAuth token exchange.');
  const json = (await res.json()) as { refresh_token?: string };
  return { refreshToken: json.refresh_token };
}

export async function createGoogleCalendarEvent(params: {
  businessId: string;
  summary: string;
  description: string;
  startISO: string;
  endISO: string;
  timezone: string;
}): Promise<string | undefined> {
  const store = getSupabaseStore();
  const conn = await store.getGoogleConnection(params.businessId);
  if (!conn) return undefined;

  const accessToken = await refreshAccessToken(conn.refresh_token);
  const calendarId = conn.calendar_id || 'primary';

  const res = await fetch(`${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      summary: params.summary,
      description: params.description,
      start: { dateTime: params.startISO, timeZone: params.timezone },
      end: { dateTime: params.endISO, timeZone: params.timezone }
    })
  });

  if (!res.ok) throw new Error('Failed to create Google Calendar event.');
  const json = (await res.json()) as { id?: string };
  return json.id;
}
