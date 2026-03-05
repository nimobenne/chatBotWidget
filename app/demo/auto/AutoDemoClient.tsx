'use client';

import { useEffect, useState } from 'react';

type Step = { name: string; status: 'pending' | 'running' | 'done' | 'failed'; detail?: string };

export default function AutoDemoClient({ businessId }: { businessId: string }) {
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState<Step[]>([
    { name: 'Open widget and start booking', status: 'pending' },
    { name: 'Select service: Classic Haircut', status: 'pending' },
    { name: 'Select date/time: tomorrow 12:00 PM', status: 'pending' },
    { name: 'Fill customer details', status: 'pending' },
    { name: 'Submit booking', status: 'pending' }
  ]);
  const [result, setResult] = useState('');

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
      await wait(600);
      mark(2, 'done', 'Tomorrow 12:00 PM selected');

      mark(3, 'running');
      await wait(300);
      mark(3, 'done', 'Customer: Demo Client, demo@example.com');

      mark(4, 'running');
      await wait(500);
      mark(4, 'done', 'Booking confirmed (simulation)');
      setResult('Simulation complete — widget is working correctly.');
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
