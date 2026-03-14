'use client';

import { useState, useEffect, useRef } from 'react';
import { Settings } from 'lucide-react';

import { TestimonialMarquee } from '@/components/blocks/testimonial-marquee';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const siteUrl = 'https://chat-bot-widget-two.vercel.app';
const whatsappHref = 'https://wa.me/31610431511?text=Hi%20WidgetAI%2C%20I%20want%20to%20set%20up%20the%20AI%20booking%20widget%20for%20my%20business.';
const emailHref = 'mailto:nimobenne@gmail.com?subject=WidgetAI%20Setup&body=Hi%2C%20I%27d%20like%20to%20set%20up%20WidgetAI%20for%20my%20business.';

const features = [
  { n: '01', title: '24/7 AI receptionist', desc: 'Replies the second a client messages — day, night, weekends. No missed bookings.' },
  { n: '02', title: 'Live calendar check', desc: 'Checks your real availability before offering any slot. No double-bookings, ever.' },
  { n: '03', title: 'Books directly', desc: 'Confirms the appointment and adds it to Google Calendar automatically.' },
  { n: '04', title: 'Confirmation emails', desc: 'Client gets a professional confirmation with all appointment details.' },
  { n: '05', title: 'Bookings dashboard', desc: 'See all your bookings and earnings in one place.' },
  { n: '06', title: 'Never leaves a client stuck', desc: "If a client asks something it can't answer, it gives them your phone number so they can reach you directly." },
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
    a: 'Under an hour. We handle your services, hours, and calendar connection. We add it to your website — or walk you through it. You go live the same day.',
  },
  {
    q: 'When do I start paying?',
    a: 'Not until your first 5 confirmed bookings come through. No risk, no setup fee.',
  },
  {
    q: 'Can it handle multiple staff?',
    a: "We're adding multi-staff support soon. For now, the bot books appointments for the shop. Message us on WhatsApp to talk through your setup.",
  },
  {
    q: 'What if the AI makes a mistake?',
    a: "The AI only books into your real Google Calendar, so it can never double-book. If a customer asks something it can't handle, it gives them your phone number. You stay in control.",
  },
  {
    q: 'What website platform do I need?',
    a: "Works with any website — WordPress, Wix, Squarespace, Webflow, Shopify, or plain HTML. We check during setup and handle the technical side for you.",
  },
  {
    q: 'Does it work on mobile?',
    a: 'Yes. The widget works in any browser on any device — desktop, tablet, and mobile. Your clients can book from their phone just as easily as from a computer.',
  },
  {
    q: 'Can it help both barbershops and hair salons?',
    a: 'Yes. WidgetAI is set up around your specific services, hours, and business name — whether you run a barbershop or a hair salon.',
  },
  {
    q: 'What kinds of questions can it answer?',
    a: 'Pricing, services, opening hours, location, walk-in availability, booking help, cancellations, and rescheduling. If a question is outside its scope, it gives clients your phone number.',
  },
];

const steps = [
  { n: '1', title: 'Setup', desc: 'We configure your services, hours, and branding. You review and approve.' },
  { n: '2', title: 'Connect', desc: "Link your Google Calendar with one click. That's it." },
  { n: '3', title: 'Go live', desc: "We add it to your website — or walk you through it. You're taking bookings the same day." },
];

