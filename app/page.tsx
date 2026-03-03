import Link from 'next/link';

export default function HomePage() {
  return (
    <main style={{ maxWidth: 900, margin: '40px auto', padding: 24 }}>
      <h1>AI Receptionist Widget</h1>
      <p>Use the demo page to preview the embeddable multi-tenant chat widget.</p>
      <ul>
        <li><Link href="/demo?biz=demo_barber">Open demo business</Link></li>
      </ul>
    </main>
  );
}
