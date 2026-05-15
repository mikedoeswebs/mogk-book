# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## What this is

Self-service booking system for a UK goalkeeper coaching outfit. Parents register, browse sessions, book for their children, and pay via Stripe. Admin manages sessions, bookings, approvals, cancellations, and historic data imports from one dashboard.

Stack: Next.js 16 App Router (React 19), Supabase Postgres + Auth (magic link), Stripe Checkout, SMTP2GO HTTP API for email, Tailwind v4, deployed on Vercel (Hobby). UK GDPR — children's data, EU hosting, no public indexing.

## Commands

- `npm run dev` — local dev server on `:3000`
- `npm run build` — production build
- `npm run lint` — ESLint (`eslint-config-next` flat config)
- No test framework is configured.
- `stripe listen --forward-to localhost:3000/api/webhooks/stripe` — required for any local payment flow; the printed signing secret goes in `STRIPE_WEBHOOK_SECRET`.
- `curl http://localhost:3000/api/cron/reminders` / `…/api/cron/weekly` — trigger crons locally. `vercel.json` schedules them in production.

## Architecture

### Routing and auth boundaries

App Router with three groups:

- `app/(app)/` — authenticated parent portal (sessions, book, bookings, children, account). Every page calls `requireParent()` which forces login and a `parents` row (else `/onboarding`).
- `app/admin/` — admin portal, gated by `requireAdmin()` which checks the user's email against `ADMIN_EMAILS` (comma-separated env var).
- `app/api/` — Stripe webhook + two cron routes. Public `app/page.tsx`, `app/login`, `app/auth/callback`, `app/onboarding`, `app/legal/*`.

`proxy.ts` (Next.js 16's renamed `middleware.ts`) calls `updateSession()` on every non-asset request to refresh the Supabase auth cookie. **Do not rename it back to `middleware.ts`** — that's a deliberate Next 16 change and the wider Next API surface in this version differs from training data. Read `node_modules/next/dist/docs/` before assuming an API exists.

### Supabase client variants

Three factories in `lib/supabase/`, each with a specific use:

- `createSupabaseServerClient` (`server.ts`) — RLS-respecting, reads cookies via `next/headers`. Default for Server Components and Server Actions.
- `createSupabaseBrowserClient` (`client.ts`) — RLS-respecting, for client components only.
- `createSupabaseAdminClient` (`admin.ts`) — **service role, bypasses RLS**. Only inside the Stripe webhook, cron routes, or after an explicit `requireAdmin()` check.

`db/policies.sql` is the authoritative RLS layer. Server-side code must still re-check ownership before mutating — RLS is defence in depth, not the only gate.

### Booking rules (single source of truth)

`lib/booking/rules.ts` owns the time-window logic. Two windows, both 24h from `session.starts_at`:

- `bookingNeedsApproval` — bookings made <24h before start go to `awaiting_approval` (admin queue) instead of `active`. The Stripe webhook decides per booking.
- `cancellationIssuesCredit` — parent cancellations ≥24h convert the paid amount into account credit (no card refund). Inside the window, the cancellation is recorded for the coach but no credit/refund.

Credits are an append-only ledger (`credits` table, `parent_credit_balance` RPC); see `lib/booking/credits.ts`. `applyCredit` auto-deducts available credit at checkout up to the session price.

`lib/booking/fees.ts` calculates Stripe's 1.5% + 20p as a single transparent "booking fee" line, with `allocateFeePence` splitting that fee proportionally across bulk bookings so a single cancellation only forfeits its own share.

### Bulk-booking flow

`lib/booking/selection.ts` stores a parent's multi-session selection in a single HttpOnly cookie (`mo-selection`). Each item gets its own id so siblings can be booked into the same session. The cookie is **untrusted** — `app/(app)/book/` re-validates session ids, child ownership, capacity, and price at checkout, and the webhook does the same on confirmation.

### Money

All money is stored and computed in **pence as integers** (`price_pence`, `amount_pence`, `credit_applied_pence`, `booking_fee_pence`). `lib/format.ts → formatPence` renders to display strings. Never use floats.

### Email

`lib/email/client.ts` posts to SMTP2GO's HTTP API (no SMTP socket). All templates live in `lib/email/send.ts` as inline plain HTML — no template engine, hand-escaped via the local `escape()` helper. Add new email types here, not as separate files. Tone matches the existing copy (signed `Club MO/GK`).

### Database

`db/schema.sql` is the canonical schema; `db/policies.sql` the RLS. Incremental changes go in `db/migrations/NNN_*.sql` and must be applied manually in the Supabase SQL editor for existing projects. Migrations are append-only — don't rewrite an old one to fix something, add a new numbered file.

### Stripe webhook is load-bearing

`app/api/webhooks/stripe/route.ts` is what flips `pending_payment` → `active` or `awaiting_approval`, sends the confirmation/await-approval email (single vs batch), and reverses applied credit on `checkout.session.expired`. If a booking is stuck in `pending_payment`, the webhook is the first place to look — check the Stripe CLI is forwarding locally, or the Vercel webhook endpoint signing secret in production.

### Styling

Tailwind v4 with brand tokens in `app/globals.css` (`--bg`, `--accent` = `#ccff00`, etc.). Fonts: Montserrat (headings) and Noto Sans (body), loaded via `next/font/google` in `app/layout.tsx`. H1/H2 are uppercase by base style. The site sets `robots: index: false` — keep it unindexed until publicly launched.

## Conventions specific to this repo

- TypeScript path alias: `@/*` → repo root (e.g. `@/lib/supabase/server`).
- UK English in user-facing copy, emails, and comments (organise, cancellation, etc.). 24h windows are stated as "24 hours" in copy, not "1 day".
- Server Actions live next to the route they belong to (`app/.../actions.ts`), not in `lib/`.
- Prefer Server Components; only mark `'use client'` when interactivity genuinely demands it.
- `Booking.status` values are an enum-as-string (`pending_payment | awaiting_approval | active | cancelled | abandoned`) — see `lib/db/types.ts`. Match these exactly; the DB has a check constraint.
- `is_ghost` / `trialist_name` exist for admin-created bookings without a parent account (historic data, walk-ins). Real parent bookings always have `parent_id` and `child_id`.
