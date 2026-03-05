const baseUrl = process.env.BASE_URL || 'https://chat-bot-widget-two.vercel.app';
const adminPassword = process.env.ADMIN_PASSWORD_TEST || 'password';

async function api(path, init = {}) {
  const res = await fetch(`${baseUrl}${path}`, init);
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  return { ok: res.ok, status: res.status, data };
}

function logStep(name, result) {
  const symbol = result.ok ? 'PASS' : 'FAIL';
  console.log(`[${symbol}] ${name} -> ${result.status}`);
  if (!result.ok) {
    console.log(' ', JSON.stringify(result.data));
  }
}

const businessId = `qa_${Date.now().toString(36)}`;
const ownerUser = `owner_${Date.now().toString(36)}`;
const ownerPass = 'TestPass123!';
const ownerPass2 = 'TestPass456!';

const businessPayload = {
  businessId,
  name: `QA ${businessId}`,
  timezone: 'America/New_York',
  hours: {
    monday: { open: '09:00', close: '18:00' },
    tuesday: { open: '09:00', close: '18:00' },
    wednesday: { open: '09:00', close: '18:00' },
    thursday: { open: '09:00', close: '18:00' },
    friday: { open: '09:00', close: '18:00' },
    saturday: null,
    sunday: null
  },
  services: [
    { name: 'Test Service', durationMin: 30, priceRange: '$10-$20', bufferMin: 5 }
  ],
  policies: {
    booking: 'Test booking policy',
    cancellation: 'Test cancellation policy'
  },
  contact: {
    phone: '+1-555-9999',
    email: 'qa@example.com',
    address: '1 QA St'
  },
  faq: { parking: 'street' },
  allowedDomains: ['localhost'],
  bookingMode: 'calendar',
  styling: { accentColor: '#22c55e' }
};

async function run() {
  console.log(`Base URL: ${baseUrl}`);

  const login = await api('/api/admin/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: adminPassword })
  });
  logStep('Admin login', login);
  if (!login.ok || !login.data.token) process.exit(1);
  const adminToken = login.data.token;
  const adminHeaders = { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' };

  const getBefore = await api('/api/businesses', { headers: { Authorization: `Bearer ${adminToken}` } });
  logStep('List businesses (before)', getBefore);

  const createBusiness = await api('/api/businesses', {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify(businessPayload)
  });
  logStep('Create business', createBusiness);

  const getAfterCreate = await api('/api/businesses', { headers: { Authorization: `Bearer ${adminToken}` } });
  logStep('List businesses (after create)', getAfterCreate);

  const createOwner = await api('/api/admin/owners', {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ username: ownerUser, password: ownerPass, businessId })
  });
  logStep('Create owner', createOwner);
  const ownerId = createOwner.data?.owner?.id;

  const ownersList = await api('/api/admin/owners', { headers: { Authorization: `Bearer ${adminToken}` } });
  logStep('List owners', ownersList);

  if (ownerId) {
    const deactivate = await api('/api/admin/owners', {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ action: 'deactivate', ownerId })
    });
    logStep('Deactivate owner', deactivate);
  }

  const ownerLoginBlocked = await api('/api/owner/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: ownerUser, password: ownerPass })
  });
  logStep('Owner login while deactivated (should fail)', { ...ownerLoginBlocked, ok: !ownerLoginBlocked.ok });

  if (ownerId) {
    const activate = await api('/api/admin/owners', {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ action: 'activate', ownerId })
    });
    logStep('Activate owner', activate);

    const reset = await api('/api/admin/owners', {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ action: 'reset_password', ownerId, newPassword: ownerPass2 })
    });
    logStep('Reset owner password', reset);
  }

  const ownerLogin = await api('/api/owner/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: ownerUser, password: ownerPass2 })
  });
  logStep('Owner login (after reset)', ownerLogin);

  if (ownerLogin.ok && ownerLogin.data?.token) {
    const ownerToken = ownerLogin.data.token;
    const ownerBiz = await api('/api/owner/businesses', { headers: { Authorization: `Bearer ${ownerToken}` } });
    logStep('Owner businesses', ownerBiz);

    const ownerDash = await api(`/api/owner/dashboard?businessId=${encodeURIComponent(businessId)}`, {
      headers: { Authorization: `Bearer ${ownerToken}` }
    });
    logStep('Owner dashboard', ownerDash);
  }

  const calStatus = await api(`/api/auth/google/status?businessId=${encodeURIComponent(businessId)}`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  logStep('Calendar status', calStatus);

  const calStart = await api(`/api/auth/google/start?businessId=${encodeURIComponent(businessId)}&mode=url&reconnect=1`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  logStep('Calendar connect start', calStart);

  const sqlRun = await api('/api/admin/sql/run', {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ sql: 'select 1;' })
  });
  logStep('SQL run endpoint', sqlRun);

  const deleteBusiness = await api('/api/businesses', {
    method: 'DELETE',
    headers: adminHeaders,
    body: JSON.stringify({ businessId, confirmSlug: businessId })
  });
  logStep('Delete business cascade', deleteBusiness);

  const verifyDelete = await api('/api/businesses', { headers: { Authorization: `Bearer ${adminToken}` } });
  logStep('List businesses (after delete)', verifyDelete);

  console.log('Done.');
}

run().catch((err) => {
  console.error('Smoke test failed:', err);
  process.exit(1);
});