export default function HomePage() {
  const [demoLoaded, setDemoLoaded] = useState(false);
  const demoLoadedRef = useRef(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  // Shows the sticky mobile CTA once the hero CTA scrolls out of view
  const [showStickyCta, setShowStickyCta] = useState(false);

  function launchDemo() {
    if (demoLoadedRef.current) return;
    demoLoadedRef.current = true;
    setDemoLoaded(true);
    const s = document.createElement('script');
    s.src = '/widget.js';
    s.setAttribute('data-business', 'examplebarber');
    s.setAttribute('data-demo', 'true');
    s.setAttribute('data-position', 'bottom-right');
    s.onerror = () => {
      demoLoadedRef.current = false;
      setDemoLoaded(false);
    };
    document.body.appendChild(s);
  }

  // Widget autoload
  useEffect(() => {
    const t = setTimeout(launchDemo, 1500);
    return () => clearTimeout(t);
  }, []);

  // Scroll reveals — with graceful fallback for browsers without IntersectionObserver
  useEffect(() => {
    const els = document.querySelectorAll<Element>('.reveal');
    if (!('IntersectionObserver' in window)) {
      els.forEach((el) => el.classList.add('in-view'));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in-view');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1 },
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  // Sticky mobile CTA: show when hero CTA buttons leave the viewport
  useEffect(() => {
    const heroCta = document.getElementById('hero-cta');
    if (!heroCta || !('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver(
      ([entry]) => setShowStickyCta(!entry.isIntersecting),
      { threshold: 0 },
    );
    observer.observe(heroCta);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <nav aria-label="Site navigation" className="flex items-center justify-between px-5 pt-3 text-xs text-muted-foreground">
        <a
          href={siteUrl}
          className="truncate max-w-[220px] font-medium text-amber-400 transition-colors hover:text-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm sm:max-w-none"
        >
          chat-bot-widget-two.vercel.app
        </a>
        <a href="/admin" className="p-2 -m-2 flex-shrink-0 text-muted-foreground transition-colors hover:text-amber-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm" title="Admin" aria-label="Admin settings">
          <Settings size={16} />
        </a>
      </nav>

      <main className="mx-auto w-full max-w-6xl px-5 pb-28 pt-4 md:pb-16 md:pt-6">

        {/* Hero — staggered entrance */}
        <section className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-amber-900/25 via-card to-background p-6 md:p-10">
          <div className="relative">
            <span
              className="text-xs uppercase tracking-[0.22em] text-amber-300 animate-fade-in-up"
              style={{ animationDelay: '0ms' }}
            >
              Built for barbershops &amp; hair salons · Free until 5 bookings
            </span>
            <h1
              className="mt-3 max-w-3xl text-4xl font-semibold leading-tight tracking-tight text-foreground md:text-6xl animate-fade-in-up"
              style={{ animationDelay: '80ms' }}
            >
              Turn more website visitors into booked appointments — 24/7
            </h1>
            <p
              className="mt-4 max-w-2xl text-base text-muted-foreground md:text-lg animate-fade-in-up"
              style={{ animationDelay: '180ms' }}
            >
              WidgetAI answers questions, checks your real calendar, and confirms bookings automatically — even when the shop is closed.
            </p>
            {/* id="hero-cta" lets the sticky CTA observer watch this element */}
            <div
              id="hero-cta"
              className="mt-6 flex flex-col gap-3 animate-fade-in-up sm:flex-row sm:flex-wrap sm:items-center"
              style={{ animationDelay: '280ms' }}
            >
              <a
                href={whatsappHref}
                target="_blank"
                rel="noreferrer"
                className={cn(
                  buttonVariants({ variant: 'default', size: 'lg' }),
                  'w-full justify-center font-semibold transition-transform duration-150 hover:scale-[1.02] hover:opacity-100 active:scale-[0.97] sm:w-auto',
                )}
              >
                Get started on WhatsApp
              </a>
              <button
                type="button"
                onClick={launchDemo}
                disabled={demoLoaded}
                className={cn(
                  buttonVariants({ variant: 'secondary', size: 'lg' }),
                  'w-full justify-center transition-transform duration-150 hover:scale-[1.02] hover:opacity-100 active:scale-[0.97] sm:w-auto',
                )}
              >
                {demoLoaded ? 'Demo active ↘' : 'Try Live Demo'}
              </button>
            </div>
            <div
              className="mt-4 text-xs text-muted-foreground animate-fade-in-up"
              style={{ animationDelay: '340ms' }}
            >
              £39.99/month · No charge until first 5 bookings · Cancel anytime
            </div>
          </div>
        </section>

        {/* Problem */}
        <section className="mt-8 rounded-2xl border border-border bg-card/40 p-6 md:p-8 reveal">
          <div className="max-w-2xl">
            <div className="mb-4 text-xs uppercase tracking-widest text-muted-foreground">Sound familiar?</div>
            <p className="text-xl font-semibold leading-relaxed text-foreground md:text-2xl">
              You&apos;re with a client. The phone rings. You can&apos;t answer.
              They hang up. They book somewhere else.{' '}
              <span className="font-normal text-muted-foreground">You never find out.</span>
            </p>
            <p className="mt-5 text-base font-medium text-amber-300 md:text-lg">
              WidgetAI answers instantly. Checks your real calendar. Books the appointment. While you focus on the client in front of you.
            </p>
          </div>
        </section>

        {/* Features */}
        <section className="mt-8 reveal">
          <h2 className="mb-1 text-2xl font-semibold">Everything your front desk would do</h2>
          <p className="mb-6 text-sm text-muted-foreground">Without the wages, sick days, or missed calls.</p>
          <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card/40">
            {features.map(({ n, title, desc }) => (
              <div
                key={n}
                className="flex cursor-default items-start gap-5 border-l-2 border-l-transparent px-5 py-4 transition-colors duration-150 hover:border-l-amber-500/40 hover:bg-amber-900/10 sm:gap-8"
              >
                <span className="mt-0.5 w-6 flex-shrink-0 font-mono text-xs text-amber-500/50">{n}</span>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:gap-8">
                  <div className="flex-shrink-0 break-words text-sm font-semibold text-foreground sm:w-44">{title}</div>
                  <div className="min-w-0 text-sm text-muted-foreground">{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Testimonials */}
        <section className="mt-8 reveal">
          <TestimonialMarquee />
        </section>

        {/* How it works — steps stagger in */}
        <section className="mt-8 rounded-2xl border border-border bg-secondary/35 p-6 reveal">
          <h2 className="text-2xl font-semibold">Live in under an hour</h2>
          <div className="mt-5 grid gap-6 md:grid-cols-3">
            {steps.map(({ n, title, desc }) => (
              <div key={n} className="flex gap-4 step-item">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-amber-700/50 bg-amber-900/60 text-sm font-bold text-amber-400">
                  {n}
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-foreground">{title}</div>
                  <div className="mt-1 text-sm text-muted-foreground">{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Pricing */}
        <section className="mt-8 reveal" id="pricing">
          <h2 className="mb-4 text-2xl font-semibold">Simple pricing, no surprises</h2>
          <div className="max-w-sm">
            <div className="rounded-2xl border border-amber-700/50 bg-card p-6">
              <div className="mb-2 text-xs uppercase tracking-widest text-amber-400">All inclusive</div>
              <div className="text-4xl font-bold text-foreground">
                £39.99<span className="text-lg font-normal text-muted-foreground">/month</span>
              </div>
              <div className="mt-1 text-sm text-muted-foreground">No charge until your first 5 bookings</div>
              <div className="mt-3 rounded-lg border border-amber-700/30 bg-amber-900/20 px-4 py-3 text-xs leading-relaxed text-amber-200/80">
                Average appointment: £30–£60. Just 1–2 extra bookings a month covers the full cost. Most shops make it back in the first week.
              </div>
              <ul className="mt-5 space-y-2.5 text-sm">
                {[
                  '24/7 AI receptionist',
                  'Google Calendar sync',
                  'Booking confirmation emails',
                  'Bookings dashboard and earnings view',
                  'Unlimited conversations',
                  'Setup included, no tech skills needed',
                  'Cancel anytime',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-foreground/90">
                    <span className="mt-0.5 flex-shrink-0 text-amber-400">✓</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <a
                href={whatsappHref}
                target="_blank"
                rel="noreferrer"
                className={cn(
                  buttonVariants({ variant: 'default', size: 'lg' }),
                  'mt-6 w-full font-semibold transition-transform duration-150 hover:scale-[1.02] hover:opacity-100 active:scale-[0.97]',
                )}
              >
                Get started on WhatsApp
              </a>
              <div className="mt-3 text-center text-xs text-muted-foreground">
                Prefer email?{' '}
                <a href={emailHref} className="underline underline-offset-2 transition-colors hover:text-foreground">
                  Get in touch
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="mt-8 reveal">
          <h2 className="mb-4 text-2xl font-semibold">Questions</h2>
          <div className="max-w-2xl space-y-2">
            {faqs.map(({ q, a }, i) => {
              const answerId = `faq-answer-${i}`;
              return (
                <div key={q} className="overflow-hidden rounded-xl border border-border bg-card/60">
                  <button
                    type="button"
                    aria-expanded={openFaq === i}
                    aria-controls={answerId}
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-sm font-semibold text-foreground transition-colors hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  >
                    <span className="min-w-0">{q}</span>
                    <span
                      className="flex-shrink-0 text-base text-muted-foreground"
                      style={{
                        transform: openFaq === i ? 'rotate(45deg)' : 'rotate(0deg)',
                        transition: 'transform 220ms var(--ease-out-quart)',
                      }}
                      aria-hidden="true"
                    >
                      +
                    </span>
                  </button>
                  <div
                    id={answerId}
                    role="region"
                    aria-labelledby={`faq-question-${i}`}
                    style={{
                      display: 'grid',
                      gridTemplateRows: openFaq === i ? '1fr' : '0fr',
                      transition: 'grid-template-rows 260ms var(--ease-out-quart)',
                    }}
                  >
                    <div className="overflow-hidden">
                      <div className="px-5 pb-4 text-sm leading-relaxed text-muted-foreground">{a}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Final CTA */}
        <section className="mt-10 rounded-3xl border border-border bg-card/40 p-8 text-center reveal">
          <h2 className="mb-3 text-2xl font-semibold md:text-3xl">Stop missing bookings today.</h2>
          <p className="mx-auto mb-6 max-w-md text-muted-foreground">
            Message us on WhatsApp. We&apos;ll have you set up and taking bookings the same day. No upfront cost. Cancel anytime.
          </p>
          <a
            href={whatsappHref}
            target="_blank"
            rel="noreferrer"
            className={cn(
              buttonVariants({ variant: 'default', size: 'lg' }),
              'w-full justify-center px-8 text-base font-semibold transition-transform duration-150 hover:scale-[1.02] hover:opacity-100 active:scale-[0.97] sm:w-auto',
            )}
          >
            Get started on WhatsApp
          </a>
          <div className="mt-4 text-xs text-muted-foreground">£39.99/month · Free until first 5 bookings · No contracts</div>
        </section>

      </main>

      {/* Sticky mobile CTA — appears once the hero CTA scrolls off screen, hidden on md+ */}
      <div
        className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background px-4 pb-4 pt-3 md:hidden"
        style={{
          transform: showStickyCta ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 300ms var(--ease-out-quart)',
        }}
        aria-hidden={!showStickyCta}
      >
        <a
          href={whatsappHref}
          target="_blank"
          rel="noreferrer"
          tabIndex={showStickyCta ? 0 : -1}
          className={cn(
            buttonVariants({ variant: 'default', size: 'lg' }),
            'w-full justify-center font-semibold',
          )}
        >
          Get started on WhatsApp
        </a>
      </div>
    </>
  );
}
