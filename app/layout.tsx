import './globals.css';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'WidgetAI',
  description: 'AI booking widget for barbershops'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <footer style={{ marginTop: 32, borderTop: '1px solid #1e293b', padding: '16px 20px', color: '#94a3b8', fontSize: 13, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div><strong style={{ color: '#e2e8f0' }}>WidgetAI</strong></div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <a href="mailto:nimobenne@gmail.com">nimobenne@gmail.com</a>
            <a href="https://wa.me/31610431511" target="_blank" rel="noreferrer">WhatsApp</a>
            <a href="/privacy">Privacy</a>
            <a href="/terms">Terms</a>
          </div>
        </footer>
      </body>
    </html>
  );
}
