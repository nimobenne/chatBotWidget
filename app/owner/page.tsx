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
};

export default function OwnerPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');
  const [authed, setAuthed] = useState(false);
  const [businesses, setBusinesses] = useState<OwnerBusiness[]>([]);
  const [selectedBusinessId, setSelectedBusinessId] = useState('');
  const [dashboard, setDashboard] = useState<any>(null);

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

  function checkCalendarStatus() {
    if (!selectedBusinessId) return;
    fetch(`/api/auth/google/status?businessId=${encodeURIComponent(selectedBusinessId)}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(friendlyError(data));
        if (!data.connectedInDb) {
          setMsg(`No calendar connection row exists for ${selectedBusinessId}.`);
          return;
        }
        if (data.usable) {
          setMsg(`Calendar connected for ${selectedBusinessId}. calendarId=${data.calendarId}.`);
          return;
        }
        setMsg(`Calendar row exists but token is not usable. ${data.checkError || ''}`.trim());
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
          <select value={selectedBusinessId} onChange={(e) => {
            setSelectedBusinessId(e.target.value);
            loadDashboard(e.target.value);
          }} style={{ minWidth: 320, padding: 8 }}>
            <option value="">Select business</option>
            {businesses.map((b) => (
              <option key={b.businessId} value={b.businessId}>{b.businessId} - {b.name}</option>
            ))}
          </select>
          <button onClick={connectCalendar} disabled={!selectedBusinessId}>Connect Calendar</button>
          <button onClick={checkCalendarStatus} disabled={!selectedBusinessId}>Check Calendar Status</button>
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
