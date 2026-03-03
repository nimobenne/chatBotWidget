'use client';

import { useEffect, useState } from 'react';

export default function AdminPage() {
  const [password, setPassword] = useState('');
  const [businesses, setBusinesses] = useState<unknown[]>([]);
  const [editor, setEditor] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!password) return;
    fetch(`/api/businesses?password=${encodeURIComponent(password)}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || 'Failed');
        setBusinesses(data.businesses || []);
      })
      .catch((e) => setMessage(String(e.message || e)));
  }, [password]);

  async function save() {
    try {
      const parsed = JSON.parse(editor);
      const res = await fetch('/api/businesses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
        body: JSON.stringify(parsed)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');
      setMessage('Saved.');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Error');
    }
  }

  return (
    <main style={{ maxWidth: 1100, margin: '24px auto', padding: 16 }}>
      <h1>Admin</h1>
      <p>If ADMIN_PASSWORD is not configured this route should not be linked publicly.</p>
      <input type="password" placeholder="Admin password" value={password} onChange={(e) => setPassword(e.target.value)} style={{ padding: 8, minWidth: 320 }} />
      <h3>Businesses</h3>
      <pre style={{ background: '#0f172a', color: '#e2e8f0', padding: 12, borderRadius: 8, minHeight: 220 }}>{JSON.stringify(businesses, null, 2)}</pre>
      <h3>Edit/Create Business Config JSON</h3>
      <textarea rows={18} value={editor} onChange={(e) => setEditor(e.target.value)} style={{ width: '100%', fontFamily: 'monospace' }} />
      <br />
      <button onClick={save} style={{ marginTop: 10, padding: '8px 14px' }}>Save business</button>
      {message ? <p>{message}</p> : null}
    </main>
  );
}
