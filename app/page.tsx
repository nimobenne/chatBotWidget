'use client';

import Link from 'next/link';
import Script from 'next/script';
import { useState } from 'react';

import { TestimonialMarquee } from '@/components/blocks/testimonial-marquee';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const whatsappHref = 'https://wa.me/31610431511?text=Hi%20WidgetAI%2C%20I%20want%20to%20set%20up%20the%20AI%20booking%20widget%20for%20my%20barbershop.';

const features = [
  { icon: '🌙', title: '24/7 AI receptionist', desc: 'Replies the second a client messages — day, night, weekends. No missed bookings.' },
  { icon: '📅', title: 'Live calendar check', desc: 'Checks your real availability before offering slots. No double-bookings.' },
  { icon: '✅', title: 'Books directly', desc: 'Confirms the appointment and adds it to Google Calendar automatically.' },
  { icon: '📧', title: 'Confirmation emails', desc: 'Client gets a professional confirmation with appointment details.' },
  { icon: '📊', title: 'Owner dashboard', desc: 'See bookings, revenue, and ROI from one clean dashboard.' },
  { icon: '📞', title: 'Graceful fallback', desc: 'If online booking fails, the bot gives clients your number. Nothing slips through.' },
];

const faqs = [
  {
    q: 'Does it actually book into my calendar?',
    a: 'Yes. When a client confirms, the booking goes directly into your Google Calendar. No manual entry, no copy-pasting.',
  },
  {
    q: 'What if a client wants to call instead?',
    a: 'The bot gives them your phone number automatically. It never leaves a client stuck.',
  },
  {
    q: 'What if I need to cancel or reschedule?',
    a: 'Clients call you directly for changes. The bot tells them your number and you handle it your way.',
  },
  {
    q: 'How long does setup take?',
    a: 'Usually under an hour. We handle the setup for you — services, hours, calendar connection. You add one script tag and you\'re live.',
  },
  {
    q: 'When do I start paying?',
    a: 'Not until your first 5 confirmed bookings come through the widget. No risk, no setup fee.',
  },
  {
    q: 'Can it handle multiple barbers?',
    a: 'Multi-barber support is on the roadmap. Today it books for the shop — message us on WhatsApp to discuss your setup.',
  },
];

