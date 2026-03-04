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
  const [password, setPassword] = useState('');
  const [adminToken, setAdminToken] = useState('');
  const [businesses, setBusinesses] = useState<BusinessConfig[]>([]);
  const [selectedBusinessId, setSelectedBusinessId] = useState('');
  const [form, setForm] = useState<BusinessConfig>(defaultBusiness);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [intakeRequests, setIntakeRequests] = useState<any[]>([]);
  const [owners, setOwners] = useState<any[]>([]);
  const [ownerForm, setOwnerForm] = useState({ username: '', password: '', businessId: '' });
  const [resetPasswords, setResetPasswords] = useState<Record<string, string>>({});
  const [sqlOwnerUsername, setSqlOwnerUsername] = useState('');

  function adminHeaders(includeJson = false) {
    return {
      ...(includeJson ? { 'Content-Type': 'application/json' } : {}),
      Authorization: `Bearer ${adminToken}`
    };
  }

  async function loadAdminData() {
    const data = await fetch('/api/businesses', { headers: adminHeaders() }).then((r) => r.json());
    const list = (data.businesses || []) as BusinessConfig[];
    setBusinesses(list);
    const intake = await fetch('/api/admin/intake/requests', { headers: adminHeaders() }).then((r) => r.json());
    setIntakeRequests(intake.requests || []);
    const ownerRows = await fetch('/api/admin/owners', { headers: adminHeaders() }).then((r) => r.json());
    setOwners(ownerRows.owners || []);
    if (list.length && !selectedBusinessId) {
      setSelectedBusinessId(list[0].businessId);
      setForm(list[0]);
    }
  }

  useEffect(() => {
    if (!adminToken) return;
    loadAdminData().catch((e) => setMessage(String(e.message || e)));
  }, [adminToken]);

  const selectedBusiness = useMemo(
    () => businesses.find((b) => b.businessId === selectedBusinessId) || null,
    [businesses, selectedBusinessId]
  );

  useEffect(() => {
    if (selectedBusiness) setForm({ ...selectedBusiness, bookingMode: 'calendar' });
  }, [selectedBusiness]);

  function updateField<K extends keyof BusinessConfig>(key: K, value: BusinessConfig[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function approveRequest(requestId: string) {
    try {
      const res = await fetch('/api/admin/intake/approve', {
        method: 'POST',
        headers: adminHeaders(true),
        body: JSON.stringify({ requestId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to approve');
      setMessage(`Approved request for ${data.businessSlug}`);
      await loadAdminData();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Error');
    }
  }

  async function saveOwner() {
    try {
      if (!ownerForm.businessId) {
        setMessage('Select a business to assign this owner.');
        return;
      }
      const res = await fetch('/api/admin/owners', {
        method: 'POST',
        headers: adminHeaders(true),
        body: JSON.stringify({
          username: ownerForm.username,
          password: ownerForm.password,
          businessId: ownerForm.businessId
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save owner');
      setMessage(`Owner ${data.owner.username} saved.`);
      setOwnerForm((prev) => ({ ...prev, password: '' }));
      await loadAdminData();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Error');
    }
  }

  async function setOwnerActive(ownerId: string, action: 'activate' | 'deactivate') {
    try {
      const res = await fetch('/api/admin/owners', {
        method: 'PATCH',
        headers: adminHeaders(true),
        body: JSON.stringify({ ownerId, action })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setMessage(`Owner ${action === 'activate' ? 'activated' : 'deactivated'}.`);
      await loadAdminData();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Error');
    }
  }

  async function resetOwnerPassword(ownerId: string) {
    const nextPassword = (resetPasswords[ownerId] || '').trim();
    if (nextPassword.length < 8) {
      setMessage('New password must be at least 8 characters.');
      return;
    }
    try {
      const res = await fetch('/api/admin/owners', {
        method: 'PATCH',
        headers: adminHeaders(true),
        body: JSON.stringify({ ownerId, action: 'reset_password', newPassword: nextPassword })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setMessage('Owner password reset.');
      setResetPasswords((prev) => ({ ...prev, [ownerId]: '' }));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Error');
    }
  }

  async function loginAdmin() {
    setMessage('');
    try {
      const res = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');
      setAdminToken(data.token || '');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Login failed');
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
        headers: adminHeaders(true),
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');
      setMessage('Business saved.');
      await loadAdminData();
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
        name: 'New Business',
        bookingMode: 'calendar'
      });
  }

  function connectGoogleCalendar() {
    if (!adminToken || !form.businessId) {
      setMessage('Sign in and select a business first.');
      return;
    }
    fetch(`/api/auth/google/start?businessId=${encodeURIComponent(form.businessId)}&mode=url`, {
      headers: adminHeaders()
    })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || 'Failed to start OAuth');
        window.location.href = data.url;
      })
      .catch((e) => setMessage(String(e.message || e)));
  }

  function disconnectGoogleCalendar() {
    if (!adminToken || !form.businessId) {
      setMessage('Sign in and select a business first.');
      return;
    }
    fetch('/api/auth/google/disconnect', {
      method: 'POST',
      headers: adminHeaders(true),
      body: JSON.stringify({ businessId: form.businessId })
    })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || 'Failed to disconnect calendar');
        setMessage(data.message || `Calendar disconnected for ${form.businessId}.`);
      })
      .catch((e) => setMessage(String(e.message || e)));
  }

  const sqlTemplate = `-- 1) Upsert business config
insert into businesses (
  slug, name, timezone, phone, email, address,
  hours, services, policies, allowed_domains, booking_mode, faqs, widget_style,
  slot_interval_min, buffer_min, booking_window_days, updated_at
) values (
  '${form.businessId}',
  '${form.name.replaceAll("'", "''")}',
  '${form.timezone}',
  '${(form.contact.phone || '').replaceAll("'", "''")}',
  '${(form.contact.email || '').replaceAll("'", "''")}',
  '${(form.contact.address || '').replaceAll("'", "''")}',
  '${JSON.stringify(form.hours).replaceAll("'", "''")}'::jsonb,
  '${JSON.stringify(form.services).replaceAll("'", "''")}'::jsonb,
  '${JSON.stringify(form.policies).replaceAll("'", "''")}'::jsonb,
  '${JSON.stringify(form.allowedDomains).replaceAll("'", "''")}'::jsonb,
  'calendar',
  '${JSON.stringify(form.faq || {}).replaceAll("'", "''")}'::jsonb,
  '${JSON.stringify(form.styling || {}).replaceAll("'", "''")}'::jsonb,
  30, 10, 30, now()
)
on conflict (slug)
do update set
  name = excluded.name,
  timezone = excluded.timezone,
  phone = excluded.phone,
  email = excluded.email,
  address = excluded.address,
  hours = excluded.hours,
  services = excluded.services,
  policies = excluded.policies,
  allowed_domains = excluded.allowed_domains,
  booking_mode = 'calendar',
  faqs = excluded.faqs,
  widget_style = excluded.widget_style,
  updated_at = now();

-- 2) Assign owner (owner must already exist in owner_accounts)
-- Replace owner username if needed
with owner_row as (
  select id as owner_id from owner_accounts where username = '${sqlOwnerUsername || 'owner_username_here'}'
), business_row as (
  select id as business_id from businesses where slug = '${form.businessId}'
)
delete from business_owners where owner_user_id in (select owner_id from owner_row);

insert into business_owners (business_id, owner_user_id)
select business_row.business_id, owner_row.owner_id
from business_row, owner_row
on conflict (business_id, owner_user_id) do nothing;

-- 3) Optional: disconnect connected calendar for this business
delete from google_calendar_connections
where business_id = (select id from businesses where slug = '${form.businessId}');`;

  if (!adminToken) {
    return (
      <main style={{ maxWidth: 460, margin: '80px auto', padding: 16 }}>
        <h1>Admin Login</h1>
        <p>Sign in to access business and owner controls.</p>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="password"
            placeholder="Admin password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ padding: 8, flex: 1 }}
          />
          <button onClick={loginAdmin} style={{ padding: '8px 14px' }}>Sign In</button>
        </div>
        {message ? <p>{message}</p> : null}
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 1100, margin: '24px auto', padding: 16 }}>
      <h1>Admin</h1>
      <p>Set admin password via <code>ADMIN_PASSWORD</code> in your environment.</p>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
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
        <button onClick={disconnectGoogleCalendar} style={{ padding: '8px 14px' }}>Disconnect Calendar</button>
        <button onClick={() => { setAdminToken(''); setPassword(''); }} style={{ padding: '8px 14px' }}>Sign Out</button>
      </div>

      <h3>Business Details</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
        <input value={form.businessId} onChange={(e) => updateField('businessId', e.target.value)} placeholder="Business ID (e.g. demo_barber)" />
        <input value={form.name} onChange={(e) => updateField('name', e.target.value)} placeholder="Business Name" />
        <input value={form.timezone} onChange={(e) => updateField('timezone', e.target.value)} placeholder="Timezone" />
        <input value="calendar (online booking)" disabled />
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

      <h3 style={{ marginTop: 16 }}>Owner Accounts</h3>
      <p style={{ marginTop: 0, color: '#475569' }}>Create username/password credentials and assign exactly one business.</p>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 2fr auto', gap: 8, marginBottom: 10 }}>
        <input value={ownerForm.username} onChange={(e) => setOwnerForm({ ...ownerForm, username: e.target.value })} placeholder="owner username" />
        <input type="password" value={ownerForm.password} onChange={(e) => setOwnerForm({ ...ownerForm, password: e.target.value })} placeholder="temporary password" />
        <select value={ownerForm.businessId} onChange={(e) => setOwnerForm({ ...ownerForm, businessId: e.target.value })}>
          <option value="">Select business</option>
          {businesses.map((b) => (
            <option key={b.businessId} value={b.businessId}>{b.businessId} - {b.name}</option>
          ))}
        </select>
        <button onClick={saveOwner}>Save Owner</button>
      </div>
      {owners.length ? (
        <div style={{ display: 'grid', gap: 8 }}>
          {owners.map((owner) => (
            <div key={owner.id} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 10 }}>
              <div><strong>{owner.username}</strong> {owner.isActive ? '' : '(deactivated)'}</div>
              <div style={{ fontSize: 13, color: '#475569' }}>
                Assigned: {(owner.businesses || []).length ? owner.businesses.map((b: any) => b.businessId).join(', ') : 'none'}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
                <input
                  type="password"
                  placeholder="new password"
                  value={resetPasswords[owner.id] || ''}
                  onChange={(e) => setResetPasswords((prev) => ({ ...prev, [owner.id]: e.target.value }))}
                  style={{ minWidth: 180 }}
                />
                <button onClick={() => resetOwnerPassword(owner.id)}>Reset Password</button>
                {owner.isActive ? (
                  <button onClick={() => setOwnerActive(owner.id, 'deactivate')}>Deactivate</button>
                ) : (
                  <button onClick={() => setOwnerActive(owner.id, 'activate')}>Activate</button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p>No owner accounts yet.</p>
      )}

      <h3 style={{ marginTop: 16 }}>SQL Helper (Supabase Copy/Paste)</h3>
      <p style={{ marginTop: 0, color: '#475569' }}>
        Use this when you want to manually run SQL in Supabase. It includes business upsert, owner-to-business linking, and optional calendar disconnect.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: 8, marginBottom: 8 }}>
        <input value={form.businessId} disabled />
        <input
          value={sqlOwnerUsername}
          onChange={(e) => setSqlOwnerUsername(e.target.value.toLowerCase())}
          placeholder="owner username for link"
        />
        <button onClick={() => navigator.clipboard.writeText(sqlTemplate).then(() => setMessage('SQL copied to clipboard.')).catch(() => setMessage('Failed to copy SQL.'))}>
          Copy SQL
        </button>
      </div>
      <textarea
        readOnly
        value={sqlTemplate}
        rows={24}
        style={{ width: '100%', fontFamily: 'ui-monospace, Menlo, Consolas, monospace', fontSize: 12, lineHeight: 1.35 }}
      />

      {message ? <p>{message}</p> : null}
    </main>
  );
}
