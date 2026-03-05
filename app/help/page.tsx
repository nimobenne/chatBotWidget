import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function loadDoc(file: string) {
  try {
    return readFileSync(join(process.cwd(), 'docs', 'runbooks', file), 'utf8');
  } catch {
    return 'Runbook not found.';
  }
}

export default function HelpPage() {
  const docs = [
    { title: 'Calendar Not Connecting', body: loadDoc('calendar-not-connecting.md') },
    { title: 'Booking Failed', body: loadDoc('booking-failed.md') },
    { title: 'Owner Locked Out', body: loadDoc('owner-locked-out.md') },
    { title: 'Payment Overdue', body: loadDoc('payment-overdue.md') }
  ];

  return (
    <main style={{ maxWidth: 1000, margin: '30px auto', padding: 20 }}>
      <h1>WidgetAI Help Center</h1>
      <p>Operational runbooks for common support issues.</p>
      <div style={{ display: 'grid', gap: 12 }}>
        {docs.map((doc) => (
          <section key={doc.title} style={{ border: '1px solid #334155', borderRadius: 12, padding: 12, background: '#0b1220' }}>
            <h3 style={{ marginTop: 0 }}>{doc.title}</h3>
            <pre style={{ whiteSpace: 'pre-wrap', margin: 0, color: '#cbd5e1' }}>{doc.body}</pre>
          </section>
        ))}
      </div>
    </main>
  );
}
