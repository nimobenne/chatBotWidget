'use client';

import { useEffect, useMemo, useState } from 'react';
import { BusinessConfig } from '@/lib/types';
import { friendlyError } from '@/lib/userError';

const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;

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
  services: [{ name: 'Classic Haircut', durationMin: 30, priceRange: '$30-$40', bufferMin: 10 }],
  policies: {
    cancellation: 'Please provide at least 12 hours notice for cancellations.',
    booking: 'Walk-ins welcome, appointments recommended.'
  },
  contact: {
    phone: '+1-555-0100',
    email: 'hello@example.com',
    address: '100 Main St, Suite 12'
  },
  faq: { parking: 'Street parking is available nearby.' },
  allowedDomains: ['localhost', '127.0.0.1'],
  bookingMode: 'calendar',
  styling: { accentColor: '#22c55e' }
};

type TabKey = 'businesses' | 'owners' | 'billing' | 'sql' | 'help';
type BusinessHealth = {
  businessId: string;
  servicesConfigured: boolean;
  openDays: number;
  hasAllowedDomains: boolean;
  calendarConnectedInDb: boolean;
  calendarUsable: boolean;
  calendarError: string | null;
  healthy: boolean;
  issues: string[];
};

export default function AdminPage() {
  const [password, setPassword] = useState('');
  const [adminToken, setAdminToken] = useState('');
  const [message, setMessage] = useState('');
  const [activeTab, setActiveTab] = useState<TabKey>('businesses');

  const [businesses, setBusinesses] = useState<BusinessConfig[]>([]);
  const [businessHealth, setBusinessHealth] = useState<Record<string, BusinessHealth>>({});
  const [owners, setOwners] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [billingClients, setBillingClients] = useState<any[]>([]);

  const [formOpen, setFormOpen] = useState(false);
  const [formStep, setFormStep] = useState(0);
  const [form, setForm] = useState<BusinessConfig>(defaultBusiness);
  const [savingBusiness, setSavingBusiness] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<string>('');
  const [deleteConfirmSlug, setDeleteConfirmSlug] = useState('');

  const [ownerForm, setOwnerForm] = useState({ username: '', password: '', businessId: '' });
  const [resetPasswords, setResetPasswords] = useState<Record<string, string>>({});

  const [templateType, setTemplateType] = useState<'business_upsert' | 'assign_owner' | 'delete_business'>('business_upsert');
  const [sqlBusinessId, setSqlBusinessId] = useState('');
  const [sqlOwnerUsername, setSqlOwnerUsername] = useState('');
  const [sqlText, setSqlText] = useState('');
  const [runningSql, setRunningSql] = useState(false);
  const [sqlResult, setSqlResult] = useState('');
  const [privacyForm, setPrivacyForm] = useState({ businessId: '', sessionId: '' });

  const selectedForSql = useMemo(
    () => businesses.find((b) => b.businessId === sqlBusinessId) || defaultBusiness,
    [businesses, sqlBusinessId]
  );

  const adminStats = useMemo(() => {
    const totalBusinesses = billingClients.length;
    const activePaid = billingClients.filter((c) => c.billing?.billing_status === 'active_paid').length;
    const readyToInvoice = billingClients.filter((c) => c.readyToInvoice).length;
    const overdue = billingClients.filter((c) => c.billing?.billing_status === 'overdue').length;
    const bookings30d = billingClients.reduce((sum, c) => sum + Number(c.confirmedBookings30d || 0), 0);
    return { totalBusinesses, activePaid, readyToInvoice, overdue, bookings30d };
  }, [billingClients]);

  function adminHeaders(includeJson = false) {
    return {
      ...(includeJson ? { 'Content-Type': 'application/json' } : {}),
      Authorization: `Bearer ${adminToken}`
    };
  }

  async function readJsonSafe(res: Response): Promise<any> {
    const raw = await res.text();
    if (!raw.trim()) return {};
    try {
      return JSON.parse(raw);
    } catch {
      return { error: `Invalid JSON response (${res.status})` };
    }
  }

  async function requestJson(url: string, init?: RequestInit): Promise<any> {
    const res = await fetch(url, init);
    const data = await readJsonSafe(res);
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    return data;
  }

  function escapeSql(value: string | undefined | null): string {
    return String(value || '').replaceAll("'", "''");
  }

  async function loadAdminData() {
    const data = await requestJson('/api/businesses', { headers: adminHeaders() });
    const list = (data.businesses || []) as BusinessConfig[];
    setBusinesses(list);
    setSqlBusinessId((prev) => prev || list[0]?.businessId || '');

    const healthRows = await requestJson('/api/admin/business-health', { headers: adminHeaders() });
    const map: Record<string, BusinessHealth> = {};
    for (const row of (healthRows.health || []) as BusinessHealth[]) {
      map[row.businessId] = row;
    }
    setBusinessHealth(map);

    const ownerRows = await requestJson('/api/admin/owners', { headers: adminHeaders() });
    setOwners(ownerRows.owners || []);

    const auditRows = await requestJson('/api/admin/audit', { headers: adminHeaders() });
    setAuditLogs(auditRows.logs || []);

    const billingRows = await requestJson('/api/admin/billing/overview', { headers: adminHeaders() });
    setBillingClients(billingRows.clients || []);
  }

  useEffect(() => {
    if (!adminToken) return;
    loadAdminData().catch((e) => setMessage(String(e.message || e)));
  }, [adminToken]);

  useEffect(() => {
    if (!sqlBusinessId && businesses.length) setSqlBusinessId(businesses[0].businessId);
  }, [businesses, sqlBusinessId]);

  async function loginAdmin() {
    setMessage('');
    try {
      const res = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      const data = await readJsonSafe(res);
      if (!res.ok) throw new Error(friendlyError(data));
      setAdminToken(data.token || '');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Login failed');
    }
  }

  function openNewBusiness() {
    setForm({
      ...defaultBusiness,
      businessId: `biz_${Math.random().toString(36).slice(2, 8)}`,
      name: 'New Business',
      bookingMode: 'calendar'
    });
    setFormStep(0);
    setFormOpen(true);
  }

  function openEditBusiness(business: BusinessConfig) {
    setForm({ ...business, bookingMode: 'calendar' });
    setFormStep(0);
    setFormOpen(true);
  }

  function updateField<K extends keyof BusinessConfig>(key: K, value: BusinessConfig[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function updateDay(day: (typeof dayNames)[number], key: 'open' | 'close', value: string) {
    setForm((prev) => {
      const current = prev.hours[day] || { open: '09:00', close: '18:00' };
      return { ...prev, hours: { ...prev.hours, [day]: { ...current, [key]: value } } };
    });
  }

  function toggleClosed(day: (typeof dayNames)[number], closed: boolean) {
    setForm((prev) => ({
      ...prev,
      hours: { ...prev.hours, [day]: closed ? null : { open: '09:00', close: '18:00' } }
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

  function canAdvanceStep(): boolean {
    if (formStep === 0) return !!(form.businessId.trim() && form.name.trim() && form.timezone.trim() && form.contact.phone?.trim());
    if (formStep === 1) return form.services.length > 0 && form.services.every((s) => s.name.trim() && s.durationMin > 0);
    return true;
  }

  async function saveBusiness() {
    setSavingBusiness(true);
    setMessage('');
    try {
      const res = await fetch('/api/businesses', {
        method: 'POST',
        headers: adminHeaders(true),
        body: JSON.stringify({ ...form, bookingMode: 'calendar' })
      });
      const data = await readJsonSafe(res);
      if (!res.ok) throw new Error(friendlyError(data));
      setMessage(`Business ${form.businessId} saved.`);
      setFormOpen(false);
      await loadAdminData();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Error');
    } finally {
      setSavingBusiness(false);
    }
  }

  async function deleteBusiness() {
    if (!deleteTarget) return;
    try {
      const res = await fetch('/api/businesses', {
        method: 'DELETE',
        headers: adminHeaders(true),
        body: JSON.stringify({ businessId: deleteTarget, confirmSlug: deleteConfirmSlug })
      });
      const data = await readJsonSafe(res);
      if (!res.ok) throw new Error(friendlyError(data));
      setMessage(`Deleted business ${deleteTarget} and all related data.`);
      setDeleteTarget('');
      setDeleteConfirmSlug('');
      await loadAdminData();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Delete failed');
    }
  }

  function connectGoogleCalendar(businessId: string) {
    fetch(`/api/auth/google/start?businessId=${encodeURIComponent(businessId)}&mode=url&reconnect=1`, {
      headers: adminHeaders()
    })
      .then(async (r) => {
        const data = await readJsonSafe(r);
        if (!r.ok) throw new Error(friendlyError(data));
        window.location.href = data.url;
      })
      .catch((e) => setMessage(String(e.message || e)));
  }

  function checkCalendarStatus(businessId: string) {
    fetch(`/api/auth/google/status?businessId=${encodeURIComponent(businessId)}`, { headers: adminHeaders() })
      .then(async (r) => {
        const data = await readJsonSafe(r);
        if (!r.ok) throw new Error(data.error || 'Failed to check calendar status');
        if (!data.connectedInDb) return setMessage(`No calendar connection row exists for ${businessId}.`);
        if (data.usable) return setMessage(`Calendar OK for ${businessId}. calendarId=${data.calendarId}`);
        setMessage(`Calendar row exists for ${businessId}, but token is not usable. ${data.checkError || ''}`.trim());
      })
      .catch((e) => setMessage(String(e.message || e)));
  }

  async function saveOwner() {
    try {
      if (!ownerForm.businessId) return setMessage('Select a business to assign this owner.');
      const res = await fetch('/api/admin/owners', {
        method: 'POST',
        headers: adminHeaders(true),
        body: JSON.stringify(ownerForm)
      });
      const data = await readJsonSafe(res);
      if (!res.ok) throw new Error(friendlyError(data));
      setMessage(`Owner ${data.owner.username} saved.`);
      setOwnerForm({ username: '', password: '', businessId: '' });
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
      const data = await readJsonSafe(res);
      if (!res.ok) throw new Error(friendlyError(data));
      setMessage(`Owner ${action === 'activate' ? 'activated' : 'deactivated'}.`);
      await loadAdminData();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Error');
    }
  }

  async function resetOwnerPassword(ownerId: string) {
    const nextPassword = (resetPasswords[ownerId] || '').trim();
    if (nextPassword.length < 8) return setMessage('New password must be at least 8 characters.');
    try {
      const res = await fetch('/api/admin/owners', {
        method: 'PATCH',
        headers: adminHeaders(true),
        body: JSON.stringify({ ownerId, action: 'reset_password', newPassword: nextPassword })
      });
      const data = await readJsonSafe(res);
      if (!res.ok) throw new Error(friendlyError(data));
      setMessage('Owner password reset.');
      setResetPasswords((prev) => ({ ...prev, [ownerId]: '' }));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Error');
    }
  }

  async function deleteOwner(ownerId: string, username: string) {
    if (!confirm(`Delete owner ${username}? This cannot be undone.`)) return;
    try {
      const res = await fetch('/api/admin/owners', {
        method: 'PATCH',
        headers: adminHeaders(true),
        body: JSON.stringify({ ownerId, action: 'delete_owner' })
      });
      const data = await readJsonSafe(res);
      if (!res.ok) throw new Error(friendlyError(data));
      setMessage(`Owner ${username} deleted.`);
      await loadAdminData();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Error');
    }
  }

  function buildSqlTemplate() {
    if (templateType === 'assign_owner') {
      const owner = escapeSql(sqlOwnerUsername || 'owner_username_here');
      const slug = escapeSql(selectedForSql.businessId);
      return `begin;\n\nDO $$\nDECLARE\n  v_owner_id uuid;\n  v_business_id uuid;\nBEGIN\n  SELECT id INTO v_owner_id FROM owner_accounts WHERE username = '${owner}';\n  IF v_owner_id IS NULL THEN RAISE EXCEPTION 'owner not found'; END IF;\n\n  SELECT id INTO v_business_id FROM businesses WHERE slug = '${slug}';\n  IF v_business_id IS NULL THEN RAISE EXCEPTION 'business not found'; END IF;\n\n  DELETE FROM business_owners WHERE owner_user_id = v_owner_id;\n  INSERT INTO business_owners (business_id, owner_user_id) VALUES (v_business_id, v_owner_id) ON CONFLICT DO NOTHING;\nEND $$;\n\ncommit;`;
    }

    if (templateType === 'delete_business') {
      const slug = escapeSql(selectedForSql.businessId);
      return `begin;\n\nDO $$\nDECLARE\n  v_business_id uuid;\nBEGIN\n  SELECT id INTO v_business_id FROM businesses WHERE slug = '${slug}';\n  IF v_business_id IS NULL THEN RAISE EXCEPTION 'business not found'; END IF;\n\n  DELETE FROM google_calendar_connections WHERE business_id = v_business_id;\n  DELETE FROM business_owners WHERE business_id = v_business_id;\n  DELETE FROM bookings WHERE business_id = v_business_id;\n  DELETE FROM conversations WHERE business_id = v_business_id;\n  DELETE FROM handoffs WHERE business_id = v_business_id;\n  DELETE FROM businesses WHERE id = v_business_id;\nEND $$;\n\ncommit;`;
    }

    return `begin;\n\ninsert into businesses (\n  slug, name, timezone, phone, email, address,\n  hours, services, policies, allowed_domains, booking_mode, faqs, widget_style,\n  slot_interval_min, buffer_min, booking_window_days, updated_at\n) values (\n  '${escapeSql(selectedForSql.businessId)}',\n  '${escapeSql(selectedForSql.name)}',\n  '${escapeSql(selectedForSql.timezone)}',\n  '${escapeSql(selectedForSql.contact.phone)}',\n  '${escapeSql(selectedForSql.contact.email)}',\n  '${escapeSql(selectedForSql.contact.address)}',\n  '${escapeSql(JSON.stringify(selectedForSql.hours))}'::jsonb,\n  '${escapeSql(JSON.stringify(selectedForSql.services))}'::jsonb,\n  '${escapeSql(JSON.stringify(selectedForSql.policies))}'::jsonb,\n  '${escapeSql(JSON.stringify(selectedForSql.allowedDomains))}'::jsonb,\n  'calendar',\n  '${escapeSql(JSON.stringify(selectedForSql.faq || {}))}'::jsonb,\n  '${escapeSql(JSON.stringify(selectedForSql.styling || {}))}'::jsonb,\n  30, 10, 30, now()\n) on conflict (slug) do update set\n  name = excluded.name,\n  timezone = excluded.timezone,\n  phone = excluded.phone,\n  email = excluded.email,\n  address = excluded.address,\n  hours = excluded.hours,\n  services = excluded.services,\n  policies = excluded.policies,\n  allowed_domains = excluded.allowed_domains,\n  booking_mode = 'calendar',\n  faqs = excluded.faqs,\n  widget_style = excluded.widget_style,\n  updated_at = now();\n\ncommit;`;
  }

  useEffect(() => {
    setSqlText(buildSqlTemplate());
  }, [templateType, sqlBusinessId, sqlOwnerUsername, businesses]);

  async function runSql() {
    if (!sqlText.trim()) return setMessage('SQL is empty');
    if (!confirm('Run this SQL in Supabase? This may modify production data.')) return;
    setRunningSql(true);
    setSqlResult('');
    try {
      const data = await requestJson('/api/admin/sql/run', {
        method: 'POST',
        headers: adminHeaders(true),
        body: JSON.stringify({ sql: sqlText })
      });
      setSqlResult(JSON.stringify(data, null, 2));
      setMessage('SQL executed.');
      await loadAdminData();
    } catch (e) {
      const m = e instanceof Error ? e.message : 'SQL run failed';
      setSqlResult(m);
      setMessage(m);
    } finally {
      setRunningSql(false);
    }
  }

  function exportCsv(type: 'bookings' | 'handoffs', businessId?: string) {
    const qs = new URLSearchParams({ type, ...(businessId ? { businessId } : {}) });
    fetch(`/api/admin/export?${qs.toString()}`, { headers: adminHeaders() })
      .then(async (res) => {
        if (!res.ok) {
          const data = await readJsonSafe(res);
          throw new Error(friendlyError(data));
        }
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${type}_${businessId || 'all'}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      })
      .catch((e) => setMessage(String(e.message || e)));
  }

  async function deleteSessionData() {
    if (!privacyForm.businessId || !privacyForm.sessionId) {
      setMessage('Provide business id and session id for privacy delete.');
      return;
    }
    try {
      const res = await fetch('/api/privacy/delete-session', {
        method: 'POST',
        headers: adminHeaders(true),
        body: JSON.stringify(privacyForm)
      });
      const data = await readJsonSafe(res);
      if (!res.ok) throw new Error(friendlyError(data));
      setMessage(`Deleted conversation history for ${privacyForm.businessId}/${privacyForm.sessionId}.`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Delete failed');
    }
  }

  async function updateBilling(businessId: string, action: string, extra: Record<string, unknown> = {}) {
    try {
      const res = await fetch('/api/admin/billing', {
        method: 'PATCH',
        headers: adminHeaders(true),
        body: JSON.stringify({ businessId, action, ...extra })
      });
      const data = await readJsonSafe(res);
      if (!res.ok) throw new Error(friendlyError(data));
      setMessage(`Billing updated for ${businessId}.`);
      await loadAdminData();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Billing update failed');
    }
  }

  if (!adminToken) {
    return (
      <main style={{ maxWidth: 460, margin: '90px auto', padding: 20 }}>
        <h1>Admin Login</h1>
        <p>Sign in with your `ADMIN_PASSWORD`.</p>
        <div style={{ display: 'flex', gap: 8 }}>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Admin password" style={{ flex: 1 }} />
          <button onClick={loginAdmin}>Sign In</button>
        </div>
        {message ? <p>{message}</p> : null}
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 1200, margin: '24px auto', padding: 16 }}>
      <h1>Admin Portal</h1>
      <p>Manage businesses, owners, and SQL operations.</p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <button onClick={() => setActiveTab('businesses')} style={{ background: activeTab === 'businesses' ? '#16a34a' : '#1e293b' }}>Businesses</button>
        <button onClick={() => setActiveTab('owners')} style={{ background: activeTab === 'owners' ? '#16a34a' : '#1e293b' }}>Owners</button>
        <button onClick={() => setActiveTab('billing')} style={{ background: activeTab === 'billing' ? '#16a34a' : '#1e293b' }}>Billing</button>
        <button onClick={() => setActiveTab('sql')} style={{ background: activeTab === 'sql' ? '#16a34a' : '#1e293b' }}>SQL Tools</button>
        <button onClick={() => setActiveTab('help')} style={{ background: activeTab === 'help' ? '#16a34a' : '#1e293b' }}>Help</button>
        <button style={{ marginLeft: 'auto' }} onClick={() => { setAdminToken(''); setPassword(''); }}>Sign Out</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,minmax(0,1fr))', gap: 8, marginBottom: 14 }}>
        <Stat title="Businesses" value={adminStats.totalBusinesses} />
        <Stat title="Active Paid" value={adminStats.activePaid} />
        <Stat title="Ready to Invoice" value={adminStats.readyToInvoice} />
        <Stat title="Overdue" value={adminStats.overdue} />
        <Stat title="Confirmed 30d" value={adminStats.bookings30d} />
      </div>

      {activeTab === 'businesses' && (
        <section>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ margin: 0 }}>Businesses</h3>
            <button onClick={openNewBusiness}>+ Add New Business</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 10 }}>
            {businesses.map((b) => (
              <div key={b.businessId} style={{ border: '1px solid #334155', borderRadius: 10, padding: 12, background: '#111827' }}>
                <div style={{ fontWeight: 700 }}>{b.name}</div>
                <div style={{ color: '#94a3b8', fontSize: 13 }}>{b.businessId}</div>
                <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: businessHealth[b.businessId]?.healthy ? '#14532d' : '#7f1d1d' }}>
                    {businessHealth[b.businessId]?.healthy ? 'Healthy' : 'Needs attention'}
                  </span>
                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: businessHealth[b.businessId]?.calendarUsable ? '#14532d' : '#334155' }}>
                    Calendar {businessHealth[b.businessId]?.calendarUsable ? 'OK' : businessHealth[b.businessId]?.calendarConnectedInDb ? 'Broken' : 'Missing'}
                  </span>
                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: '#1e293b' }}>
                    Open Days: {businessHealth[b.businessId]?.openDays ?? 0}
                  </span>
                </div>
                {businessHealth[b.businessId]?.issues?.length ? (
                  <div style={{ marginTop: 8, fontSize: 12, color: '#fca5a5' }}>
                    {businessHealth[b.businessId].issues.join(' · ')}
                  </div>
                ) : null}
                <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button onClick={() => openEditBusiness(b)}>Edit</button>
                  <button onClick={() => connectGoogleCalendar(b.businessId)}>Connect Calendar</button>
                  <button onClick={() => checkCalendarStatus(b.businessId)}>Check Status</button>
                  <button onClick={() => exportCsv('bookings', b.businessId)}>Export Bookings</button>
                  <button onClick={() => exportCsv('handoffs', b.businessId)}>Export Handoffs</button>
                  <button onClick={() => { setDeleteTarget(b.businessId); setDeleteConfirmSlug(''); }}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {activeTab === 'owners' && (
        <section>
          <h3>Create Owner Account</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 2fr auto', gap: 8, marginBottom: 12 }}>
            <input value={ownerForm.username} onChange={(e) => setOwnerForm({ ...ownerForm, username: e.target.value })} placeholder="Username" />
            <input type="password" value={ownerForm.password} onChange={(e) => setOwnerForm({ ...ownerForm, password: e.target.value })} placeholder="Temporary password" />
            <select value={ownerForm.businessId} onChange={(e) => setOwnerForm({ ...ownerForm, businessId: e.target.value })}>
              <option value="">Assign business</option>
              {businesses.map((b) => <option key={b.businessId} value={b.businessId}>{b.businessId} - {b.name}</option>)}
            </select>
            <button onClick={saveOwner}>Create Owner</button>
          </div>

          <h3>Owners</h3>
          <div style={{ display: 'grid', gap: 8 }}>
            {owners.map((owner) => (
              <div key={owner.id} style={{ border: '1px solid #334155', borderRadius: 10, padding: 10, background: '#111827' }}>
                <div style={{ fontWeight: 700 }}>{owner.username} {owner.isActive ? '' : '(deactivated)'}</div>
                <div style={{ color: '#94a3b8', fontSize: 13 }}>
                  Assigned: {(owner.businesses || []).length ? owner.businesses.map((x: any) => x.businessId).join(', ') : 'none'}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <input
                    type="password"
                    placeholder="new password"
                    value={resetPasswords[owner.id] || ''}
                    onChange={(e) => setResetPasswords((prev) => ({ ...prev, [owner.id]: e.target.value }))}
                    style={{ minWidth: 160 }}
                  />
                  <button onClick={() => resetOwnerPassword(owner.id)}>Reset Password</button>
                  {owner.isActive
                    ? <button onClick={() => setOwnerActive(owner.id, 'deactivate')}>Deactivate</button>
                    : <button onClick={() => setOwnerActive(owner.id, 'activate')}>Activate</button>}
                  <button onClick={() => deleteOwner(owner.id, owner.username)}>Delete Owner</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {activeTab === 'billing' && (
        <section>
          <h3>Billing and Client Status</h3>
          <p>Track trial progress, payment state, and go-live readiness.</p>
          <div style={{ display: 'grid', gap: 8 }}>
            {billingClients.map((c) => (
              <div key={c.businessId} style={{ border: '1px solid #334155', borderRadius: 10, padding: 10, background: '#111827' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                  <div>
                    <strong>{c.businessName}</strong> <span style={{ color: '#94a3b8' }}>({c.businessId})</span>
                    <div style={{ fontSize: 12, color: '#94a3b8' }}>Owner: {c.ownerUsername || 'unassigned'} · Confirmed bookings: {c.thresholdProgress}</div>
                  </div>
                  <div style={{ fontSize: 12 }}>
                    <span style={{ padding: '2px 8px', borderRadius: 999, background: c.readyToInvoice ? '#854d0e' : '#1e293b' }}>Status: {c.billing.billing_status}</span>
                    <span style={{ marginLeft: 6, padding: '2px 8px', borderRadius: 999, background: c.goLiveEligible ? '#14532d' : '#7f1d1d' }}>Go-live {c.billing.go_live_enabled ? 'ON' : 'OFF'}</span>
                    <span style={{ marginLeft: 6, padding: '2px 8px', borderRadius: 999, background: c.billing.test_mode_enabled ? '#075985' : '#1e293b' }}>Test Mode {c.billing.test_mode_enabled ? 'ON' : 'OFF'}</span>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr .7fr .7fr 2fr', gap: 8, marginTop: 8 }}>
                  <input
                    defaultValue={c.billing.paypal_email || ''}
                    placeholder="paypal email"
                    onBlur={(e) => updateBilling(c.businessId, 'update_fields', { fields: { paypal_email: e.target.value } })}
                  />
                  <input
                    defaultValue={c.billing.paypal_subscription_id || ''}
                    placeholder="paypal subscription id"
                    onBlur={(e) => updateBilling(c.businessId, 'update_fields', { fields: { paypal_subscription_id: e.target.value } })}
                  />
                  <input
                    defaultValue={String(c.billing.setup_fee_eur ?? 99)}
                    placeholder="setup fee"
                    onBlur={(e) => updateBilling(c.businessId, 'update_fields', { fields: { setup_fee_eur: Number(e.target.value || 99) } })}
                  />
                  <input
                    defaultValue={String(c.billing.trial_booking_threshold ?? 5)}
                    placeholder="threshold"
                    onBlur={(e) => updateBilling(c.businessId, 'update_fields', { fields: { trial_booking_threshold: Number(e.target.value || 5) } })}
                  />
                  <input
                    defaultValue={c.billing.notes || ''}
                    placeholder="notes"
                    onBlur={(e) => updateBilling(c.businessId, 'update_fields', { fields: { notes: e.target.value } })}
                  />
                </div>

                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                  <button onClick={() => updateBilling(c.businessId, 'set_pending_payment')}>Set Pending</button>
                  <button onClick={() => updateBilling(c.businessId, 'mark_paid')}>Mark Paid</button>
                  <button onClick={() => updateBilling(c.businessId, 'set_overdue')}>Set Overdue</button>
                  <button onClick={() => updateBilling(c.businessId, 'cancel')}>Cancel</button>
                  <button onClick={() => updateBilling(c.businessId, 'reactivate')}>Reactivate</button>
                  <button onClick={() => updateBilling(c.businessId, 'run_test_booking_check')}>Run Test Booking Check</button>
                  <button onClick={() => updateBilling(c.businessId, 'set_go_live', { goLiveEnabled: !c.billing.go_live_enabled })}>{c.billing.go_live_enabled ? 'Disable Go Live' : 'Enable Go Live'}</button>
                  <button onClick={() => updateBilling(c.businessId, 'toggle_test_mode', { testModeEnabled: !c.billing.test_mode_enabled })}>{c.billing.test_mode_enabled ? 'Disable Test Mode' : 'Enable Test Mode'}</button>
                </div>
                <div style={{ marginTop: 6, fontSize: 12, color: '#94a3b8' }}>
                  Checklist: profile {String(c.checklist.profileConfigured)} · owner {String(c.checklist.ownerAssigned)} · calendar {String(c.checklist.calendarUsable)} · test booking {String(c.checklist.testBookingPassed)}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {activeTab === 'sql' && (
        <section>
          <h3>SQL Tools</h3>
          <p>Edit SQL and run directly in Supabase from here.</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1.3fr 1fr auto', gap: 8, marginBottom: 8 }}>
            <select value={sqlBusinessId} onChange={(e) => setSqlBusinessId(e.target.value)}>
              <option value="">Select business</option>
              {businesses.map((b) => <option key={b.businessId} value={b.businessId}>{b.businessId} - {b.name}</option>)}
            </select>
            <input value={sqlOwnerUsername} onChange={(e) => setSqlOwnerUsername(e.target.value.toLowerCase())} placeholder="owner username (for owner template)" />
            <select value={templateType} onChange={(e) => setTemplateType(e.target.value as any)}>
              <option value="business_upsert">Business Upsert</option>
              <option value="assign_owner">Assign Owner to Business</option>
              <option value="delete_business">Delete Business (Cascade)</option>
            </select>
            <button onClick={() => setSqlText(buildSqlTemplate())}>Reload Template</button>
          </div>
          <textarea
            value={sqlText}
            onChange={(e) => setSqlText(e.target.value)}
            rows={22}
            style={{ width: '100%', fontFamily: 'ui-monospace, Menlo, Consolas, monospace', fontSize: 12, lineHeight: 1.35 }}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button onClick={runSql} disabled={runningSql}>{runningSql ? 'Running...' : 'Run in Supabase'}</button>
            <button onClick={() => navigator.clipboard.writeText(sqlText).then(() => setMessage('SQL copied to clipboard.')).catch(() => setMessage('Failed to copy SQL.'))}>Copy SQL</button>
            <button onClick={() => exportCsv('bookings')}>Export All Bookings CSV</button>
            <button onClick={() => exportCsv('handoffs')}>Export All Handoffs CSV</button>
          </div>
          {sqlResult ? (
            <pre style={{ marginTop: 10, background: '#020617', color: '#93c5fd', padding: 10, borderRadius: 8 }}>{sqlResult}</pre>
          ) : null}

          <h3 style={{ marginTop: 16 }}>Recent Admin Audit Logs</h3>
          <div style={{ display: 'grid', gap: 8 }}>
            {auditLogs.slice(0, 20).map((log) => (
              <div key={log.id} style={{ border: '1px solid #334155', borderRadius: 8, padding: 8, background: '#111827' }}>
                <div style={{ fontSize: 13 }}>
                  <strong>{log.action}</strong> - {log.target_type}:{log.target_id}
                </div>
                <div style={{ fontSize: 12, color: '#94a3b8' }}>{new Date(log.created_at).toLocaleString()}</div>
              </div>
            ))}
          </div>

          <h3 style={{ marginTop: 16 }}>Privacy Controls</h3>
          <p>Delete stored conversation history for a specific business/session id.</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8 }}>
            <input
              value={privacyForm.businessId}
              onChange={(e) => setPrivacyForm((p) => ({ ...p, businessId: e.target.value }))}
              placeholder="business id"
            />
            <input
              value={privacyForm.sessionId}
              onChange={(e) => setPrivacyForm((p) => ({ ...p, sessionId: e.target.value }))}
              placeholder="session id"
            />
            <button onClick={deleteSessionData}>Delete Session Data</button>
          </div>
        </section>
      )}

      {activeTab === 'help' && (
        <section>
          <h3>Help and Runbooks</h3>
          <p>Use these guides when something breaks:</p>
          <ul>
            <li><a href="/help">Open Help Center</a></li>
            <li>Calendar not connecting</li>
            <li>Booking failed</li>
            <li>Owner locked out</li>
            <li>Payment overdue</li>
          </ul>
        </section>
      )}

      {formOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(2,6,23,.75)', display: 'grid', placeItems: 'center', zIndex: 1000 }}>
          <div style={{ width: 'min(980px,94vw)', maxHeight: '90vh', overflow: 'auto', background: '#0b1220', border: '1px solid #334155', borderRadius: 12, padding: 16 }}>
            <h3 style={{ marginTop: 0 }}>Business Setup Wizard</h3>
            <p style={{ color: '#94a3b8' }}>Step {formStep + 1} of 4</p>

            {formStep === 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 8 }}>
                <input value={form.businessId} onChange={(e) => updateField('businessId', e.target.value.toLowerCase().replace(/\s+/g, '_'))} placeholder="Business ID (slug)" />
                <input value={form.name} onChange={(e) => updateField('name', e.target.value)} placeholder="Business name" />
                <input value={form.timezone} onChange={(e) => updateField('timezone', e.target.value)} placeholder="Timezone" />
                <input value="calendar (online booking)" disabled />
                <input value={form.contact.phone || ''} onChange={(e) => updateField('contact', { ...form.contact, phone: e.target.value })} placeholder="Phone" />
                <input value={form.contact.email || ''} onChange={(e) => updateField('contact', { ...form.contact, email: e.target.value })} placeholder="Email" />
                <input style={{ gridColumn: '1 / -1' }} value={form.contact.address || ''} onChange={(e) => updateField('contact', { ...form.contact, address: e.target.value })} placeholder="Address" />
              </div>
            )}

            {formStep === 1 && (
              <div>
                {form.services.map((s, i) => (
                  <div key={`${s.name}-${i}`} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: 8, marginBottom: 8 }}>
                    <input value={s.name} onChange={(e) => updateService(i, 'name', e.target.value)} placeholder="Service" />
                    <input type="number" value={s.durationMin} onChange={(e) => updateService(i, 'durationMin', e.target.value)} placeholder="Minutes" />
                    <input value={s.priceRange || ''} onChange={(e) => updateService(i, 'priceRange', e.target.value)} placeholder="Price" />
                    <input type="number" value={s.bufferMin || 0} onChange={(e) => updateService(i, 'bufferMin', e.target.value)} placeholder="Buffer" />
                    <button onClick={() => removeService(i)}>Remove</button>
                  </div>
                ))}
                <button onClick={addService}>Add Service</button>
              </div>
            )}

            {formStep === 2 && (
              <div style={{ display: 'grid', gap: 8 }}>
                {dayNames.map((day) => {
                  const rule = form.hours[day];
                  const closed = rule === null;
                  return (
                    <div key={day} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <strong style={{ width: 100, textTransform: 'capitalize' }}>{day}</strong>
                      <label><input type="checkbox" checked={closed} onChange={(e) => toggleClosed(day, e.target.checked)} /> Closed</label>
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
            )}

            {formStep === 3 && (
              <div style={{ display: 'grid', gap: 8 }}>
                <textarea rows={2} value={form.policies.booking} onChange={(e) => updateField('policies', { ...form.policies, booking: e.target.value })} placeholder="Booking policy" />
                <textarea rows={2} value={form.policies.cancellation} onChange={(e) => updateField('policies', { ...form.policies, cancellation: e.target.value })} placeholder="Cancellation policy" />
                <input value={form.allowedDomains.join(', ')} onChange={(e) => updateField('allowedDomains', e.target.value.split(',').map((x) => x.trim()).filter(Boolean))} placeholder="Allowed domains (comma separated)" />
                <input value={form.styling?.accentColor || '#22c55e'} onChange={(e) => updateField('styling', { accentColor: e.target.value })} placeholder="Accent color" />
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button onClick={() => setFormOpen(false)}>Cancel</button>
              <button onClick={() => setFormStep((s) => Math.max(0, s - 1))} disabled={formStep === 0}>Back</button>
              {formStep < 3 ? (
                <button onClick={() => setFormStep((s) => s + 1)} disabled={!canAdvanceStep()}>Next</button>
              ) : (
                <button onClick={saveBusiness} disabled={savingBusiness || !canAdvanceStep()}>{savingBusiness ? 'Saving...' : 'Save Business'}</button>
              )}
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(2,6,23,.75)', display: 'grid', placeItems: 'center', zIndex: 1000 }}>
          <div style={{ width: 'min(520px,94vw)', background: '#0b1220', border: '1px solid #334155', borderRadius: 12, padding: 16 }}>
            <h3 style={{ marginTop: 0 }}>Delete Business</h3>
            <p>This permanently deletes the business and all related data (bookings, conversations, handoffs, owner links, calendar links).</p>
            <p>Type <strong>{deleteTarget}</strong> to confirm:</p>
            <input value={deleteConfirmSlug} onChange={(e) => setDeleteConfirmSlug(e.target.value)} placeholder="Type business slug" style={{ width: '100%' }} />
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button onClick={() => { setDeleteTarget(''); setDeleteConfirmSlug(''); }}>Cancel</button>
              <button onClick={deleteBusiness} disabled={deleteConfirmSlug !== deleteTarget}>Delete Everything</button>
            </div>
          </div>
        </div>
      )}

      {message ? <p style={{ marginTop: 14 }}>{message}</p> : null}
    </main>
  );
}

function Stat({ title, value }: { title: string; value: string | number }) {
  return (
    <div style={{ border: '1px solid #334155', borderRadius: 10, padding: 10, background: '#0b1220' }}>
      <div style={{ fontSize: 12, color: '#94a3b8' }}>{title}</div>
      <div style={{ fontSize: 22, fontWeight: 700 }}>{value}</div>
    </div>
  );
}
