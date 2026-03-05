import Link from 'next/link';

const whatsappHref = 'https://wa.me/31610431511?text=Hi%20WidgetAI%2C%20I%20want%20to%20set%20up%20the%20AI%20booking%20widget%20for%20my%20barbershop.';

export default function HomePage() {
  return (
    <main style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 20px 20px' }}>
      <section style={{ border: '1px solid #334155', borderRadius: 16, padding: 24, background: 'radial-gradient(circle at top right,#14532d,#020617 60%)' }}>
        <div style={{ fontSize: 12, color: '#86efac', marginBottom: 10 }}>Built for barber shops</div>
        <h1 style={{ fontSize: 44, margin: '0 0 8px' }}>Turn missed calls into booked chairs, 24/7.</h1>
        <p style={{ color: '#cbd5e1', maxWidth: 700 }}>WidgetAI chats with clients, checks live availability, and books directly into your calendar.</p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 16 }}>
          <a href={whatsappHref} target="_blank" rel="noreferrer" style={{ background: '#16a34a', color: '#fff', padding: '10px 16px', borderRadius: 10, textDecoration: 'none' }}>Message on WhatsApp</a>
          <a href="#demo" style={{ background: '#0f172a', color: '#e2e8f0', padding: '10px 16px', borderRadius: 10, textDecoration: 'none', border: '1px solid #334155' }}>Try Live Demo</a>
        </div>
        <div style={{ marginTop: 14, color: '#86efac' }}>€50/month · Setup fee waived (normally €99) · No charge until first 5 bookings</div>
      </section>

      <section style={{ marginTop: 24, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 10 }}>
        {[
          '24/7 AI receptionist replies instantly',
          'Live availability + conflict checking',
          'Google Calendar sync for confirmed bookings',
          'Owner portal + admin controls',
          'Phone fallback when online booking is unavailable',
          'Multi-business support from one dashboard'
        ].map((f) => (
          <div key={f} style={{ border: '1px solid #334155', borderRadius: 12, padding: 12, background: '#0b1220' }}>{f}</div>
        ))}
      </section>

      <section id="demo" style={{ marginTop: 28, border: '1px solid #334155', borderRadius: 16, padding: 20, background: '#0b1220' }}>
        <h2 style={{ marginTop: 0 }}>Pre-demo flow</h2>
        <ol style={{ color: '#cbd5e1' }}>
          <li>Customer asks for tomorrow at 10:00</li>
          <li>WidgetAI checks business hours + existing bookings + calendar conflicts</li>
          <li>If valid, booking is created and calendar event is required for confirmation</li>
          <li>If not valid, customer gets fallback to call the business</li>
        </ol>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link href="/demo?biz=examplebarber" style={{ padding: '8px 12px', borderRadius: 10, background: '#16a34a', color: '#fff', textDecoration: 'none' }}>Open Interactive Demo</Link>
          <Link href="/admin" style={{ padding: '8px 12px', borderRadius: 10, background: '#1e293b', color: '#e2e8f0', textDecoration: 'none' }}>Open Admin Portal</Link>
        </div>
      </section>

      <section style={{ marginTop: 24, border: '1px solid #334155', borderRadius: 16, padding: 20, background: '#111827' }}>
        <h2 style={{ marginTop: 0 }}>How onboarding works</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 10 }}>
          <div><strong>1. Setup</strong><div style={{ color: '#94a3b8' }}>We set your services, hours, and branding.</div></div>
          <div><strong>2. Connect</strong><div style={{ color: '#94a3b8' }}>Connect your Google Calendar securely.</div></div>
          <div><strong>3. Go live</strong><div style={{ color: '#94a3b8' }}>Add one script and start booking clients.</div></div>
        </div>
      </section>
    </main>
  );
}
