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
    channel: 'chat'
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
