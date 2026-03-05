import Link from 'next/link';

const links = [
  { href: '/', label: 'Home' },
  { href: '/demo?biz=demo_barber', label: 'Demo Widget' },
  { href: '/admin', label: 'Admin' },
  { href: '/owner', label: 'Owner Portal' },
  { href: '/api/widget/config?businessId=demo_barber', label: 'Widget Config API' },
  { href: '/api/businesses?password=password', label: 'Businesses API' }
];

export default function HomePage() {
  return (
    <main style={{ maxWidth: 960, margin: '40px auto', padding: 24 }}>
      <h1>AI Receptionist Widget</h1>
      <p>Use the tabs below to access and test all key pages quickly.</p>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '16px 0 24px' }}>
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            style={{
              padding: '8px 14px',
              border: '1px solid #334155',
              borderRadius: 999,
              textDecoration: 'none',
              color: '#e2e8f0',
              background: '#111827'
            }}
          >
            {link.label}
          </Link>
        ))}
      </div>

      <section>
        <h3>Testing checklist</h3>
        <ol>
          <li>Open <strong>Admin</strong>, password is <code>password</code> if env var not set.</li>
          <li>Create/save a business with the form (no SQL/JSON needed).</li>
          <li>Click <strong>Connect Calendar</strong> for that business.</li>
          <li>Open <strong>Demo Widget</strong> and run a full booking.</li>
          <li>Verify Supabase <code>bookings</code> and <code>calendar_event_id</code>.</li>
        </ol>
      </section>
    </main>
  );
}
