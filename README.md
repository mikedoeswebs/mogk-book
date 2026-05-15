# Goalkeeper Coaching Bookings

A self-service booking system for a small UK goalkeeper coaching outfit. Parents register, browse upcoming sessions, book a spot for their child, and pay through Stripe. Admin manages sessions, bookings, and cancellation requests from a single dashboard.

Built on **Next.js 16 (App Router)**, **Supabase** (Postgres + Auth), **Stripe Checkout**, and **SMTP2GO**. Designed to run on the Vercel free tier.

> v1 is intentionally unstyled. Theming and design polish happen as a separate phase once the system is functionally complete.

## Stack

| Layer | Choice |
|---|---|
| Hosting | Vercel (Hobby) |
| Framework | Next.js 16 App Router, React 19 |
| Database | Supabase Postgres (free, London region) |
| Auth | Supabase Auth (magic link) |
| Payments | Stripe Checkout |
| Email | SMTP2GO (HTTP API) |
| Cron | Vercel Cron |

## Local setup

### 1. Create a Supabase project

1. Sign up at [supabase.com](https://supabase.com) and create a new project (choose the London region).
2. In the SQL Editor, paste the contents of `db/schema.sql` and run it.
3. Then paste `db/policies.sql` and run that too.
4. If you have an existing project from before the credits/approval changes, also run `db/migrations/001_credits_and_approval.sql` once.
4. From **Project Settings → API**, copy:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public key` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role key` → `SUPABASE_SERVICE_ROLE_KEY` (keep this secret)
5. Under **Authentication → URL Configuration**, set:
   - Site URL: `http://localhost:3000` for development
   - Add the redirect URL: `http://localhost:3000/auth/callback`
6. Under **Authentication → Email Templates**, optionally customise the magic link email.

### 2. Set up Stripe

1. Sign up at [stripe.com](https://stripe.com) and switch to **Test mode** for development.
2. From **Developers → API keys**, copy:
   - Publishable key → `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
   - Secret key → `STRIPE_SECRET_KEY`
3. For local webhook testing, install the Stripe CLI:
   ```bash
   brew install stripe/stripe-cli/stripe
   stripe login
   stripe listen --forward-to localhost:3000/api/webhooks/stripe
   ```
   The CLI prints a webhook signing secret — copy it to `STRIPE_WEBHOOK_SECRET`.

### 3. Set up SMTP2GO

1. In your existing SMTP2GO account, go to **Settings → API Keys** and create a new key with **email send** permission.
2. Copy the key (starts with `api-...`) → `SMTP2GO_API_KEY`.
3. Set `EMAIL_FROM` to a verified sender on your account, e.g. `Goalkeeper Coaching <bookings@yourdomain.com>`.
4. Make sure the sending domain is verified in SMTP2GO (SPF + DKIM) before going live.

This integration uses SMTP2GO's HTTP API rather than SMTP — single `fetch` per email, no socket overhead on Vercel Functions.

### 4. Configure environment variables

```bash
cp .env.example .env.local
```

Fill in the values from steps 1–3. Set `ADMIN_EMAILS` to a comma-separated list of email addresses that should have admin access (the email you log in with).

### 5. Install and run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 6. First-time admin setup

1. Visit `/login`, enter your admin email, click the magic link.
2. Complete the onboarding form (parent profile).
3. Because your email is in `ADMIN_EMAILS`, an **Admin** link appears in the nav.
4. Go to **Admin → Sessions → New session** and create your first session.

## Smoke test (end-to-end)

1. Open a second browser (or incognito) and register a different email as a "parent".
2. Add a child.
3. Browse sessions, click the session you created.
4. Book it. Pay with Stripe test card `4242 4242 4242 4242` (any expiry/CVC).
5. Stripe CLI forwards the webhook → booking flips to "Confirmed".
6. Confirmation email lands (check SMTP2GO **Reports → Activity** if you don't see it).
7. Request cancellation from the bookings page.
8. Log in as admin → **Cancellations** → Approve. Stripe refund is issued; parent gets a refund email.
9. Try to book a session when capacity is full — should be blocked.
10. Try to access another parent's `/sessions/[id]` checkout flow — RLS plus server checks should block it.

## Cron

`/api/cron/reminders` sends 24-hour reminder emails. It runs daily at 09:00 UTC on Vercel — configured in `vercel.json`.

To trigger locally:
```bash
curl http://localhost:3000/api/cron/reminders
```

To protect the endpoint in production, set `CRON_SECRET` and Vercel will pass it as a Bearer token automatically.

## Deploying to Vercel

1. Push to GitHub.
2. Import the repo in Vercel.
3. Set the same environment variables as `.env.local`, but update `NEXT_PUBLIC_SITE_URL` to your production URL.
4. In Stripe, add the production webhook endpoint: `https://your-domain.vercel.app/api/webhooks/stripe`, selecting the `checkout.session.completed` and `checkout.session.expired` events. Copy the new signing secret into `STRIPE_WEBHOOK_SECRET` on Vercel.
5. In Supabase, add the production site URL and `/auth/callback` to the redirect allow-list.

## Project layout

```
app/
  page.tsx                      Public landing (redirects to /sessions if logged in)
  login/                        Magic-link sign in
  auth/callback/                Magic-link return
  onboarding/                   First-time parent profile
  (app)/                        Authenticated parent portal
    sessions/                   Browse + book
    bookings/                   My bookings + cancel request
    children/                   Manage children
  admin/                        Admin portal (gated by ADMIN_EMAILS)
    sessions/                   Session CRUD
    bookings/                   All bookings + CSV export
    cancellations/              Approve/reject queue
  api/
    webhooks/stripe/            Payment confirmation + expired-checkout cleanup
    cron/reminders/             24h reminder cron
db/
  schema.sql                    Tables, view, RPC, trigger
  policies.sql                  Row-Level Security
lib/
  supabase/                     server/client/admin/middleware
  stripe/                       Stripe client
  email/                        SMTP2GO client + plain HTML templates
  auth/                         require-user / require-parent / require-admin / isAdminEmail
  db/types.ts                   Shared TS types
```

## Booking rules

- **Bookings made ≥24h before session start** auto-confirm on payment.
- **Bookings made <24h before session start** are taken to payment but go into an admin approval queue. If approved, the booking confirms. If rejected, Stripe issues a full refund and any credit applied is returned.
- **Parent cancellations ≥24h before session start** convert the full booking value (cash + any credit applied) into account credit. No Stripe refund.
- **Parent cancellations <24h before session start** are recorded for coach information only. No credit, no refund.
- **Credit balances** auto-apply at the next booking, up to the session price. If credit fully covers a session, no Stripe charge is created.

## What's deferred to v2

- Theming and design polish
- Coach-facing dashboard
- WhatsApp or SMS notifications
- Recurring slot reservations / auto-rebook for regulars
- Waitlist with auto-promote on cancellation
- Block bookings / term passes / subscriptions
- Attendance marking and no-show tracking
- Statistics charts (v1 ships with summary numbers only)
- Sibling discounts and vouchers
- Multiple venues

## GDPR notes

This system stores children's personal data, which under UK GDPR demands care:

- The onboarding form has an explicit parental consent checkbox.
- The `parents` table only stores name, email, and (optional) phone.
- The `children` table stores name, DOB, position, and notes — keep this minimal.
- Hosting is in EU regions (Supabase London, Vercel Frankfurt by default).
- If you operate this commercially, register with the [ICO](https://ico.org.uk/) (currently ~£40/year for small businesses).
- Add a privacy policy and terms of service before going live with real users.
