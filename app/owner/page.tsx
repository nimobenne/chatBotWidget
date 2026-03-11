'use client';

import { useEffect, useMemo, useState } from 'react';
import { friendlyError } from '@/lib/userError';

type OwnerBusiness = {
  businessId: string;
  name: string;
  timezone: string;
  bookingMode: 'calendar';
  contact: { phone: string; email?: string; address?: string };
  services: { name: string; durationMin: number; priceRange?: string }[];
  allowedDomains?: string[];
  styling?: { accentColor?: string };
};

export default function OwnerPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');
  const [authed, setAuthed] = useState(false);
  const [businesses, setBusinesses] = useState<OwnerBusiness[]>([]);
  const [selectedBusinessId, setSelectedBusinessId] = useState('');
  const [dashboard, setDashboard] = useState<any>(null);
  const [snippetPosition, setSnippetPosition] = useState('bottom-right');
  const [snippetAccent, setSnippetAccent] = useState('#10B981');
  const [snippetGreeting, setSnippetGreeting] = useState("Hi! Ready to book your next cut?");
  const [snippetCopied, setSnippetCopied] = useState(false);
  const [domainLiveStatus, setDomainLiveStatus] = useState<Record<string, { checking: boolean; live?: boolean; checkedUrl?: string; foundScript?: string | null; error?: string }>>({});
  const [calendarStatus, setCalendarStatus] = useState<{ loading: boolean; connected?: boolean; usable?: boolean; error?: string | null }>({ loading: false });

  const selected = useMemo(
    () => businesses.find((b) => b.businessId === selectedBusinessId) || null,
    [businesses, selectedBusinessId]
  );

  useEffect(() => {
    loadBusinesses();
  }, []);

  async function login() {
    setMsg('');
    const res = await fetch('/api/owner/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (!res.ok) {
      setMsg(friendlyError(data));
      return;
    }
    setAuthed(true);
    await loadBusinesses();
  }

  async function logout() {
    await fetch('/api/owner/auth/logout', { method: 'POST' });
    setAuthed(false);
    setBusinesses([]);
    setSelectedBusinessId('');
    setDashboard(null);
  }

  async function loadBusinesses() {
    const res = await fetch('/api/owner/businesses');
    const data = await res.json();
    if (!res.ok) {
      if (res.status === 401) { setAuthed(false); return; }
      setMsg(friendlyError(data));
      return;
    }
    setAuthed(true);
    setBusinesses(data.businesses || []);
    if (data.businesses?.length) {
      const first = data.businesses[0].businessId;
      setSelectedBusinessId(first);
      loadDashboard(first);
    }
  }

  async function loadDashboard(businessId: string) {
    const res = await fetch(`/api/owner/dashboard?businessId=${encodeURIComponent(businessId)}`);
    const data = await res.json();
    if (!res.ok) {
      setMsg(friendlyError(data));
      return;
    }
    setDashboard(data);
    loadCalendarStatus(businessId);
  }

  async function loadCalendarStatus(businessId: string) {
    setCalendarStatus({ loading: true });
    try {
      const res = await fetch(`/api/auth/google/status?businessId=${encodeURIComponent(businessId)}`);
      const data = await res.json();
      if (!res.ok) {
        setCalendarStatus({ loading: false, error: friendlyError(data) });
        return;
      }
      setCalendarStatus({ loading: false, connected: data.connectedInDb, usable: data.usable, error: data.checkError });
    } catch {
      setCalendarStatus({ loading: false, error: 'Failed to check calendar status' });
    }
  }

  function connectCalendar() {
    if (!selectedBusinessId) return;
    fetch(`/api/auth/google/start?businessId=${encodeURIComponent(selectedBusinessId)}&mode=url&reconnect=1`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(friendlyError(data));
        window.location.href = data.url;
      })
      .catch((e) => setMsg(String(e.message || e)));
  }

  async function exportCsv(type: 'bookings' | 'handoffs') {
    if (!selectedBusinessId) return;
    try {
      const res = await fetch(`/api/owner/export?type=${type}&businessId=${encodeURIComponent(selectedBusinessId)}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(friendlyError(data));
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type}_${selectedBusinessId}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      setMsg(`${type} export downloaded.`);
    } catch (error) {
      setMsg(String((error as any)?.message || error));
    }
  }

  function buildSnippet(businessId: string, accent: string, position: string, greeting: string) {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return `<script\n  src="${origin}/widget.js"\n  data-business="${businessId}"\n  data-accent="${accent}"\n  data-position="${position}"\n  data-greeting="${greeting}"\n></script>`;
  }

  if (!authed) {
    return (
      <main style={{ maxWidth: 520, margin: '80px auto', padding: 20 }}>
        <div style={{ border: '1px solid #334155', borderRadius: 14, background: '#0b1220', padding: 20 }}>
          <h1 style={{ marginTop: 0 }}>Owner Portal</h1>
          <p style={{ color: '#94a3b8' }}>Use your admin-provided username and password.</p>
          <div style={{ display: 'grid', gap: 8 }}>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
              style={{ padding: 8 }}
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              style={{ padding: 8 }}
            />
            <button onClick={login} style={{ padding: '10px 14px' }}>Sign In</button>
          </div>
          {msg ? <p style={{ marginTop: 10 }}>{msg}</p> : null}
        </div>
      </main>
    );
  }

  const roi = dashboard?.roi || {};
  const metrics = dashboard?.metrics || {};
  const monthlyCost = Number(dashboard?.billing?.monthlyCostEur || 39.99);

  return (
    <main style={{ maxWidth: 1120, margin: '24px auto', padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0 }}>Owner Dashboard</h1>
          <div style={{ color: '#94a3b8' }}>See your ROI, bookings, and growth performance at a glance.</div>
        </div>
        <button onClick={logout} style={{ padding: '8px 14px' }}>Sign Out</button>
      </div>

      <section style={{ marginTop: 14, border: '1px solid #334155', borderRadius: 12, padding: 14, background: '#111827' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
          {selected && <span style={{ fontWeight: 600, color: '#e2e8f0', padding: '8px 0', marginRight: 4 }}>{selected.name}</span>}
          {calendarStatus.loading ? (
            <span style={{ fontSize: 13, color: '#94a3b8' }}>Checking calendar...</span>
          ) : calendarStatus.connected && calendarStatus.usable ? (
            <span style={{ fontSize: 13, color: '#86efac', display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#86efac', display: 'inline-block' }} />
              Calendar connected
            </span>
          ) : (
            <>
              <span style={{ fontSize: 13, color: calendarStatus.connected ? '#fbbf24' : '#fca5a5', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: calendarStatus.connected ? '#fbbf24' : '#fca5a5', display: 'inline-block' }} />
                {calendarStatus.connected ? 'Calendar issue' : 'No calendar'}
                {calendarStatus.error ? ` — ${calendarStatus.error}` : ''}
              </span>
              <button onClick={connectCalendar} disabled={!selectedBusinessId}>
                {calendarStatus.connected ? 'Reconnect Calendar' : 'Connect Calendar'}
              </button>
            </>
          )}
          <button onClick={() => exportCsv('bookings')} disabled={!selectedBusinessId}>Export Bookings CSV</button>
          <button onClick={() => exportCsv('handoffs')} disabled={!selectedBusinessId}>Export Handoffs CSV</button>
        </div>
        {selected ? (
          <div style={{ fontSize: 13, color: '#cbd5e1' }}>
            <div><strong>Timezone:</strong> {selected.timezone}</div>
            <div><strong>Phone:</strong> {selected.contact.phone}</div>
            <div><strong>Services:</strong> {selected.services.map((s) => `${s.name} (${s.durationMin}m)`).join(', ')}</div>
          </div>
        ) : null}
      </section>

      {dashboard?.billing?.warning ? (
        <div style={{ marginTop: 12, padding: 10, borderRadius: 10, background: '#7f1d1d', color: '#fee2e2', border: '1px solid #991b1b' }}>
          {dashboard.billing.warning}
        </div>
      ) : null}

      <section style={{ marginTop: 14, display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 10 }}>
        <Stat title="Estimated Revenue (30d)" value={`EUR ${Number(roi.estimatedRevenue30d || 0).toLocaleString()}`} hint="Approximate value generated by confirmed bookings." />
        <Stat title="ROI Multiple" value={`${Number(roi.roiMultiple || 0).toFixed(2)}x`} hint={`Compared to monthly cost (EUR ${monthlyCost}).`} />
        <Stat title="Bookings Captured" value={metrics.confirmed30d || 0} hint="Confirmed appointments in the last 30 days." />
        <Stat title="Calls Saved (est.)" value={roi.estimatedCallsSaved30d || 0} hint="Estimated conversations handled for you." />
      </section>

      <section style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
        <div style={{ border: '1px solid #334155', borderRadius: 12, padding: 14, background: '#0b1220' }}>
          <h3 style={{ marginTop: 0 }}>Why this is worth it</h3>
          <div style={{ color: '#cbd5e1', marginBottom: 8 }}>
            Estimated value delivered this month: <strong>EUR {Number(roi.estimatedRevenue30d || 0).toLocaleString()}</strong>
          </div>
          <div style={{ color: '#cbd5e1', marginBottom: 8 }}>
            Monthly cost: <strong>EUR {monthlyCost}</strong>
          </div>
          <div style={{ color: '#cbd5e1', marginBottom: 8 }}>
            Approx bookings to cover cost: <strong>{roi.bookingsToCoverCost || 0}</strong>
          </div>
          <div style={{ color: '#86efac' }}>Even a few extra haircuts can cover your monthly plan.</div>
        </div>

        <div style={{ border: '1px solid #334155', borderRadius: 12, padding: 14, background: '#0b1220' }}>
          <h3 style={{ marginTop: 0 }}>Growth snapshot</h3>
          <div style={{ marginBottom: 6 }}>After-hours bookings: <strong>{roi.afterHoursBookings30d || 0}</strong></div>
          <div style={{ marginBottom: 6 }}>Client chats: <strong>{metrics.conversations30d || 0}</strong></div>
          <div style={{ marginBottom: 6 }}>Chat to booking: <strong>{metrics.conversionRate || 0}%</strong></div>
          <div style={{ marginBottom: 6 }}>Calendar synced: <strong>{metrics.calendarSynced30d || 0}</strong></div>
        </div>
      </section>

      <section style={{ marginTop: 12, border: '1px solid #334155', borderRadius: 12, padding: 14, background: '#0b1220' }}>
        <h3 style={{ marginTop: 0 }}>Top services</h3>
        {dashboard?.topServices?.length ? (
          <div style={{ display: 'grid', gap: 6 }}>
            {dashboard.topServices.slice(0, 5).map((s: any) => (
              <div key={s.service} style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>{s.service}</span>
                <strong>{s.count}</strong>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ marginBottom: 0, color: '#94a3b8' }}>No booking data yet.</p>
        )}
      </section>

      <section style={{ marginTop: 12, border: '1px solid #334155', borderRadius: 12, padding: 14, background: '#0b1220' }}>
        <h3 style={{ marginTop: 0 }}>Installation</h3>
        <p style={{ color: '#94a3b8', marginTop: 0, marginBottom: 12 }}>
          Add this snippet to your website&apos;s &lt;head&gt; or just before &lt;/body&gt;.
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
          <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
            Position:
            <select value={snippetPosition} onChange={(e) => setSnippetPosition(e.target.value)}>
              <option value="bottom-right">Bottom Right</option>
              <option value="bottom-left">Bottom Left</option>
              <option value="top-right">Top Right</option>
              <option value="top-left">Top Left</option>
            </select>
          </label>
          <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
            Accent:
            <input
              type="color"
              value={snippetAccent}
              onChange={(e) => setSnippetAccent(e.target.value)}
              style={{ width: 40, height: 28, padding: 2, cursor: 'pointer' }}
            />
          </label>
          <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 220 }}>
            Greeting:
            <input
              value={snippetGreeting}
              onChange={(e) => setSnippetGreeting(e.target.value)}
              style={{ flex: 1 }}
            />
          </label>
        </div>
        {selected ? (
          <>
            <pre style={{ background: '#020617', color: '#93c5fd', padding: 12, borderRadius: 8, fontSize: 12, overflowX: 'auto', margin: 0, whiteSpace: 'pre' }}>
              {buildSnippet(selected.businessId, snippetAccent, snippetPosition, snippetGreeting)}
            </pre>
            <button
              onClick={() => {
                navigator.clipboard
                  .writeText(buildSnippet(selected.businessId, snippetAccent, snippetPosition, snippetGreeting))
                  .then(() => { setSnippetCopied(true); setTimeout(() => setSnippetCopied(false), 2000); })
                  .catch(() => {});
              }}
              style={{ marginTop: 8 }}
            >
              {snippetCopied ? 'Copied!' : 'Copy to Clipboard'}
            </button>
            {(selected.allowedDomains || []).filter((d) => d && d !== '*' && !d.includes('localhost') && !d.includes('127.0.0.1')).length > 0 && (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Live status by domain:</div>
                {(selected.allowedDomains || [])
                  .filter((d) => d && d !== '*' && !d.includes('localhost') && !d.includes('127.0.0.1'))
                  .map((domain) => {
                    const st = domainLiveStatus[domain];
                    return (
                      <div key={domain} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 13, color: '#cbd5e1', minWidth: 180 }}>{domain}</span>
                        <button
                          disabled={st?.checking}
                          onClick={async () => {
                            setDomainLiveStatus((prev) => ({ ...prev, [domain]: { checking: true } }));
                            try {
                              const res = await fetch(
                                `/api/owner/widget-status?businessId=${encodeURIComponent(selected.businessId)}&url=${encodeURIComponent(`https://${domain}`)}`
                              );
                              const data = await res.json();
                              setDomainLiveStatus((prev) => ({ ...prev, [domain]: { checking: false, ...data } }));
                            } catch {
                              setDomainLiveStatus((prev) => ({ ...prev, [domain]: { checking: false, error: 'Request failed' } }));
                            }
                          }}
                        >
                          {st?.checking ? 'Checking...' : 'Check Live'}
                        </button>
                        {st && !st.checking && (
                          <span style={{ fontSize: 12, color: st.error ? '#fbbf24' : st.live ? '#86efac' : '#fca5a5' }}>
                            {st.error ? `⚠️ ${st.error}` : st.live ? '✅ Widget detected' : '❌ Not found'}
                          </span>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
          </>
        ) : (
          <p style={{ color: '#64748b', margin: 0 }}>Select a business to see the snippet.</p>
        )}
      </section>

      {msg ? <p style={{ marginTop: 12 }}>{msg}</p> : null}
    </main>
  );
}

function Stat({ title, value, hint }: { title: string; value: string | number; hint: string }) {
  return (
    <div style={{ border: '1px solid #334155', borderRadius: 12, padding: 12, background: '#0b1220' }}>
      <div style={{ fontSize: 12, color: '#94a3b8' }}>{title}</div>
      <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>{value}</div>
      <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>{hint}</div>
    </div>
  );
}
