import { BusinessRow, getSupabaseStore } from './store.supabase';

export async function createHandoffAndAlert(params: {
  business: BusinessRow;
  summary: string;
  lastUserMessage: string;
  customerContact: string;
}) {
  const store = getSupabaseStore();

  await store.createHandoff({
    business_id: params.business.id,
    summary: params.summary,
    last_user_message: params.lastUserMessage,
    customer_contact: params.customerContact,
    channel: 'widget'
  });

  const to = params.business.contact_email;
  const from = process.env.ALERT_FROM_EMAIL;
  const resendKey = process.env.RESEND_API_KEY;
  if (!to || !from || !resendKey) return { emailed: false };

  const html = `<p>New AI handoff for <strong>${params.business.name}</strong></p>
  <p><strong>Summary:</strong> ${params.summary}</p>
  <p><strong>Last message:</strong> ${params.lastUserMessage}</p>
  <p><strong>Customer contact:</strong> ${params.customerContact}</p>
  <p><strong>Call:</strong> ${params.business.contact_phone || 'N/A'}</p>`;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ from, to: [to], subject: `Handoff: ${params.business.name}`, html })
  });

  if (!response.ok) {
    return { emailed: false };
  }

  return { emailed: true };
}

export async function sendBookingConfirmationEmail(params: {
  business: BusinessRow;
  customerName: string;
  customerEmail: string;
  serviceName: string;
  startTimeISO: string;
  bookingId: string;
}) {
  const from = process.env.ALERT_FROM_EMAIL;
  const resendKey = process.env.RESEND_API_KEY;
  if (!from || !resendKey) return { emailed: false };

  const when = new Date(params.startTimeISO).toLocaleString('en-US', {
    timeZone: params.business.timezone,
    dateStyle: 'full',
    timeStyle: 'short'
  });

  const html = `<p>Hi ${params.customerName},</p>
  <p>Your booking is confirmed.</p>
  <p><strong>Business:</strong> ${params.business.name}<br/>
  <strong>Service:</strong> ${params.serviceName}<br/>
  <strong>Time:</strong> ${when}<br/>
  <strong>Booking ID:</strong> ${params.bookingId}</p>
  <p>If you need to make changes, reply to this email.</p>`;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from,
      to: [params.customerEmail],
      subject: `Booking confirmed - ${params.business.name}`,
      html
    })
  });

  return { emailed: response.ok };
}
