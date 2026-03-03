'use client';

import Script from 'next/script';
import { useMemo, useState } from 'react';

export default function DemoClient({ initialBiz }: { initialBiz: string }) {
  const [businessId, setBusinessId] = useState(initialBiz);
  const embedCode = useMemo(
    () => `<script src="${typeof window === 'undefined' ? 'http://localhost:3000' : window.location.origin}/widget.js" data-business="${businessId}" data-position="bottom-right" data-accent="#111827"></script>`,
    [businessId]
  );

  return (
    <main style={{ maxWidth: 1000, margin: '32px auto', padding: 24 }}>
      <Script id="demo-widget" src="/widget.js" strategy="afterInteractive" data-business={initialBiz} data-position="bottom-right" data-accent="#111827" />
      <h1>Widget Demo</h1>
      <p>This page simulates a customer website embedding your widget.</p>
      <div style={{ display: 'grid', gap: 10, maxWidth: 460, background: 'white', padding: 16, borderRadius: 12 }}>
        <label htmlFor="biz">Business ID</label>
        <input id="biz" value={businessId} onChange={(e) => setBusinessId(e.target.value)} style={{ padding: 8 }} />
        <a href={`/demo?biz=${encodeURIComponent(businessId)}`} style={{ width: 'fit-content', padding: '8px 12px', background: '#111827', color: 'white', borderRadius: 8, textDecoration: 'none' }}>
          Reload with this business
        </a>
      </div>
      <h3 style={{ marginTop: 24 }}>Embed snippet</h3>
      <pre style={{ background: '#0f172a', color: '#e2e8f0', padding: 12, borderRadius: 8, overflow: 'auto' }}>{embedCode}</pre>
    </main>
  );
}
