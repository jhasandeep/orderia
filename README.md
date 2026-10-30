# Orderia

One platform for **appointments, hotel stays, QR table ordering and payments**. Built for hotels, salons, parlours, clinics and restaurants. One business can switch on either or both features.

- `apps/api` — NestJS 11 + TypeORM (REST, Swagger at `/api/docs`)
- `apps/web` — Next.js 16 (App Router) + Tailwind

## Run it

```bash
npm install
cp apps/api/.env.example apps/api/.env      # set JWT_SECRET and APP_SECRET
cp apps/web/.env.example apps/web/.env.local
npm run seed -w apps/api                     # demo data
npm run start:dev -w apps/api                # http://localhost:4000/api/v1
npm run dev -w apps/web                      # http://localhost:3000
```

Demo logins (password `password123`): `owner@orderia.dev`, `manager@`, `reception@`, `kitchen@orderia.dev`.
Demo public pages: `/b/glow-salon`, `/b/rose-beauty-parlour`, `/b/city-care-clinic`, `/b/sea-view-hotel`, `/b/spice-hub`.

Tests: `npm test -w apps/api` (55 e2e/unit tests). Lint/build web: `npm run lint -w apps/web`, `npm run build -w apps/web`.

## Database
`DB_TYPE=sqljs` (default, a local file, good for trying it out) or `DB_TYPE=postgres` with `DATABASE_URL`. Tables are created automatically; add migrations before heavy production use.

## Roles
| Role | Can do |
|---|---|
| OWNER | everything, incl. payment settings and team |
| MANAGER | bookings, services, staff, menu, tables, payments |
| RECEPTION | bookings, reservations, record/confirm payments |
| PROVIDER | their own appointments |
| KITCHEN | kitchen board, mark dishes sold out |

Roles are per business, so one person can be owner of one place and kitchen staff at another.

## Features
- **Appointments**: services with duration, staff weekly hours + time off, slot engine (no double booking, "anyone available"), walk-in bookings.
- **Hotels**: room types with per-night price and room count, date-range availability.
- **QR dining**: each table has a secret QR link `/t/<token>`; guests browse the menu, order (prices are computed on the server) and track status; the kitchen board updates every 5 s. Table reservations pick the smallest fitting table.
- **Payments** (per business, money goes to the business):
  - **Cash**
  - **UPI QR**: `upi://` link + QR; guest enters the UTR; staff confirm in *Payments*
  - **Razorpay**: add key id/secret/webhook secret in *Settings*; secrets are AES-256-GCM encrypted with `APP_SECRET`. Webhook: `POST /api/v1/public/webhooks/razorpay/<businessId>` (`payment.captured`).
  - Optional advance % for bookings.

## Known limits (next steps)
No migrations yet, public pages are client-rendered (add SSR metadata for SEO), refunds are manual, no SMS/email notifications, Razorpay has only been tested against a fake gateway.
