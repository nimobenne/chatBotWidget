import { google } from 'googleapis';
import { getStore } from './store';
import { BookingRecord, BusinessConfig } from './types';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || process.env.NEXT_PUBLIC_SITE_URL + '/api/auth/google/callback';

export interface CalendarEventResult {
  eventId: string;
  htmlLink: string;
}

export interface BusyRange {
  startISO: string;
  endISO: string;
}

function getOAuthClient(refreshToken: string, tokenType: string, scope: string) {
  const oauth2Client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI
  );

  oauth2Client.setCredentials({
    refresh_token: refreshToken,
    token_type: tokenType,
    scope
  });

  return oauth2Client;
}

export async function getCalendarBusyRanges(
  business: BusinessConfig,
  startISO: string,
  endISO: string
): Promise<BusyRange[]> {
  const store = getStore();
  const calendarConn = await store.getGoogleCalendarConnection(business.businessId);
  if (!calendarConn) return [];

  try {
    const auth = getOAuthClient(calendarConn.refreshToken, calendarConn.tokenType, calendarConn.scope);
    const calendar = google.calendar({ version: 'v3', auth });
    const response = await calendar.events.list({
      calendarId: calendarConn.calendarId || 'primary',
      timeMin: startISO,
      timeMax: endISO,
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 2500
    });

    const events = response.data.items || [];
    return events
      .filter((e) => !!e.start?.dateTime && !!e.end?.dateTime)
      .map((e) => ({
        startISO: e.start?.dateTime as string,
        endISO: e.end?.dateTime as string
      }));
  } catch (error) {
    console.error('Failed to fetch Google Calendar events for busy ranges:', error);
    return [];
  }
}

export async function createCalendarEvent(
  booking: BookingRecord,
  business: BusinessConfig
): Promise<CalendarEventResult | null> {
  const store = getStore();
  const calendarConn = await store.getGoogleCalendarConnection(business.businessId);
  
  if (!calendarConn) {
    console.log('No Google Calendar connection for business:', business.businessId);
    return null;
  }

  const auth = getOAuthClient(calendarConn.refreshToken, calendarConn.tokenType, calendarConn.scope);
  const calendar = google.calendar({ version: 'v3', auth });

  const event = {
    summary: `${booking.serviceName} - ${booking.customerName}`,
    description: `
Service: ${booking.serviceName}
Customer: ${booking.customerName}
Phone: ${booking.customerPhone}
${booking.customerEmail ? `Email: ${booking.customerEmail}` : ''}
${booking.notes ? `Notes: ${booking.notes}` : ''}
    `.trim(),
    start: {
      dateTime: booking.startTimeISO,
      timeZone: business.timezone
    },
    end: {
      dateTime: booking.endTimeISO,
      timeZone: business.timezone
    },
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'email', minutes: 24 * 60 },
        { method: 'popup', minutes: 30 }
      ]
    }
  };

  try {
    const response = await calendar.events.insert({
      calendarId: calendarConn.calendarId,
      requestBody: event
    });

    return {
      eventId: response.data.id || '',
      htmlLink: response.data.htmlLink || ''
    };
  } catch (error) {
    console.error('Failed to create calendar event:', error);
    throw error;
  }
}

export function getGoogleAuthUrl(businessId: string, state: string): string {
  const oauth2Client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI
  );

  const scopes = [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/calendar.events'
  ];

  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    state: `${businessId}:${state}`,
    prompt: 'consent'
  });
}

export async function exchangeCodeForTokens(code: string): Promise<{
  refreshToken: string;
  tokenType: string;
  scope: string;
}> {
  const oauth2Client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI
  );

  const { tokens } = await oauth2Client.getToken(code);

  if (!tokens.refresh_token) {
    throw new Error('No refresh token returned');
  }

  return {
    refreshToken: tokens.refresh_token,
    tokenType: tokens.token_type || 'Bearer',
    scope: tokens.scope || ''
  };
}