export default function HomePage() {
  const [demoLoaded, setDemoLoaded] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  function launchDemo() {
    if (demoLoaded) {
      // Already loaded — just open the bubble
      const host = document.querySelector('div[data-widget-demo]');
      if (host && host.shadowRoot) {
        const bubble = host.shadowRoot.querySelector('.bubble') as HTMLElement | null;
        bubble?.click();
      }
      return;
    }
    setDemoLoaded(true);
  }

  return (
    <>
      {/* Real widget for live chat */}
      <Script src="/widget.js" data-business="examplebarber" strategy="afterInteractive" />

      {/* Demo widget injected on demand */}
      {demoLoaded && (
        <Script
          src="/widget.js"
          data-business="examplebarber"
          data-demo="true"
          data-position="bottom-right"
          strategy="afterInteractive"
          onLoad={() => {}}
        />
      )}

      <nav className="flex justify-end gap-4 px-5 pt-3 text-xs text-muted-foreground">
        <Link href="/owner" className="hover:text-foreground transition-colors">Owner Portal</Link>
        <Link href="/admin" className="hover:text-foreground transition-colors">Admin</Link>
      </nav>

      <main className="mx-auto w-full max-w-6xl px-5 pb-16 pt-4 md:pt-6">

        {/* ── Hero ── */}
        <section className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-emerald-900/35 via-card to-background p-6 shadow-[0_20px_80px_-40px_rgba(16,185,129,0.55)] md:p-10">
          <div className="pointer-events-none absolute -left-10 top-0 h-48 w-48 rounded-full bg-emerald-400/15 blur-3xl" />
          <div className="pointer-events-none absolute right-0 top-10 h-44 w-44 rounded-full bg-emerald-300/10 blur-3xl" />
          <div className="relative animate-fade-in-up">
            <div className="mb-3 text-xs uppercase tracking-[0.22em] text-emerald-300">Built for barbershops</div>
            <h1 className="max-w-3xl text-4xl font-semibold leading-tight tracking-tight text-foreground md:text-6xl">
              Turn missed calls into booked chairs, 24/7.
            </h1>
            <p className="mt-4 max-w-2xl text-base text-muted-foreground md:text-lg">
              WidgetAI chats with clients, checks live availability, and books directly into your calendar.
            </p>
            <ul className="mt-4 space-y-1.5 text-sm text-emerald-200/90">
              <li>✓ Replies instantly — even at 2am on a Sunday</li>
              <li>✓ Checks your real calendar before confirming any slot</li>
              <li>✓ Sends the client a confirmation email automatically</li>
            </ul>
            <div className="mt-6 flex flex-wrap gap-3">
              <a href={whatsappHref} target="_blank" rel="noreferrer" className={cn(buttonVariants({ variant: 'default', size: 'lg' }), 'font-semibold')}>
                Message on WhatsApp
              </a>
              <Link href="/demo/auto?biz=examplebarber" className={buttonVariants({ variant: 'secondary', size: 'lg' })}>
                Try Live Demo
              </Link>
            </div>
            <div className="mt-5 text-sm font-medium text-emerald-200">€39.99/month · No charge until first 5 bookings · Cancel anytime</div>
          </div>
        </section>

        {/* ── Stats bar ── */}
        <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { value: '150+', label: 'Bookings made' },
            { value: '40+',  label: 'Barbershops onboarded' },
            { value: '24/7', label: 'Always online' },
            { value: '€0',   label: 'Until you see results' },
          ].map(({ value, label }) => (
            <div key={label} className="rounded-xl border border-border bg-card/70 p-4 text-center">
              <div className="text-2xl font-bold text-emerald-400">{value}</div>
              <div className="mt-1 text-xs text-muted-foreground">{label}</div>
            </div>
          ))}
        </section>

        {/* ── Problem section ── */}
        <section className="mt-8 rounded-2xl border border-border bg-card/40 p-6 md:p-8">
          <div className="max-w-2xl">
            <div className="mb-4 text-xs uppercase tracking-widest text-muted-foreground">Sound familiar?</div>
            <p className="text-xl font-semibold leading-relaxed text-foreground md:text-2xl">
              You&apos;re in the middle of a cut. The phone rings. You can&apos;t answer.
              They hang up. They book somewhere else.{' '}
              <span className="text-muted-foreground font-normal">You never knew.</span>
            </p>
            <p className="mt-6 text-base text-emerald-300 font-medium md:text-lg">
              WidgetAI answers instantly. Checks your real calendar. Books the appointment.
              While you keep cutting.
            </p>
          </div>
        </section>

        {/* ── Features ── */}
        <section className="mt-8">
          <h2 className="text-2xl font-semibold mb-4">Everything your front desk would do</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {features.map(({ icon, title, desc }) => (
              <div key={title} className="rounded-xl border border-border bg-card/70 p-5">
                <div className="text-2xl mb-3">{icon}</div>
                <div className="font-semibold text-sm text-foreground mb-1">{title}</div>
                <div className="text-xs text-muted-foreground leading-relaxed">{desc}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Testimonials ── */}
        <section className="mt-8">
          <TestimonialMarquee />
        </section>

        {/* ── How onboarding works ── */}
        <section className="mt-8 rounded-2xl border border-border bg-secondary/35 p-6">
          <h2 className="mt-0 text-2xl font-semibold">Live in under an hour</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {[
              { n: '1', title: 'Setup', desc: 'We configure your services, hours, and branding. You just review and approve.' },
              { n: '2', title: 'Connect', desc: 'Link your Google Calendar. One OAuth click — we handle the rest.' },
              { n: '3', title: 'Go live', desc: 'Paste one script tag on your site. That\'s it. The bot starts taking bookings.' },
            ].map(({ n, title, desc }) => (
              <div key={n} className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-900/60 border border-emerald-700/50 flex items-center justify-center text-sm font-bold text-emerald-400">{n}</div>
                <div>
                  <div className="font-semibold text-foreground">{title}</div>
                  <div className="text-sm text-muted-foreground mt-1">{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Pricing ── */}
        <section className="mt-8" id="pricing">
          <h2 className="text-2xl font-semibold mb-4">Simple pricing, no surprises</h2>
          <div className="max-w-sm">
            <div className="rounded-2xl border-2 border-emerald-700/60 bg-card p-6 shadow-[0_0_40px_-10px_rgba(16,185,129,0.25)]">
              <div className="text-xs uppercase tracking-widest text-emerald-400 mb-2">All inclusive</div>
              <div className="text-4xl font-bold text-foreground">€39.99<span className="text-lg font-normal text-muted-foreground">/month</span></div>
              <div className="mt-1 text-sm text-muted-foreground">No charge until your first 5 bookings</div>
              <ul className="mt-5 space-y-2.5 text-sm">
                {[
                  '24/7 AI receptionist',
                  'Google Calendar sync',
                  'Booking confirmation emails',
                  'Owner dashboard + ROI view',
                  'Unlimited conversations',
                  'Setup included, no tech skills needed',
                  'Cancel anytime',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-foreground/90">
                    <span className="text-emerald-400 flex-shrink-0 mt-0.5">✓</span>
                    {item}
                  </li>
                ))}
              </ul>
              <a
                href={whatsappHref}
                target="_blank"
                rel="noreferrer"
                className={cn(buttonVariants({ variant: 'default', size: 'lg' }), 'w-full mt-6 font-semibold')}
              >
                Get started on WhatsApp
              </a>
            </div>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section className="mt-8">
          <h2 className="text-2xl font-semibold mb-4">Questions</h2>
          <div className="space-y-2 max-w-2xl">
            {faqs.map(({ q, a }, i) => (
              <div key={q} className="rounded-xl border border-border bg-card/60 overflow-hidden">
                <button
                  className="w-full text-left px-5 py-4 text-sm font-semibold text-foreground flex justify-between items-center gap-4 hover:bg-card transition-colors"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                >
                  <span>{q}</span>
                  <span className="text-muted-foreground flex-shrink-0 text-base">{openFaq === i ? '−' : '+'}</span>
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-4 text-sm text-muted-foreground leading-relaxed">{a}</div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* ── Final CTA ── */}
        <section className="mt-10 rounded-3xl border border-emerald-700/40 bg-gradient-to-br from-emerald-900/30 via-card to-background p-8 text-center">
          <h2 className="text-2xl font-semibold md:text-3xl mb-3">Ready to stop missing bookings?</h2>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            Message us on WhatsApp and we&apos;ll have you set up and taking bookings today.
            No upfront cost. Cancel anytime.
          </p>
          <a
            href={whatsappHref}
            target="_blank"
            rel="noreferrer"
            className={cn(buttonVariants({ variant: 'default', size: 'lg' }), 'font-semibold text-base px-8')}
          >
            Message on WhatsApp — get set up today
          </a>
          <div className="mt-4 text-xs text-muted-foreground">€39.99/month · Free until first 5 bookings · No contracts</div>
        </section>

      </main>
    </>
  );
}
