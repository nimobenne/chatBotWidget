import crypto from 'node:crypto';
import { getSupabaseStore } from './store.supabase';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3';

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for Google integration.`);
  return value;
}

function getStateSecret(): string {
  return process.env.GOOGLE_OAUTH_STATE_SECRET || requiredEnv('SUPABASE_SERVICE_ROLE_KEY');
}

export function buildGoogleOAuthState(payload: { businessId: string; ts: number }): string {
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', getStateSecret()).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function parseGoogleOAuthState(state: string): { businessId: string; ts: number } {
  const [body, sig] = state.split('.');
  if (!body || !sig) throw new Error('Invalid OAuth state format.');

  const expected = crypto.createHmac('sha256', getStateSecret()).update(body).digest('base64url');
  if (sig !== expected) throw new Error('Invalid OAuth state signature.');

  const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as { businessId: string; ts: number };
  if (!parsed.businessId || !parsed.ts) throw new Error('Invalid OAuth state payload.');
  const maxAgeMs = 10 * 60 * 1000;
  if (Date.now() - parsed.ts > maxAgeMs) throw new Error('OAuth state expired.');
  return parsed;
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

export async function fetchGoogleBusyRanges(params: { businessId: string; startISO: string; endISO: string }) {
  const store = getSupabaseStore();
  const conn = await store.getGoogleConnection(params.businessId);
  if (!conn) return [] as Array<{ start: string; end: string }>;

  const accessToken = await refreshAccessToken(conn.refresh_token);
  const calendarId = conn.calendar_id || 'primary';

  const res = await fetch(`${GOOGLE_CALENDAR_API}/freeBusy`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      timeMin: params.startISO,
      timeMax: params.endISO,
      items: [{ id: calendarId }]
    })
  });

  if (!res.ok) throw new Error('Failed to load Google Calendar free/busy.');
  const json = (await res.json()) as {
    calendars?: Record<string, { busy?: Array<{ start: string; end: string }> }>;
  };

  return json.calendars?.[calendarId]?.busy || [];
}

export async function createGoogleCalendarEvent(params: {
  businessId: string;
  summary: string;
  description: string;
  startISO: string;
  endISO: string;
  timezone: string;
  customerEmail?: string;
}): Promise<string | undefined> {
  const store = getSupabaseStore();
  const conn = await store.getGoogleConnection(params.businessId);
  if (!conn) return undefined;

  const accessToken = await refreshAccessToken(conn.refresh_token);
  const calendarId = conn.calendar_id || 'primary';

  const res = await fetch(`${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events?sendUpdates=all`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      summary: params.summary,
      description: params.description,
      start: { dateTime: params.startISO, timeZone: params.timezone },
      end: { dateTime: params.endISO, timeZone: params.timezone },
      attendees: params.customerEmail ? [{ email: params.customerEmail }] : undefined,
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 24 * 60 },
          { method: 'popup', minutes: 30 }
        ]
      }
    })
  });

  if (!res.ok) {
    const details = await res.text();
    throw new Error(`Failed to create Google Calendar event (${res.status}): ${details || res.statusText}`);
  }
  const json = (await res.json()) as { id?: string };
  return json.id;
}
