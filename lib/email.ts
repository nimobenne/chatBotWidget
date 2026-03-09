import { Resend } from 'resend';

function getResend() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log('RESEND_API_KEY not set, skipping email send');
    return null;
  }
  return new Resend(apiKey);
}

export interface OwnerNotificationParams {
  ownerEmail?: string;
  customerName: string;
  serviceName: string;
  dateTime: string;
  businessName: string;
  customerEmail?: string;
  customerPhone?: string;
}

export async function sendOwnerBookingNotification(params: OwnerNotificationParams) {
  const resend = getResend();
  if (!resend || !params.ownerEmail) return;

  const formattedDate = new Date(params.dateTime).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });

  await resend.emails.send({
    from: process.env.EMAIL_FROM || 'Bookings <onboarding@resend.dev>',
    to: [params.ownerEmail],
    subject: `New booking: ${params.customerName} — ${params.serviceName}`,
    html: `
      <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
        <h2 style="color: #111827;">New Booking</h2>
        <div style="background: #f0fdf4; padding: 16px; border-radius: 8px; border-left: 4px solid #16a34a;">
          <p style="margin: 0;"><strong>Customer:</strong> ${params.customerName}</p>
          <p style="margin: 8px 0 0;"><strong>Service:</strong> ${params.serviceName}</p>
          <p style="margin: 8px 0 0;"><strong>Date & Time:</strong> ${formattedDate}</p>
          ${params.customerEmail ? `<p style="margin: 8px 0 0;"><strong>Email:</strong> ${params.customerEmail}</p>` : ''}
          ${params.customerPhone ? `<p style="margin: 8px 0 0;"><strong>Phone:</strong> ${params.customerPhone}</p>` : ''}
        </div>
        <p style="color: #6b7280; font-size: 14px; margin-top: 16px;">Sent by WidgetAI for ${params.businessName}</p>
      </div>
    `
  }).catch(() => null);
}

export interface BookingEmailParams {
  to: string;
  customerName: string;
  serviceName: string;
  dateTime: string;
  businessName: string;
  businessAddress?: string;
  businessPhone?: string;
}

export async function sendBookingConfirmation(params: BookingEmailParams) {
  const resend = getResend();
  if (!resend) {
    return;
  }

  const { to, customerName, serviceName, dateTime, businessName, businessAddress, businessPhone } = params;

  const formattedDate = new Date(dateTime).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });

  try {
    const result = await resend.emails.send({
      from: process.env.EMAIL_FROM || 'Bookings <onboarding@resend.dev>',
      to: [to],
      subject: `Booking Confirmed - ${serviceName} at ${businessName}`,
      html: `
        <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
          <h1 style="color: #111827;">Booking Confirmed!</h1>
          <p>Hi ${customerName},</p>
          <p>Your appointment has been confirmed.</p>
          
          <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
            <p style="margin: 0;"><strong>Service:</strong> ${serviceName}</p>
            <p style="margin: 8px 0 0;"><strong>Date & Time:</strong> ${formattedDate}</p>
            <p style="margin: 8px 0 0;"><strong>Business:</strong> ${businessName}</p>
            ${businessAddress ? `<p style="margin: 8px 0 0;"><strong>Address:</strong> ${businessAddress}</p>` : ''}
            ${businessPhone ? `<p style="margin: 8px 0 0;"><strong>Phone:</strong> ${businessPhone}</p>` : ''}
          </div>
          
          <p>We look forward to seeing you!</p>
          <p style="color: #6b7280; font-size: 14px;">
            ${businessName}<br/>
            ${businessAddress || ''}
          </p>
        </div>
      `
    });

    console.log('Email sent:', result.data?.id);
    return result;
  } catch (error) {
    console.error('Failed to send email:', error);
    throw error;
  }
}
