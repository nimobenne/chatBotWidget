'use client';

import { useEffect, useMemo, useState } from 'react';

type OwnerBusiness = {
  businessId: string;
  name: string;
  timezone: string;
  bookingMode: 'calendar';
  contact: { phone: string; email?: string; address?: string };
  services: { name: string; durationMin: number; priceRange?: string }[];
};

const TOKEN_KEY = 'owner_portal_token';

export default function OwnerPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');
  const [token, setToken] = useState('');
  const [businesses, setBusinesses] = useState<OwnerBusiness[]>([]);
  const [selectedBusinessId, setSelectedBusinessId] = useState('');
  const [dashboard, setDashboard] = useState<any>(null);

  const selected = useMemo(
    () => businesses.find((b) => b.businessId === selectedBusinessId) || null,
    [businesses, selectedBusinessId]
  );

  useEffect(() => {
    const savedToken = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) || '' : '';
    if (savedToken) {
      setToken(savedToken);
      loadBusinesses(savedToken);
    }
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
      setMsg(data.error || 'Login failed');
      return;
    }
    const nextToken = data.token || '';
    setToken(nextToken);
    localStorage.setItem(TOKEN_KEY, nextToken);
    await loadBusinesses(nextToken);
  }

  function logout() {
    setToken('');
    setBusinesses([]);
    setSelectedBusinessId('');
    setDashboard(null);
    localStorage.removeItem(TOKEN_KEY);
  }

  async function loadBusinesses(authToken: string) {
    const res = await fetch('/api/owner/businesses', {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    const data = await res.json();
    if (!res.ok) {
      if (res.status === 401) logout();
      setMsg(data.error || 'Failed to load businesses');
      return;
    }
    setBusinesses(data.businesses || []);
    if (data.businesses?.length) {
      const first = data.businesses[0].businessId;
      setSelectedBusinessId(first);
      loadDashboard(authToken, first);
    }
  }

  async function loadDashboard(authToken: string, businessId: string) {
    const res = await fetch(`/api/owner/dashboard?businessId=${encodeURIComponent(businessId)}`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    const data = await res.json();
    if (!res.ok) {
      setMsg(data.error || 'Failed to load dashboard');
      return;
    }
    setDashboard(data);
  }

  function connectCalendar() {
    if (!selectedBusinessId || !token) return;
    fetch(`/api/auth/google/start?businessId=${encodeURIComponent(selectedBusinessId)}&mode=url`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || 'Failed to start OAuth');
        window.location.href = data.url;
      })
      .catch((e) => setMsg(String(e.message || e)));
  }

  if (!token) {
    return (
      <main style={{ maxWidth: 520, margin: '50px auto', padding: 20 }}>
        <h1>Owner Portal</h1>
        <p>Use your admin-provided username and password.</p>
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
          <button onClick={login} style={{ padding: '8px 14px' }}>Sign In</button>
        </div>
        {msg ? <p>{msg}</p> : null}
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 1040, margin: '30px auto', padding: 20 }}>
      <h1>Owner Dashboard</h1>
      <p>Connect calendar and track bookings.</p>
      <div style={{ marginBottom: 12 }}>
        <button onClick={logout} style={{ padding: '8px 14px' }}>Sign Out</button>
      </div>

      <section style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 14, marginBottom: 16 }}>
        <h3>Assigned Business</h3>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
          <select value={selectedBusinessId} onChange={(e) => {
            setSelectedBusinessId(e.target.value);
            loadDashboard(token, e.target.value);
          }} style={{ minWidth: 320, padding: 8 }}>
            <option value="">Select business</option>
            {businesses.map((b) => (
              <option key={b.businessId} value={b.businessId}>{b.businessId} - {b.name}</option>
            ))}
          </select>
          <button onClick={connectCalendar} disabled={!selectedBusinessId} style={{ padding: '8px 14px' }}>Connect Calendar</button>
        </div>
        {selected ? (
          <div style={{ fontSize: 14 }}>
            <div><strong>Timezone:</strong> {selected.timezone}</div>
            <div><strong>Phone:</strong> {selected.contact.phone}</div>
            <div><strong>Services:</strong> {selected.services.map((s) => `${s.name} (${s.durationMin}m)`).join(', ')}</div>
          </div>
        ) : null}
      </section>

      <section style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 14 }}>
        <h3>Analytics (last 30 days)</h3>
        {dashboard ? (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 8, marginBottom: 12 }}>
              <Stat title="Bookings" value={dashboard.metrics.bookings30d} />
              <Stat title="Confirmed" value={dashboard.metrics.confirmed30d} />
              <Stat title="Conversations" value={dashboard.metrics.conversations30d} />
              <Stat title="Conversion" value={`${dashboard.metrics.conversionRate}%`} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 8, marginBottom: 12 }}>
              <Stat title="Calendar Synced" value={dashboard.metrics.calendarSynced30d} />
              <Stat title="Top Service" value={dashboard.topServices?.[0]?.service || 'n/a'} />
            </div>
          </>
        ) : (
          <p>Select a business to load dashboard.</p>
        )}
      </section>

      {msg ? <p style={{ marginTop: 12 }}>{msg}</p> : null}
    </main>
  );
}

function Stat({ title, value }: { title: string; value: string | number }) {
  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 10 }}>
      <div style={{ fontSize: 12, color: '#64748b' }}>{title}</div>
      <div style={{ fontSize: 22, fontWeight: 700 }}>{value}</div>
    </div>
  );
}
