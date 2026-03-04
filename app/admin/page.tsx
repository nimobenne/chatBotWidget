'use client';

import { useEffect, useMemo, useState } from 'react';
import { BusinessConfig } from '@/lib/types';

const defaultBusiness: BusinessConfig = {
  businessId: 'demo_barber',
  name: 'Demo Barber',
  timezone: 'America/New_York',
  hours: {
    monday: { open: '09:00', close: '18:00' },
    tuesday: { open: '09:00', close: '18:00' },
    wednesday: { open: '09:00', close: '18:00' },
    thursday: { open: '09:00', close: '19:00' },
    friday: { open: '09:00', close: '19:00' },
    saturday: { open: '10:00', close: '16:00' },
    sunday: null
  },
  services: [
    { name: 'Classic Haircut', durationMin: 30, priceRange: '$30-$40', bufferMin: 10 },
    { name: 'Skin Fade', durationMin: 45, priceRange: '$40-$55', bufferMin: 10 },
    { name: 'Beard Trim', durationMin: 20, priceRange: '$20-$30', bufferMin: 5 }
  ],
  policies: {
    cancellation: 'Please provide at least 12 hours notice for cancellations.',
    booking: 'Walk-ins welcome, appointments recommended.'
  },
  contact: {
    phone: '+1-555-0100',
    email: 'hello@example.com',
    address: '100 Main St, Suite 12'
  },
  faq: {
    parking: 'Street parking is available nearby.'
  },
  allowedDomains: ['localhost', '127.0.0.1'],
  bookingMode: 'calendar',
  styling: { accentColor: '#111827' }
};

const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;

