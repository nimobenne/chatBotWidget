'use client';

import Link from 'next/link';
import Script from 'next/script';

export default function AutoDemoClient({ businessId }: { businessId: string }) {
  return (
    <main style={{ minHeight: '100vh', background: '#050d1a', color: '#e2e8f0', fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,sans-serif', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      {/* Widget loads in demo mode — auto-opens and plays the scripted conversation */}
      <Script src="/widget.js" data-business={businessId} data-demo="true" data-position="bottom-right" strategy="afterInteractive" />

      <div style={{ maxWidth: 560, width: '100%', textAlign: 'center' }}>
        <div style={{ display: 'inline-block', background: 'rgba(16,185,129,.15)', border: '1px solid rgba(16,185,129,.3)', borderRadius: 999, padding: '4px 14px', fontSize: 12, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#34d399', marginBottom: 20 }}>
          Live Demo
        </div>

        <h1 style={{ fontSize: 'clamp(26px,5vw,42px)', fontWeight: 700, lineHeight: 1.15, margin: '0 0 16px', letterSpacing: '-.02em' }}>
          Watch the AI book an appointment
        </h1>

        <p style={{ fontSize: 16, color: '#94a3b8', margin: '0 0 32px', lineHeight: 1.6 }}>
          The widget just opened in the bottom-right corner. Watch it walk a customer through a full booking — no clicks needed.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 40 }}>
          {[
            { icon: '⚡', label: 'Instant replies', sub: 'No hold time' },
            { icon: '📅', label: 'Live availability', sub: 'Real calendar check' },
            { icon: '✅', label: 'Books itself', sub: 'Zero admin work' },
          ].map(({ icon, label, sub }) => (
            <div key={label} style={{ background: '#0f1f35', border: '1px solid #1e3a52', borderRadius: 14, padding: '16px 12px', textAlign: 'center' }}>
              <div style={{ fontSize: 22, marginBottom: 6 }}>{icon}</div>
              <div style={{ fontWeight: 600, fontSize: 13, color: '#e2e8f0' }}>{label}</div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{sub}</div>
            </div>
          ))}
        </div>

        <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 28px', lineHeight: 1.6 }}>
          After the demo finishes, click <strong style={{ color: '#94a3b8' }}>"Try it yourself"</strong> inside the widget to have a real conversation with the AI.
        </p>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/" style={{ display: 'inline-block', padding: '10px 20px', background: '#1e293b', color: '#e2e8f0', borderRadius: 10, textDecoration: 'none', fontSize: 14, fontWeight: 600 }}>
            ← Back to site
          </Link>
          <a
            href="https://wa.me/31610431511?text=Hi%20WidgetAI%2C%20I%20want%20to%20set%20up%20the%20AI%20booking%20widget%20for%20my%20barbershop."
            target="_blank"
            rel="noreferrer"
            style={{ display: 'inline-block', padding: '10px 20px', background: '#10B981', color: '#fff', borderRadius: 10, textDecoration: 'none', fontSize: 14, fontWeight: 700 }}
          >
            Get this for my shop →
          </a>
        </div>
      </div>
    </main>
  );
}
