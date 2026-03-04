'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

type OwnerBusiness = {
  businessId: string;
  name: string;
  timezone: string;
  bookingMode: 'request' | 'calendar';
  contact: { phone: string; email?: string; address?: string };
  services: { name: string; durationMin: number; priceRange?: string }[];
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export default function OwnerPage() {
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState('');
  const [token, setToken] = useState('');
  const [businesses, setBusinesses] = useState<OwnerBusiness[]>([]);
  const [selectedBusinessId, setSelectedBusinessId] = useState('');
  const [dashboard, setDashboard] = useState<any>(null);
  const [newBiz, setNewBiz] = useState({
    businessId: '',
    name: '',
    timezone: 'America/New_York',
    phone: '',
    email: '',
    bookingMode: 'calendar' as 'request' | 'calendar',
    servicesText: 'Classic Haircut:30, Skin Fade:45'
  });

  const selected = useMemo(
    () => businesses.find((b) => b.businessId === selectedBusinessId) || null,
    [businesses, selectedBusinessId]
  );

  async function loadSession() {
    const { data } = await supabase.auth.getSession();
    const t = data.session?.access_token || '';
    setToken(t);
    if (t) {
      await loadBusinesses(t);
    }
  }

  useEffect(() => {
    loadSession();
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      const t = session?.access_token || '';
      setToken(t);
      if (t) loadBusinesses(t);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  async function sendMagicLink() {
    setMsg('');
    const { error } = await supabase.auth.signInWithOtp({ email });
    if (error) setMsg(error.message);
    else setMsg('Magic link sent. Check your email.');
  }

  async function loadBusinesses(authToken: string) {
    const res = await fetch('/api/owner/businesses', {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    const data = await res.json();
    if (!res.ok) {
      setMsg(data.error || 'Failed to load businesses');
      return;
    }
    setBusinesses(data.businesses || []);
    if (!selectedBusinessId && data.businesses?.length) {
      setSelectedBusinessId(data.businesses[0].businessId);
      loadDashboard(authToken, data.businesses[0].businessId);
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

  async function createBusiness() {
    setMsg('');
    if (!token) return;
    const services = newBiz.servicesText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => {
        const [name, mins] = s.split(':').map((v) => v.trim());
        return { name, durationMin: Number(mins || '30'), priceRange: '' };
      });

    const res = await fetch('/api/owner/businesses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        businessId: newBiz.businessId,
        name: newBiz.name,
        timezone: newBiz.timezone,
        contact: { phone: newBiz.phone, email: newBiz.email },
        bookingMode: newBiz.bookingMode,
        services
      })
    });
    const data = await res.json();
    if (!res.ok) {
      setMsg(data.error || 'Failed to create business');
      return;
    }
    setMsg('Business created.');
    await loadBusinesses(token);
    setSelectedBusinessId(newBiz.businessId);
    await loadDashboard(token, newBiz.businessId);
  }

  function connectCalendar() {
    if (!selectedBusinessId) return;
    window.location.href = `/api/auth/google/start?businessId=${encodeURIComponent(selectedBusinessId)}&password=password`;
  }

  if (!token) {
    return (
      <main style={{ maxWidth: 620, margin: '40px auto', padding: 20 }}>
        <h1>Owner Portal</h1>
        <p>Sign in with a magic link to manage your business widget.</p>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="owner@business.com"
            style={{ flex: 1, padding: 8 }}
          />
          <button onClick={sendMagicLink} style={{ padding: '8px 14px' }}>Send Magic Link</button>
        </div>
        {msg ? <p>{msg}</p> : null}
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 1040, margin: '30px auto', padding: 20 }}>
      <h1>Owner Dashboard</h1>
      <p>Manage businesses, connect calendar, and track bookings.</p>

      <section style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 14, marginBottom: 16 }}>
        <h3>Create Business</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 8 }}>
          <input placeholder="business id" value={newBiz.businessId} onChange={(e) => setNewBiz({ ...newBiz, businessId: e.target.value })} />
          <input placeholder="business name" value={newBiz.name} onChange={(e) => setNewBiz({ ...newBiz, name: e.target.value })} />
          <input placeholder="timezone" value={newBiz.timezone} onChange={(e) => setNewBiz({ ...newBiz, timezone: e.target.value })} />
          <input placeholder="phone" value={newBiz.phone} onChange={(e) => setNewBiz({ ...newBiz, phone: e.target.value })} />
          <input placeholder="email" value={newBiz.email} onChange={(e) => setNewBiz({ ...newBiz, email: e.target.value })} />
          <select value={newBiz.bookingMode} onChange={(e) => setNewBiz({ ...newBiz, bookingMode: e.target.value as 'request' | 'calendar' })}>
            <option value="calendar">calendar</option>
            <option value="request">request</option>
          </select>
          <input style={{ gridColumn: '1 / -1' }} placeholder="services format: Name:Minutes, Name:Minutes" value={newBiz.servicesText} onChange={(e) => setNewBiz({ ...newBiz, servicesText: e.target.value })} />
        </div>
        <button onClick={createBusiness} style={{ marginTop: 10, padding: '8px 14px' }}>Create / Save</button>
      </section>

      <section style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 14, marginBottom: 16 }}>
        <h3>Your Businesses</h3>
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
            <h4>Recent Bookings</h4>
            <div style={{ display: 'grid', gap: 6 }}>
              {(dashboard.recentBookings || []).slice(0, 12).map((b: any) => (
                <div key={b.id} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 8 }}>
                  <strong>{b.service}</strong> - {new Date(b.start_time).toLocaleString()} - {b.customer_name} ({b.customer_email})
                </div>
              ))}
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
