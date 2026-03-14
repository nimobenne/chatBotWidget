# WidgetAI — Project Context for Claude

## Project Overview

WidgetAI is an AI-powered WhatsApp booking assistant for UK barbershops and hair salons. It answers client questions, checks real Google Calendar availability, and confirms bookings automatically — 24/7, even when the shop is closed.

**Pricing**: £39.99/month, free until first 5 bookings
**Primary CTA**: Always WhatsApp — this is how barbershop owners communicate
**Stack**: Next.js 14 (App Router), TypeScript, Tailwind CSS, Supabase, OpenAI, Google Calendar API, Resend, Lucide React

---

## Design Context

### Users

**Primary**: Independent UK barbershop and hair salon owners. They are busy, skeptical, practical, and non-technical. They make decisions quickly and trust word-of-mouth. They read this page on their phone, often between clients. They don't care about technology — they care about not missing bookings. They're familiar with WhatsApp as a business tool and are comfortable with it as a CTA.

**Secondary**: Their clients, who interact with the chat widget embedded on the shop's website.

**Job to be done**: The owner wants confidence that this product will actually work in their shop, won't confuse their clients, and costs less than the bookings it captures. They need reassurance, not feature lists.

**Emotional goals**: Reassured. Understood. In control. Not sold to.

### Brand Personality

**Three words: Smart. Warm. Effortless.**

- **Smart** — the AI is genuinely intelligent, not a clunky chatbot. The product knows your calendar, speaks naturally to clients, and handles edge cases gracefully.
- **Warm** — this is a tool for people who work with their hands and build real relationships. It should never feel clinical, corporate, or cold.
- **Effortless** — setup is one hour. The owner doesn't have to learn anything. It just runs. The design should reflect that — nothing superfluous, nothing complicated.

### Aesthetic Direction

**Theme**: Forced dark mode. Deep warm charcoal background (`hsl(25 15% 6%)`), not cold navy.

**Accent colour**: Amber-gold (`hsl(34 68% 48%)`). Warm, craft, brass — references barbershop fixtures and warm lighting. Not emerald/teal (generic SaaS) and not blue (corporate).

**Typography**: Plus Jakarta Sans. Clean and modern without being sterile.

**Motion**: Smooth and confident. `ease-out-quart` (`cubic-bezier(0.25, 1, 0.5, 1)`) for all transitions. No bounce, no elastic, no decorative motion. Motion serves purpose — entrance, state change, feedback.

**Layout**: Editorial, not templated. Asymmetry is fine. No identical card grids. No hero metric layouts. No glassmorphism.

**Anti-references — never look like**:
- Generic AI startup (Notion, Linear, Vercel) — cold, minimalist, developer-focused
- Corporate enterprise software — grey, formal, dashboard-heavy
- Budget booking tools (Booksy, Fresha) — cluttered, discount-feeling, low trust
- Flashy over-designed — gradients for the sake of it, animated everything

### Design Principles

1. **One thing at a time** — every page, every section has one primary action. No competing CTAs. When in doubt, the answer is WhatsApp.

2. **Plain language first** — the audience is not technical. No jargon. "We add it to your website" not "paste a script tag". "Earnings" not "ROI". Write like you're explaining to a mate who runs a barbershop.

3. **Warmth through restraint** — the amber palette and warm charcoal do the emotional work. Don't pile on with decorative elements, gradient text, or glowing accents. The warmth comes from what's removed, not what's added.

4. **Confidence over cleverness** — the copy and design should feel assured. Short sentences. Active voice. No hedging. "Books the appointment." not "can help facilitate booking management."

5. **Barbershop, not startup** — every design decision should pass this test: would this look at home next to a barber's Instagram, or does it belong on Product Hunt? Choose the former.

### Colour Tokens

```css
--background:        hsl(25 15% 6%)    /* deep warm charcoal */
--foreground:        hsl(38 25% 90%)   /* warm off-white */
--card:              hsl(22 12% 10%)   /* warm dark surface */
--primary:           hsl(34 68% 48%)   /* amber-gold */
--primary-foreground:hsl(25 10% 8%)    /* near-black (text on amber) */
--secondary:         hsl(25 10% 14%)   /* warm dark slate */
--muted-foreground:  hsl(35 10% 55%)   /* warm mid-tone */
--border:            hsl(28 10% 20%)   /* warm border */
--ease-out-quart:    cubic-bezier(0.25, 1, 0.5, 1)
--ease-out-expo:     cubic-bezier(0.16, 1, 0.3, 1)
```

### Pages to Design (priority order)

1. **Widget UI** — the chat widget embedded on client websites. Needs to feel trustworthy and on-brand without clashing with arbitrary host site colours.
2. **Onboarding flow** — step-by-step setup for new barbershop owners after they message on WhatsApp.
3. **Owner dashboard** — bookings, earnings, and settings. Warm, clean, at-a-glance.
4. **Admin panel** — internal tool for managing businesses. Functional over beautiful, but consistent with the design system.

### Interaction Patterns

- **FAQ accordion**: `grid-template-rows` transition, `+` rotates to `×` via `ease-out-quart`
- **Buttons**: `hover:scale-[1.02] active:scale-[0.97]`, `transition-transform duration-150`
- **Scroll reveals**: `.reveal` + IntersectionObserver at `threshold: 0.1`, fires once
- **Step staggers**: `.step-item` CSS class, triggered by parent `.reveal.in-view`, 60/160/260ms delays
- **Marquee**: pauses on hover via `hover:[animation-play-state:paused]`

### Accessibility Baseline

- WCAG AA minimum
- `prefers-reduced-motion` handled globally in `globals.css`
- All interactive elements have `focus-visible` rings using `--ring` token
- `aria-expanded` + `aria-controls` on accordions
- `type="button"` on all non-submit buttons
- `min-w-0` on flex children to prevent overflow
