import './globals.css';
import type { ReactNode } from 'react';
import { Plus_Jakarta_Sans } from 'next/font/google';

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  display: 'swap'
});

export const metadata = {
  title: 'WidgetAI',
  description: 'AI booking widget for barbershops'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className={plusJakarta.className}>
        {children}
        <footer className="mx-auto mt-10 flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-5 text-sm text-muted-foreground">
          <div>
            <strong className="text-foreground">WidgetAI</strong>
          </div>
          <div className="flex flex-wrap gap-3">
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
