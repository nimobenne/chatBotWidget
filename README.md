# Multi-Tenant AI Receptionist Widget (Next.js)

Production-ready MVP for an embeddable AI receptionist chat widget + backend.

## Features
- Multi-tenant via `businessId`.
- Embeddable widget script at `/widget.js`.
- Demo route at `/demo?biz=demo_barber`.
- Chat backend at `/api/chat` with:
  - tenant config loading
  - per-business CORS allowlist
  - input validation + sanitization
  - in-memory rate limiting (dev-safe baseline)
  - OpenAI Responses API with tool-calling for availability and booking
- File-based JSON store by default, with a DAL interface ready for Postgres implementation.
- Basic admin UI at `/admin` with optional password protection.

## Local setup
1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy env file:
   ```bash
   cp .env.example .env.local
   ```
3. Set required env var:
   - `OPENAI_API_KEY` (**required**)
4. Optional:
   - `ADMIN_PASSWORD` (enables and protects admin API routes)
5. Start dev server:
   ```bash
   npm run dev
   ```
6. Open:
   - `http://localhost:3000/demo?biz=demo_barber`

## Embed on any website
```html
<script
  src="https://YOUR_DOMAIN/widget.js"
  data-business="demo_barber"
  data-position="bottom-right"
  data-accent="#111827"
></script>
```

## Important embed behavior
- The widget now posts chat requests to the same origin that serves `widget.js` (not the host page origin).
- For cross-site embeds, add hostnames (or wildcard patterns like `*.vercel.app`) to each business `allowedDomains`.

## Notes on data layer
- JSON files under `/data` are used for local/dev.
- To move to Postgres (Neon/Supabase), implement `DataStore` in `lib/store.ts` and set `DATA_STORE=postgres`.

## Security notes
- API key is server-only; never sent to browser.
- `/api/chat` enforces per-business domain allowlist (Origin host must match `allowedDomains`).
- Rate limiting is in-memory (for production use Upstash/Redis).
- Tenant isolation enforced by always loading tools/data scoped by `businessId`.

## Deployment on Vercel
- Add env vars in Project Settings:
  - `OPENAI_API_KEY` (required)
  - `ADMIN_PASSWORD` (optional)
  - Google Calendar vars (optional/future)
- Deploy as normal Next.js App Router project.

## Google Calendar feature flag (future)
- Calendar integration is designed behind env vars and can be added later:
  - if business-level Google credentials exist, call FreeBusy + create event
  - else fallback to internal availability/booking store


## Vercel 404 troubleshooting
If Vercel shows `404: NOT_FOUND`, check these first:

1. **Root Directory**
   - In Vercel Project Settings, set Root Directory to the folder containing `package.json` (this repo root).
2. **Framework Preset**
   - Ensure framework is **Next.js** (this repo includes `vercel.json` to force that).
3. **Build Output Misconfiguration**
   - Leave Output Directory empty for Next.js (do not set it to `public` or another folder).
4. **Redeploy after env vars**
   - Add env vars (`OPENAI_API_KEY` at minimum), then trigger a fresh deploy.
5. **Route checks**
   - `/` and `/demo?biz=demo_barber` should load.
   - `/widget.js` should return the embed script.

Quick verification commands after deploy:
```bash
curl -i https://YOUR_DOMAIN/
curl -i https://YOUR_DOMAIN/demo?biz=demo_barber
curl -i https://YOUR_DOMAIN/widget.js
```
