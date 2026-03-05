const base = 'https://chat-bot-widget-two.vercel.app';
const adminPassword = 'password';

async function readJson(res) {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { raw: text };
  }
}

async function main() {
  const loginRes = await fetch(`${base}/api/admin/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: adminPassword })
  });
  const login = await readJson(loginRes);
  if (!loginRes.ok) {
    console.log('Admin login failed', loginRes.status, login);
    return;
  }

  const adminHeaders = {
    Authorization: `Bearer ${login.token}`,
    'Content-Type': 'application/json'
  };

  const ownersRes = await fetch(`${base}/api/admin/owners`, { headers: { Authorization: `Bearer ${login.token}` } });
  const ownersData = await readJson(ownersRes);
  const owners = ownersData.owners || [];

  const businessesRes = await fetch(`${base}/api/businesses`, { headers: { Authorization: `Bearer ${login.token}` } });
  const businessesData = await readJson(businessesRes);
  console.log('Businesses:', (businessesData.businesses || []).map((b) => b.businessId));

  for (const username of ['test1', 'test2']) {
    const owner = owners.find((o) => o.username === username);
    if (!owner) {
      console.log(`\nOwner ${username}: missing`);
      continue;
    }

    console.log(`\nOwner ${username}:`, owner.id, 'assigned:', (owner.businesses || []).map((b) => b.businessId));

    await fetch(`${base}/api/admin/owners`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ action: 'activate', ownerId: owner.id })
    });

    await fetch(`${base}/api/admin/owners`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ action: 'reset_password', ownerId: owner.id, newPassword: 'TestPass123!' })
    });

    const ownerLoginRes = await fetch(`${base}/api/owner/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password: 'TestPass123!' })
    });
    const ownerLogin = await readJson(ownerLoginRes);
    console.log(' login:', ownerLoginRes.status, ownerLogin.error || 'ok');
    if (!ownerLoginRes.ok) continue;

    const ownerToken = ownerLogin.token;
    const ownerHeaders = { Authorization: `Bearer ${ownerToken}` };

    const ownerBizRes = await fetch(`${base}/api/owner/businesses`, { headers: ownerHeaders });
    const ownerBiz = await readJson(ownerBizRes);
    const ownerBusinessIds = (ownerBiz.businesses || []).map((b) => b.businessId);
    const primaryBiz = ownerBusinessIds[0] || username;
    console.log(' owner businesses:', ownerBizRes.status, ownerBusinessIds);

    const statusRes = await fetch(`${base}/api/auth/google/status?businessId=${encodeURIComponent(primaryBiz)}`, { headers: ownerHeaders });
    const statusData = await readJson(statusRes);
    console.log(' status:', statusRes.status, statusData.error || `connectedInDb=${statusData.connectedInDb}, usable=${statusData.usable}`);

    const startRes = await fetch(`${base}/api/auth/google/start?businessId=${encodeURIComponent(primaryBiz)}&mode=url&reconnect=1`, { headers: ownerHeaders });
    const startData = await readJson(startRes);
    console.log(' connect start:', startRes.status, startData.error || 'ok');

    const otherBiz = username === 'test1' ? 'test2' : 'test1';
    const crossRes = await fetch(`${base}/api/auth/google/start?businessId=${encodeURIComponent(otherBiz)}&mode=url&reconnect=1`, { headers: ownerHeaders });
    const crossData = await readJson(crossRes);
    console.log(' cross-tenant start:', crossRes.status, crossData.error || 'ok');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
