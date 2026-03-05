const base = process.env.BASE_URL || 'https://chat-bot-widget-two.vercel.app';
const adminPassword = process.env.ADMIN_PASSWORD_TEST || 'password';

async function json(res) {
  const t = await res.text();
  try {
    return t ? JSON.parse(t) : {};
  } catch {
    return { raw: t };
  }
}

function out(ok, name, extra = '') {
  console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name}${extra ? ` -> ${extra}` : ''}`);
}

async function main() {
  const loginRes = await fetch(`${base}/api/admin/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: adminPassword })
  });
  const login = await json(loginRes);
  if (!loginRes.ok || !login.token) {
    out(false, 'Admin login', JSON.stringify(login));
    process.exit(1);
  }
  out(true, 'Admin login');

  const auth = { Authorization: `Bearer ${login.token}` };

  const checks = [
    '/api/businesses',
    '/api/admin/owners',
    '/api/admin/business-health',
    '/api/admin/audit'
  ];
  for (const path of checks) {
    const r = await fetch(`${base}${path}`, { headers: auth });
    out(r.ok, `GET ${path}`, String(r.status));
  }

  for (const t of ['bookings', 'handoffs']) {
    const r = await fetch(`${base}/api/admin/export?type=${t}`, { headers: auth });
    const c = r.headers.get('content-type') || '';
    out(r.ok && c.includes('text/csv'), `Admin export ${t}`, `${r.status} ${c}`);
  }

  const optionsTargets = ['/api/chat', '/api/booking/availability', '/api/booking/create'];
  for (const p of optionsTargets) {
    const r = await fetch(`${base}${p}`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://example.com',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type,x-widget-token,x-idempotency-key'
      }
    });
    const h = r.headers.get('access-control-allow-headers') || '';
    const ok = r.status === 204 && h.toLowerCase().includes('x-widget-token');
    out(ok, `CORS ${p}`, `${r.status} ${h}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
