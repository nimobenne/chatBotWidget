'use client';

import { useState, useEffect } from 'react';
import { Settings } from 'lucide-react';

import { TestimonialMarquee } from '@/components/blocks/testimonial-marquee';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const siteUrl = 'https://chat-bot-widget-two.vercel.app';
const whatsappHref = 'https://wa.me/31610431511?text=Hi%20WidgetAI%2C%20I%20want%20to%20set%20up%20the%20AI%20booking%20widget%20for%20my%20business.';
const emailHref = 'mailto:nimobenne@gmail.com?subject=WidgetAI%20Setup&body=Hi%2C%20I%27d%20like%20to%20set%20up%20WidgetAI%20for%20my%20business.';

const features = [
  { icon: '🌙', title: '24/7 AI receptionist', desc: 'Replies the second a client messages. Day, night, weekends. No missed bookings.' },
  { icon: '📅', title: 'Live calendar check', desc: 'Checks your real availability before offering any slot. No double-bookings, ever.' },
  { icon: '✅', title: 'Books directly', desc: 'Confirms the appointment and adds it to Google Calendar automatically.' },
  { icon: '📧', title: 'Confirmation emails', desc: 'Client gets a professional confirmation with all appointment details.' },
  { icon: '📊', title: 'Owner dashboard', desc: 'See bookings, revenue, and ROI from one clean dashboard.' },
  { icon: '📞', title: 'Phone fallback', desc: 'If online booking is unavailable, the bot gives clients your number to call directly.' },
];

const faqs = [
  {
    q: 'Does it actually book into my calendar?',
    a: 'Yes. When a client confirms, the booking goes directly into your Google Calendar. No manual entry.',
  },
  {
    q: 'What if a client wants to call instead?',
    a: 'The bot gives them your phone number. No client ever gets left without an answer.',
  },
  {
    q: 'What if I need to cancel or reschedule?',
    a: 'Clients can ask the bot to cancel or reschedule. It forwards the request to you by email so you can follow up. They can also call you directly — the bot gives them your number.',
  },
  {
    q: 'How long does setup take?',
    a: 'Under an hour. We handle your services, hours, and calendar connection. You add one script tag and go live.',
  },
  {
    q: 'When do I start paying?',
    a: 'Not until your first 5 confirmed bookings come through. No risk, no setup fee.',
  },
  {
    q: 'Can it handle multiple staff?',
    a: 'Multi-staff support is on the roadmap. Today it books for the shop. Message us on WhatsApp to discuss your setup.',
  },
  {
    q: 'What if the AI makes a mistake?',
    a: 'The AI only books into your real Google Calendar, so it can never double-book. If a customer asks something it can\'t handle, it gives them your phone number. You stay in control.',
  },
  {
    q: 'What website platform do I need?',
    a: 'Any platform that lets you add a script tag — WordPress, Wix, Squarespace, Webflow, Shopify, or plain HTML. We check during setup. If your platform supports it, you\'re good to go.',
  },
  {
    q: 'Does it work on mobile?',
    a: 'Yes. The widget works in any browser on any device — desktop, tablet, and mobile. Your clients can book from their phone just as easily as from a computer.',
  },
  {
    q: 'Can it help both barbershops and hair salons?',
    a: 'Yes. WidgetAI is set up around your specific services, hours, and business name — whether you run a barbershop or a hair salon. It answers questions and books appointments for any appointment-based shop.',
  },
  {
    q: 'What kinds of questions can it answer?',
    a: 'Pricing, services, opening hours, location, walk-in availability, booking help, cancellations, and rescheduling. If a question is outside its scope, it gives clients your phone number so they can reach you directly.',
  },
];

