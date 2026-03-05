type Severity = 'warning' | 'error';

export async function sendAlertEmail(input: {
  severity: Severity;
  title: string;
  message: string;
  context?: Record<string, unknown>;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.ALERT_EMAIL_TO || 'randomfacts036@gmail.com';
  const from = process.env.ALERT_EMAIL_FROM;
  if (!apiKey || !from) return;

  const subject = `[WidgetAI][${input.severity.toUpperCase()}] ${input.title}`;
  const html = `
    <h3>${input.title}</h3>
    <p>${input.message}</p>
    <pre>${JSON.stringify(input.context || {}, null, 2)}</pre>
  `;

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ from, to, subject, html })
    });
  } catch {
    // non-fatal
  }
}
