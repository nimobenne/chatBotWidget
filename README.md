# Multi-Tenant AI Receptionist Widget (Next.js)

Production-ready, embeddable AI receptionist with multi-tenant business support via `businessId` (business slug), Supabase persistence, optional Google Calendar booking, and owner handoff alerts.

## Required env vars (Vercel)
- `OPENAI_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only)

## Optional env vars
- `OPENAI_MODEL` (defaults to `gpt-4o-mini`)
- `ADMIN_PASSWORD`
- `RESEND_API_KEY`
- `ALERT_FROM_EMAIL`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`
- `GOOGLE_OAUTH_STATE_SECRET` (recommended for signed OAuth state)

> After adding/changing env vars on Vercel, **redeploy**.

## Local setup
```bash
npm install
cp .env.example .env.local
npm run dev
```

Then open:
- `http://localhost:3000/demo?biz=demo_barber`
- `http://localhost:3000/api/health`

## Widget embed
```html
<script
  src="https://YOUR_DOMAIN/widget.js"
  data-business="demo_barber"
  data-position="bottom-right"
  data-accent="#111827"
></script>
```

Business resolution order in widget:
1. `data-business`
2. `window.__AI_RECEPTIONIST_BUSINESS_ID__`
3. `?biz=` query param
4. `demo_barber` only for demo/dev

## API
- `POST /api/chat` body: `{ businessId, sessionId, message }`
- `GET /api/health` returns `{ ok, hasOpenAIKey, hasSupabase }`
- `GET /api/google/oauth/start?businessId=...`
- `GET /api/google/oauth/callback`

## Security
- Server-only OpenAI + Supabase credentials.
- Domain allowlist enforced per business.
- In-memory rate limiting included (upgrade to Redis/Upstash for production).
- Tenant isolation enforced by business slug lookup.


Admin API auth uses the `x-admin-password` header when `ADMIN_PASSWORD` is set.


When Google Calendar is connected for a business, available slots are filtered with Google FreeBusy; otherwise internal booking records are used.


Booking confirmations can optionally be emailed to customers when `RESEND_API_KEY` and `ALERT_FROM_EMAIL` are set.
