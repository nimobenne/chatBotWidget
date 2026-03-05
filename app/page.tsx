import Link from 'next/link';

import { TestimonialMarquee } from '@/components/blocks/testimonial-marquee';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const whatsappHref = 'https://wa.me/31610431511?text=Hi%20WidgetAI%2C%20I%20want%20to%20set%20up%20the%20AI%20booking%20widget%20for%20my%20barbershop.';

export default function HomePage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-5 pb-6 pt-10 md:pt-12">
      <section className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-emerald-900/35 via-card to-background p-6 shadow-[0_20px_80px_-40px_rgba(16,185,129,0.55)] md:p-10">
        <div className="pointer-events-none absolute -left-10 top-0 h-48 w-48 rounded-full bg-emerald-400/15 blur-3xl" />
        <div className="pointer-events-none absolute right-0 top-10 h-44 w-44 rounded-full bg-emerald-300/10 blur-3xl" />
        <div className="relative animate-fade-in-up">
          <div className="mb-3 text-xs uppercase tracking-[0.22em] text-emerald-300">Built for barber shops</div>
          <h1 className="max-w-3xl text-4xl font-semibold leading-tight tracking-tight text-foreground md:text-6xl">
            Turn missed calls into booked chairs, 24/7.
          </h1>
          <p className="mt-4 max-w-2xl text-base text-muted-foreground md:text-lg">
            WidgetAI chats with clients, checks live availability, and books directly into your calendar.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a href={whatsappHref} target="_blank" rel="noreferrer" className={cn(buttonVariants({ variant: 'default', size: 'lg' }), 'font-semibold')}>
              Message on WhatsApp
            </a>
            <Link href="/demo/auto?biz=examplebarber" className={buttonVariants({ variant: 'secondary', size: 'lg' })}>
              Try Live Demo
            </Link>
            <Link href="/owner" className={buttonVariants({ variant: 'secondary', size: 'lg' })}>
              Owner Login
            </Link>
            <Link href="/admin" className={buttonVariants({ variant: 'secondary', size: 'lg' })}>
              Admin Login
            </Link>
          </div>
          <div className="mt-5 text-sm font-medium text-emerald-200">€50/month · Setup fee waived (normally €99) · No charge until first 5 bookings</div>
        </div>
      </section>

      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[
          '24/7 AI receptionist replies instantly',
          'Live availability + conflict checking',
          'Google Calendar sync for confirmed bookings',
          'Owner portal + admin controls',
          'Phone fallback when online booking is unavailable',
          'Multi-business support from one dashboard'
        ].map((f) => (
          <div key={f} className="rounded-xl border border-border bg-card/70 p-4 text-sm text-foreground/90">
            {f}
          </div>
        ))}
      </section>

      <section className="mt-6">
        <TestimonialMarquee />
      </section>

      <section id="demo" className="mt-7 rounded-2xl border border-border bg-card/60 p-6">
        <h2 className="mt-0 text-2xl font-semibold">Pre-demo flow</h2>
        <ol className="mt-4 space-y-2 pl-5 text-muted-foreground">
          <li>Customer asks for tomorrow at 10:00</li>
          <li>WidgetAI checks business hours + existing bookings + calendar conflicts</li>
          <li>If valid, booking is created and calendar event is required for confirmation</li>
          <li>If not valid, customer gets fallback to call the business</li>
        </ol>
        <div className="mt-5 flex flex-wrap gap-2.5">
          <Link href="/demo/auto?biz=examplebarber" className={buttonVariants({ variant: 'default', size: 'sm' })}>
            Open Auto Demo
          </Link>
          <Link href="/demo?biz=examplebarber" className={buttonVariants({ variant: 'secondary', size: 'sm' })}>
            Open Manual Demo
          </Link>
          <Link href="/admin" className={buttonVariants({ variant: 'secondary', size: 'sm' })}>
            Open Admin Portal
          </Link>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-border bg-secondary/35 p-6">
        <h2 className="mt-0 text-2xl font-semibold">How onboarding works</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div>
            <strong>1. Setup</strong>
            <div className="text-muted-foreground">We set your services, hours, and branding.</div>
          </div>
          <div>
            <strong>2. Connect</strong>
            <div className="text-muted-foreground">Connect your Google Calendar securely.</div>
          </div>
          <div>
            <strong>3. Go live</strong>
            <div className="text-muted-foreground">Add one script and start booking clients.</div>
          </div>
        </div>
      </section>
    </main>
  );
}
