# Next.js Showcase

A collection of production-ready Next.js patterns from a real-world client project.
Built with **Next.js 15 App Router**, **TypeScript**, and **Nodemailer**.

---

## What's inside

### `src/app/api/contact/route.ts` — Secure Contact Form API

A hardened API route that handles contact form submissions end-to-end.

**Security measures:**
- **IP-based rate limiting** — max 5 submissions/hour per IP (in-memory; swap for Upstash Redis at scale)
- **Honeypot field** — hidden field silently rejects bots without triggering captchas
- **Header injection prevention** — all user input is stripped of CR/LF/Tab before entering email headers
- **Phone number sanitisation** — only digits, spaces, `+`, `-`, `(`, `)` are allowed
- **Field-length validation** — enforced both client- and server-side
- **Email format check** — lightweight regex guard before hitting the SMTP server

**Email features:**
- Dual-email flow: admin notification + auto-reply to the sender
- Responsive HTML email templates using inline styles (broad mail-client support)
- SMTP via Nodemailer with **exponential-backoff retry** (handles Vercel cold-start DNS delays)
- STARTTLS (port 587) with `requireTLS: true`

---

### `src/components/ReachabilityBadge.tsx` — Dynamic Business Hours Badge

A `"use client"` React component that renders an availability badge **only during business hours** (Mon–Fri 08:00–17:00), evaluated on the client to avoid SSR/timezone mismatch.

- Uses `useEffect` + `useState` for safe hydration
- Returns `null` outside of hours — no DOM footprint when not needed

---

### `src/app/layout.tsx` — SEO-Optimised Root Layout

Demonstrates the full Next.js 15 App Router metadata setup:

- **`next/font`** — zero layout-shift Google Fonts (self-hosted by Next.js)
- **OpenGraph + Twitter Cards** — complete social sharing metadata
- **Robots directives** — fine-grained `googleBot` control
- **Icons + Web Manifest** — favicon, Apple touch icon, `site.webmanifest`
- **JSON-LD (Schema.org)** — `LocalBusiness` structured data injected into `<head>` for rich Google results

---

## Stack

| Tool | Version |
|---|---|
| Next.js | 15 (App Router) |
| React | 19 |
| TypeScript | 5 |
| Nodemailer | 7 |

## Environment variables

```env
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=hello@example.com
SMTP_PASS=your-smtp-password
CONTACT_TO=admin@example.com
NEXT_PUBLIC_SITE_URL=https://example.com
```
