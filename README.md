# elbstrom-elektrotechnik.de

Production source code of [elbstromelektrotechnik.de](https://elbstromelektrotechnik.de) — a business website built with **Next.js 15 App Router** and **TypeScript**.

This repository showcases three self-contained, production-ready patterns extracted from the live project.

---

## Patterns

### 1. Secure Contact Form API
`src/app/api/contact/route.ts`

A hardened Next.js API Route that processes contact form submissions and delivers them via SMTP.

**Security**
- IP-based rate limiting — 5 requests/hour per IP (in-memory; designed to swap for Upstash Redis at scale)
- Honeypot field — hidden input silently rejects bots without a CAPTCHA
- Header injection prevention — CR/LF/Tab stripped from all header values before they touch Nodemailer
- Phone number sanitisation — allowlist of valid characters only
- Field-length enforcement & email format validation server-side

**Email**
- Admin notification + auto-reply to the sender (dual-email flow)
- Responsive HTML templates built with inline styles for broad mail-client compatibility
- SMTP via Nodemailer with exponential-backoff retry — handles Vercel cold-start DNS flakiness

---

### 2. Dynamic Business Hours Badge
`src/components/ReachabilityBadge.tsx`

A `"use client"` React component that renders an availability indicator only during active business hours (Mon–Fri, 08:00–17:00).

- Evaluated on the client to avoid SSR/timezone mismatch
- Returns `null` outside hours — no DOM footprint, no layout shift
- Drop-in: works inside any server or client component

---

### 3. SEO-Optimised Root Layout
`src/app/layout.tsx`

Demonstrates the full Next.js 15 App Router metadata stack alongside structured data.

- **`next/font`** — zero layout-shift, self-hosted Google Fonts
- **Metadata API** — title templates, OpenGraph, Twitter Cards, robots directives, canonical URLs, favicon, Apple touch icon, Web Manifest
- **JSON-LD (Schema.org)** — `LocalBusiness` structured data injected into `<head>` for Google rich results

---

## Stack

| | |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript 5 |
| Styling | CSS Modules + global CSS |
| Email | Nodemailer 7 |
| Deployment | Vercel |

## Environment variables

```env
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=hello@example.com
SMTP_PASS=your-password
CONTACT_TO=admin@example.com
NEXT_PUBLIC_SITE_URL=https://example.com
```

## Release

See [v1.0.0](https://github.com/farukvrl/elbstrom-elektrotechnik-de/releases/tag/v1.0.0) for the full feature overview.
