'use client';

import { useEffect, useMemo, useState } from 'react';

type Step = { name: string; status: 'pending' | 'running' | 'done' | 'failed'; detail?: string };

export default function AutoDemoClient({ businessId }: { businessId: string }) {
  const [mode, setMode] = useState<'simulation' | 'real'>('simulation');
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState<Step[]>([
    { name: 'Open widget and start booking', status: 'pending' },
    { name: 'Select service: Classic Haircut', status: 'pending' },
    { name: 'Select date/time: tomorrow 12:00 PM', status: 'pending' },
    { name: 'Fill customer details', status: 'pending' },
    { name: 'Submit booking', status: 'pending' }
  ]);
  const [result, setResult] = useState('');

  const tomorrow = useMemo(() => new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10), []);

  function mark(index: number, status: Step['status'], detail?: string) {
    setSteps((prev) => prev.map((s, i) => (i === index ? { ...s, status, detail } : s)));
  }

  async function runDemo() {
    setRunning(true);
    setResult('');
    setSteps((prev) => prev.map((s) => ({ ...s, status: 'pending', detail: '' })));

    try {
      mark(0, 'running');
      await wait(400);
      mark(0, 'done', 'Widget opened');

      mark(1, 'running');
      await wait(300);
      mark(1, 'done', 'Classic Haircut selected');

      mark(2, 'running');
      const avRes = await fetch('/api/booking/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId, serviceName: 'Classic Haircut', date: tomorrow })
      });
      const av = await avRes.json();
      if (!avRes.ok || !Array.isArray(av.slots)) {
        mark(2, 'failed', av.error || 'No availability response');
        setResult(`Demo stopped: ${av.error || 'Failed to load availability'}`);
        setRunning(false);
        return;
      }
      const slot = av.slots.find((s: string) => new Date(s).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' }) === '12:00 PM') || av.slots[0];
      if (!slot) {
        mark(2, 'failed', 'No available slots found');
        setResult('Demo stopped: no available slots');
        setRunning(false);
        return;
      }
      mark(2, 'done', `Selected ${new Date(slot).toLocaleString('en-US', { timeZone: 'America/New_York' })}`);

      mark(3, 'running');
      await wait(300);
      mark(3, 'done', 'Customer: Demo Client, demo@example.com');

      mark(4, 'running');
      if (mode === 'simulation') {
        await wait(500);
        mark(4, 'done', 'Simulation completed (no real booking created)');
        setResult('Simulation complete. Switch to Real mode to create a real booking.');
        setRunning(false);
        return;
      }

      const idem = `${businessId}|${tomorrow}|1200|auto-demo`;
      const createRes = await fetch('/api/booking/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-idempotency-key': idem },
        body: JSON.stringify({
          businessId,
          serviceName: 'Classic Haircut',
          startTimeISO: slot,
          customerName: 'Demo Client',
          customerEmail: 'demo@example.com',
          idempotencyKey: idem
        })
      });
      const created = await createRes.json();
      if (!createRes.ok) {
        mark(4, 'failed', created.error || 'Booking failed');
        setResult(`Real booking failed: ${created.error || 'Unknown error'}`);
        setRunning(false);
        return;
      }
      mark(4, 'done', `Booking confirmed (${created.bookingId})`);
      setResult(`Real booking created: ${created.bookingId}`);
    } finally {
      setRunning(false);
    }
  }

  useEffect(() => {
    runDemo().catch(() => null);
  }, []);

  return (
    <main style={{ maxWidth: 900, margin: '24px auto', padding: 20 }}>
      <h1 style={{ marginBottom: 8 }}>Auto Demo</h1>
      <p style={{ color: '#94a3b8' }}>Business: <strong>{businessId}</strong> · This page auto-runs the booking flow.</p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <button onClick={() => setMode('simulation')} style={{ background: mode === 'simulation' ? '#16a34a' : '#1e293b' }}>Simulation</button>
        <button onClick={() => setMode('real')} style={{ background: mode === 'real' ? '#16a34a' : '#1e293b' }}>Real Booking</button>
        <button onClick={() => runDemo()} disabled={running}>{running ? 'Running...' : 'Replay Demo'}</button>
      </div>

      <div style={{ border: '1px solid #334155', borderRadius: 12, padding: 12, background: '#0b1220' }}>
        {steps.map((step, i) => (
          <div key={step.name} style={{ padding: '8px 0', borderBottom: i === steps.length - 1 ? 'none' : '1px solid #1e293b' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <strong>{step.name}</strong>
              <span style={{ color: step.status === 'done' ? '#86efac' : step.status === 'failed' ? '#fca5a5' : step.status === 'running' ? '#fde68a' : '#94a3b8' }}>{step.status}</span>
            </div>
            {step.detail ? <div style={{ fontSize: 12, color: '#94a3b8' }}>{step.detail}</div> : null}
          </div>
        ))}
      </div>

      {result ? <p style={{ marginTop: 12 }}>{result}</p> : null}
    </main>
  );
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