export default function AdminPage() {
  const [password, setPassword] = useState('password');
  const [businesses, setBusinesses] = useState<BusinessConfig[]>([]);
  const [selectedBusinessId, setSelectedBusinessId] = useState('');
  const [form, setForm] = useState<BusinessConfig>(defaultBusiness);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [intakeRequests, setIntakeRequests] = useState<any[]>([]);

  useEffect(() => {
    if (!password) return;
    fetch('/api/businesses', { headers: { 'x-admin-password': password } })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || 'Failed to load businesses');
        const list = (data.businesses || []) as BusinessConfig[];
        setBusinesses(list);
        fetch('/api/admin/intake/requests', { headers: { 'x-admin-password': password } })
          .then((r) => r.json())
          .then((d) => setIntakeRequests(d.requests || []))
          .catch(() => null);
        if (list.length && !selectedBusinessId) {
          setSelectedBusinessId(list[0].businessId);
          setForm(list[0]);
        }
      })
      .catch((e) => setMessage(String(e.message || e)));
  }, [password]);

  const selectedBusiness = useMemo(
    () => businesses.find((b) => b.businessId === selectedBusinessId) || null,
    [businesses, selectedBusinessId]
  );

  useEffect(() => {
    if (selectedBusiness) setForm(selectedBusiness);
  }, [selectedBusiness]);

  function updateField<K extends keyof BusinessConfig>(key: K, value: BusinessConfig[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function approveRequest(requestId: string) {
    try {
      const res = await fetch('/api/admin/intake/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
        body: JSON.stringify({ requestId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to approve');
      setMessage(`Approved request for ${data.businessSlug}`);
      const refreshed = await fetch('/api/businesses', {
        headers: { 'x-admin-password': password }
      }).then((r) => r.json());
      setBusinesses(refreshed.businesses || []);
      const reqs = await fetch('/api/admin/intake/requests', { headers: { 'x-admin-password': password } }).then((r) => r.json());
      setIntakeRequests(reqs.requests || []);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Error');
    }
  }

  function updateDay(day: (typeof dayNames)[number], key: 'open' | 'close', value: string) {
    setForm((prev) => {
      const current = prev.hours[day] || { open: '09:00', close: '18:00' };
      return {
        ...prev,
        hours: {
          ...prev.hours,
          [day]: { ...current, [key]: value }
        }
      };
    });
  }

  function toggleClosed(day: (typeof dayNames)[number], closed: boolean) {
    setForm((prev) => ({
      ...prev,
      hours: {
        ...prev.hours,
        [day]: closed ? null : { open: '09:00', close: '18:00' }
      }
    }));
  }

  function addService() {
    setForm((prev) => ({
      ...prev,
      services: [...prev.services, { name: 'New Service', durationMin: 30, priceRange: '', bufferMin: 0 }]
    }));
  }

  function updateService(index: number, key: 'name' | 'durationMin' | 'priceRange' | 'bufferMin', value: string) {
    setForm((prev) => {
      const next = [...prev.services];
      const service = { ...next[index] } as any;
      service[key] = key === 'name' || key === 'priceRange' ? value : Number(value || 0);
      next[index] = service;
      return { ...prev, services: next };
    });
  }

  function removeService(index: number) {
    setForm((prev) => ({ ...prev, services: prev.services.filter((_, i) => i !== index) }));
  }

  async function saveBusiness() {
    setSaving(true);
    setMessage('');
    try {
      const res = await fetch('/api/businesses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');
      setMessage('Business saved.');
      const refreshed = await fetch('/api/businesses', {
        headers: { 'x-admin-password': password }
      }).then((r) => r.json());
      setBusinesses(refreshed.businesses || []);
      setSelectedBusinessId(form.businessId);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Error');
    } finally {
      setSaving(false);
    }
  }

  function startNewBusiness() {
    setSelectedBusinessId('');
    setForm({
      ...defaultBusiness,
      businessId: `biz_${Math.random().toString(36).slice(2, 8)}`,
      name: 'New Business'
    });
  }

  function connectGoogleCalendar() {
    if (!password || !form.businessId) {
      setMessage('Set admin password and business id first.');
      return;
    }
    fetch(`/api/auth/google/start?businessId=${encodeURIComponent(form.businessId)}&mode=url`, {
      headers: { 'x-admin-password': password }
    })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || 'Failed to start OAuth');
        window.location.href = data.url;
      })
      .catch((e) => setMessage(String(e.message || e)));
  }

  return (
    <main style={{ maxWidth: 1100, margin: '24px auto', padding: 16 }}>
      <h1>Admin</h1>
      <p>Default password is <code>password</code> (set ADMIN_PASSWORD in production).</p>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
        <input
          type="password"
          placeholder="Admin password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ padding: 8, minWidth: 260 }}
        />
        <select
          value={selectedBusinessId}
          onChange={(e) => setSelectedBusinessId(e.target.value)}
          style={{ padding: 8, minWidth: 260 }}
        >
          <option value="">Select existing business</option>
          {businesses.map((b) => (
            <option key={b.businessId} value={b.businessId}>
              {b.businessId} - {b.name}
            </option>
          ))}
        </select>
        <button onClick={startNewBusiness} style={{ padding: '8px 14px' }}>New Business</button>
        <button onClick={connectGoogleCalendar} style={{ padding: '8px 14px' }}>Connect Calendar</button>
      </div>

      <h3>Business Details</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
        <input value={form.businessId} onChange={(e) => updateField('businessId', e.target.value)} placeholder="Business ID (e.g. demo_barber)" />
        <input value={form.name} onChange={(e) => updateField('name', e.target.value)} placeholder="Business Name" />
        <input value={form.timezone} onChange={(e) => updateField('timezone', e.target.value)} placeholder="Timezone" />
        <select value={form.bookingMode} onChange={(e) => updateField('bookingMode', e.target.value as BusinessConfig['bookingMode'])}>
          <option value="calendar">calendar (online booking)</option>
          <option value="request">request (manual booking)</option>
        </select>
        <input value={form.contact.phone || ''} onChange={(e) => updateField('contact', { ...form.contact, phone: e.target.value })} placeholder="Phone" />
        <input value={form.contact.email || ''} onChange={(e) => updateField('contact', { ...form.contact, email: e.target.value })} placeholder="Email" />
        <input value={form.contact.address || ''} onChange={(e) => updateField('contact', { ...form.contact, address: e.target.value })} placeholder="Address" />
        <input value={form.styling?.accentColor || '#111827'} onChange={(e) => updateField('styling', { accentColor: e.target.value })} placeholder="Accent color hex" />
      </div>

      <h3 style={{ marginTop: 16 }}>Allowed Domains (comma separated)</h3>
      <input
        value={form.allowedDomains.join(', ')}
        onChange={(e) => updateField('allowedDomains', e.target.value.split(',').map((x) => x.trim()).filter(Boolean))}
        placeholder="localhost, yoursite.com"
        style={{ width: '100%' }}
      />

      <h3 style={{ marginTop: 16 }}>Hours</h3>
      <div style={{ display: 'grid', gap: 8 }}>
        {dayNames.map((day) => {
          const rule = form.hours[day];
          const closed = rule === null;
          return (
            <div key={day} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <strong style={{ width: 100, textTransform: 'capitalize' }}>{day}</strong>
              <label>
                <input
                  type="checkbox"
                  checked={closed}
                  onChange={(e) => toggleClosed(day, e.target.checked)}
                /> Closed
              </label>
              {!closed && (
                <>
                  <input type="time" value={rule?.open || '09:00'} onChange={(e) => updateDay(day, 'open', e.target.value)} />
                  <input type="time" value={rule?.close || '18:00'} onChange={(e) => updateDay(day, 'close', e.target.value)} />
                </>
              )}
            </div>
          );
        })}
      </div>

      <h3 style={{ marginTop: 16 }}>Services</h3>
      {form.services.map((s, i) => (
        <div key={`${s.name}-${i}`} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: 8, marginBottom: 8 }}>
          <input value={s.name} onChange={(e) => updateService(i, 'name', e.target.value)} placeholder="Service name" />
          <input type="number" value={s.durationMin} onChange={(e) => updateService(i, 'durationMin', e.target.value)} placeholder="Duration" />
          <input value={s.priceRange || ''} onChange={(e) => updateService(i, 'priceRange', e.target.value)} placeholder="Price" />
          <input type="number" value={s.bufferMin || 0} onChange={(e) => updateService(i, 'bufferMin', e.target.value)} placeholder="Buffer" />
          <button onClick={() => removeService(i)}>Remove</button>
        </div>
      ))}
      <button onClick={addService}>Add Service</button>

      <h3 style={{ marginTop: 16 }}>Policies</h3>
      <textarea value={form.policies.booking} onChange={(e) => updateField('policies', { ...form.policies, booking: e.target.value })} rows={2} style={{ width: '100%' }} placeholder="Booking policy" />
      <textarea value={form.policies.cancellation} onChange={(e) => updateField('policies', { ...form.policies, cancellation: e.target.value })} rows={2} style={{ width: '100%', marginTop: 8 }} placeholder="Cancellation policy" />

      <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
        <button onClick={saveBusiness} disabled={saving} style={{ padding: '8px 14px' }}>
          {saving ? 'Saving...' : 'Save Business'}
        </button>
      </div>

      <h3 style={{ marginTop: 16 }}>Pending Intake Requests</h3>
      {intakeRequests.filter((r) => r.status === 'pending').length ? (
        <div style={{ display: 'grid', gap: 8 }}>
          {intakeRequests.filter((r) => r.status === 'pending').map((r) => (
            <div key={r.id} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 10 }}>
              <div><strong>{r.payload?.businessId || 'unknown'}</strong> - {r.payload?.name || ''}</div>
              <div style={{ fontSize: 13, color: '#475569' }}>
                Contact: {r.payload?.contact?.phone || ''} / {r.payload?.contact?.email || ''}
              </div>
              <div style={{ marginTop: 8 }}>
                <button onClick={() => approveRequest(r.id)} style={{ padding: '6px 10px' }}>Approve & Import</button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p>No pending requests.</p>
      )}

      <h3 style={{ marginTop: 16 }}>Preview JSON (advanced)</h3>
      <pre style={{ background: '#0f172a', color: '#e2e8f0', padding: 12, borderRadius: 8, minHeight: 160 }}>
        {JSON.stringify(form, null, 2)}
      </pre>

      {message ? <p>{message}</p> : null}
    </main>
  );
}