export default function HomePage() {
  const [demoLoaded, setDemoLoaded] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  function launchDemo() {
    if (demoLoaded) return;
    setDemoLoaded(true);
    const s = document.createElement('script');
    s.src = '/widget.js';
    s.setAttribute('data-business', 'examplebarber');
    s.setAttribute('data-demo', 'true');
    s.setAttribute('data-position', 'bottom-right');
    document.body.appendChild(s);
  }

  useEffect(() => {
    const t = setTimeout(launchDemo, 1500);
    return () => clearTimeout(t);
  }, []);

  return (
    <>

      <nav className="flex items-center justify-between px-5 pt-3 text-xs text-muted-foreground">
        <a href={siteUrl} className="font-medium text-emerald-400 hover:text-emerald-300 transition-colors">
          chat-bot-widget-two.vercel.app
        </a>
        <div className="flex gap-4">
          <a href="/admin" className="text-muted-foreground hover:text-emerald-400 transition-colors" title="Admin">
            <Settings size={16} />
          </a>
        </div>
      </nav>

      <main className="mx-auto w-full max-w-6xl px-5 pb-16 pt-4 md:pt-6">

        {/* Hero */}
        <section className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-emerald-900/35 via-card to-background p-6 shadow-[0_20px_80px_-40px_rgba(16,185,129,0.55)] md:p-10">
          <div className="pointer-events-none absolute -left-10 top-0 h-48 w-48 rounded-full bg-emerald-400/15 blur-3xl" />
          <div className="pointer-events-none absolute right-0 top-10 h-44 w-44 rounded-full bg-emerald-300/10 blur-3xl" />
          <div className="relative animate-fade-in-up">
            <div className="mb-3 flex flex-wrap gap-2">
              <span className="text-xs uppercase tracking-[0.22em] text-emerald-300">Built for barbershops & hair salons</span>
              <span className="text-xs text-emerald-400/60">·</span>
              <span className="text-xs uppercase tracking-[0.22em] text-emerald-400/70">Setup included · Free until 5 bookings</span>
            </div>
            <h1 className="max-w-3xl text-4xl font-semibold leading-tight tracking-tight text-foreground md:text-6xl">
              Turn more website visitors into booked appointments — 24/7
            </h1>
            <p className="mt-4 max-w-2xl text-base text-muted-foreground md:text-lg">
              WidgetAI helps barbershops and hair salons answer common questions, guide visitors to booking, and capture appointments automatically — even when the shop is closed.
            </p>
            <ul className="mt-4 space-y-1.5 text-sm text-emerald-200/90">
              <li>✓ Replies instantly, even at 2am on a Sunday</li>
              <li>✓ Checks your real calendar before confirming any slot</li>
              <li>✓ Sends the client a confirmation email automatically</li>
            </ul>
            <div className="mt-6 flex flex-wrap gap-3">
              <a href={whatsappHref} target="_blank" rel="noreferrer" className={cn(buttonVariants({ variant: 'default', size: 'lg' }), 'font-semibold')}>
                Get Started on WhatsApp
              </a>
              <a href={emailHref} className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'font-semibold')}>
                Get Started via Email
              </a>
              <button onClick={launchDemo} className={buttonVariants({ variant: 'secondary', size: 'lg' })}>
                Try Live Demo
              </button>
            </div>
            <div className="mt-5 text-sm font-medium text-emerald-200">£39.99/month · No charge until first 5 bookings · Cancel anytime</div>
          </div>
        </section>

        {/* Stats */}
        <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { value: '24/7', label: 'Always online' },
            { value: '<1min', label: 'Average response time' },
            { value: '£0', label: 'Until you see results' },
            { value: '0', label: 'Missed bookings' },
          ].map(({ value, label }) => (
            <div key={label} className="rounded-xl border border-border bg-card/70 p-4 text-center">
              <div className="text-2xl font-bold text-emerald-400">{value}</div>
              <div className="mt-1 text-xs text-muted-foreground">{label}</div>
            </div>
          ))}
        </section>

        {/* Problem */}
        <section className="mt-8 rounded-2xl border border-border bg-card/40 p-6 md:p-8">
          <div className="max-w-2xl">
            <div className="mb-4 text-xs uppercase tracking-widest text-muted-foreground">Sound familiar?</div>
            <p className="text-xl font-semibold leading-relaxed text-foreground md:text-2xl">
              You&apos;re with a client. The phone rings. You can&apos;t answer.
              They hang up. They book somewhere else.{' '}
              <span className="text-muted-foreground font-normal">You never find out.</span>
            </p>
            <p className="mt-5 text-base text-emerald-300 font-medium md:text-lg">
              WidgetAI answers instantly. Checks your real calendar. Books the appointment. While you focus on the client in front of you.
            </p>
          </div>
        </section>

        {/* Features */}
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

        {/* Testimonials */}
        <section className="mt-8">
          <TestimonialMarquee />
        </section>

        {/* How it works */}
        <section className="mt-8 rounded-2xl border border-border bg-secondary/35 p-6">
          <h2 className="mt-0 text-2xl font-semibold">Live in under an hour</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {[
              { n: '1', title: 'Setup', desc: 'We configure your services, hours, and branding. You review and approve.' },
              { n: '2', title: 'Connect', desc: 'Link your Google Calendar. One click and you are connected.' },
              { n: '3', title: 'Go live', desc: 'Paste one script tag on your site. The bot starts taking bookings.' },
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

        {/* Pricing */}
        <section className="mt-8" id="pricing">
          <h2 className="text-2xl font-semibold mb-4">Simple pricing, no surprises</h2>
          <div className="max-w-sm">
            <div className="rounded-2xl border-2 border-emerald-700/60 bg-card p-6 shadow-[0_0_40px_-10px_rgba(16,185,129,0.25)]">
              <div className="text-xs uppercase tracking-widest text-emerald-400 mb-2">All inclusive</div>
              <div className="text-4xl font-bold text-foreground">£39.99<span className="text-lg font-normal text-muted-foreground">/month</span></div>
              <div className="mt-1 text-sm text-muted-foreground">No charge until your first 5 bookings</div>
              <div className="mt-3 rounded-lg bg-emerald-900/30 border border-emerald-700/40 px-4 py-3 text-xs text-emerald-200/80 leading-relaxed">
                Average appointment: £30–£60. Just 1–2 extra bookings per month covers the full cost. Most shops make it back in the first week.
              </div>
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
              <a
                href={emailHref}
                className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'w-full mt-2 font-semibold')}
              >
                Get started via Email
              </a>
            </div>
          </div>
        </section>

        {/* FAQ */}
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

        {/* Final CTA */}
        <section className="mt-10 rounded-3xl border border-emerald-700/40 bg-gradient-to-br from-emerald-900/30 via-card to-background p-8 text-center">
          <h2 className="text-2xl font-semibold md:text-3xl mb-3">Stop missing bookings today.</h2>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            Message us on WhatsApp. We will have you set up and taking bookings the same day. No upfront cost. Cancel anytime.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <a
              href={whatsappHref}
              target="_blank"
              rel="noreferrer"
              className={cn(buttonVariants({ variant: 'default', size: 'lg' }), 'font-semibold text-base px-8')}
            >
              Message on WhatsApp to get set up today
            </a>
            <a
              href={emailHref}
              className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'font-semibold text-base px-8')}
            >
              Get in touch via Email
            </a>
          </div>
          <div className="mt-4 text-xs text-muted-foreground">£39.99/month · Free until first 5 bookings · No contracts</div>
          <div className="mt-3 text-xs text-muted-foreground/60">
            <a href={siteUrl} className="hover:text-muted-foreground transition-colors">{siteUrl}</a>
          </div>
        </section>

      </main>
    </>
  );
}
