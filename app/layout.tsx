import './globals.css';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'AI Receptionist',
  description: 'Embeddable multi-tenant AI receptionist widget'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
