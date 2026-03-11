import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

/**
 * Secure Contact Form API — Next.js App Router
 *
 * Features:
 *  - IP-based rate limiting (in-memory; swap for Upstash Redis in high-traffic scenarios)
 *  - Honeypot field for silent bot rejection
 *  - Header injection prevention on all user-supplied strings
 *  - Field-length validation & email format check
 *  - SMTP with exponential-backoff retry (handles cold-start DNS flakiness on Vercel)
 *  - Dual-email flow: admin notification + auto-reply to sender
 *  - HTML email templates (inline styles for broad mail-client support)
 *
 * Required env vars:
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, CONTACT_TO
 */

// ── Rate Limiting ────────────────────────────────────────────────────────────
const rateMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT  = 5;
const RATE_WINDOW = 60 * 60 * 1000; // 1 h

function isRateLimited(ip: string): boolean {
  const now   = Date.now();
  const entry = rateMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW });
    return false;
  }
  if (entry.count >= RATE_LIMIT) return true;
  entry.count++;
  return false;
}

// ── Sanitisation helpers ─────────────────────────────────────────────────────

/** Strips CR/LF/Tab from header values to prevent header injection attacks. */
function sanitizeHeader(s: string): string {
  return s.replace(/[\r\n\t]/g, " ").trim();
}

/** Allows only characters valid in phone numbers. */
function sanitizePhone(s: string): string {
  return s.replace(/[^\d\s+\-().]/g, "").trim();
}

const MAX_LENGTHS = {
  firstName: 50,
  lastName:  50,
  email:     254,
  phone:     30,
  subject:   100,
  message:   3000,
};

// ── Route handler ────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    // 1. Content-Type guard
    const ct = req.headers.get("content-type") ?? "";
    if (!ct.includes("application/json")) {
      return NextResponse.json({ ok: false, error: "Bad request." }, { status: 400 });
    }

    // 2. Rate limiting
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
      req.headers.get("x-real-ip") ??
      "unknown";
    if (isRateLimited(ip)) {
      return NextResponse.json(
        { ok: false, error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    // 3. Parse JSON safely
    let rawBody: Record<string, unknown>;
    try {
      const parsed = await req.json();
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        return NextResponse.json({ ok: false, error: "Bad request." }, { status: 400 });
      }
      rawBody = parsed as Record<string, unknown>;
    } catch {
      return NextResponse.json({ ok: false, error: "Bad request." }, { status: 400 });
    }

    // 4. Honeypot — bots fill hidden fields, real users never do
    if (rawBody.website) {
      return NextResponse.json({ ok: true }); // silent reject
    }

    // 5. Read & sanitise fields
    const firstName = sanitizeHeader(String(rawBody.firstName ?? ""));
    const lastName  = sanitizeHeader(String(rawBody.lastName  ?? ""));
    const email     = sanitizeHeader(String(rawBody.email     ?? ""));
    const phone     = rawBody.phone   ? sanitizePhone(String(rawBody.phone))          : undefined;
    const subject   = rawBody.subject ? sanitizeHeader(String(rawBody.subject))       : undefined;
    const message   = String(rawBody.message ?? "").replace(/\r\n/g, "\n").trim();

    // 6. Required fields
    if (!firstName || !lastName || !email || !message) {
      return NextResponse.json(
        { ok: false, error: "Please fill in all required fields." },
        { status: 400 }
      );
    }

    // 7. Length checks
    if (
      firstName.length > MAX_LENGTHS.firstName ||
      lastName.length  > MAX_LENGTHS.lastName  ||
      email.length     > MAX_LENGTHS.email     ||
      (phone   && phone.length   > MAX_LENGTHS.phone)   ||
      (subject && subject.length > MAX_LENGTHS.subject) ||
      message.length   > MAX_LENGTHS.message
    ) {
      return NextResponse.json(
        { ok: false, error: "One or more fields exceed the maximum length." },
        { status: 400 }
      );
    }

    // 8. Basic email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { ok: false, error: "Please enter a valid email address." },
        { status: 400 }
      );
    }

    // ── SMTP setup ──────────────────────────────────────────────────────────
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    const to       = process.env.CONTACT_TO;

    if (!smtpUser || !smtpPass || !to) {
      console.error("Missing SMTP env vars.");
      return NextResponse.json(
        { ok: false, error: "Mail server is not configured." },
        { status: 500 }
      );
    }

    const transporter = nodemailer.createTransport({
      host:               process.env.SMTP_HOST ?? "smtp.example.com",
      port:               Number(process.env.SMTP_PORT) || 587,
      secure:             false,  // STARTTLS
      requireTLS:         true,
      auth:               { user: smtpUser, pass: smtpPass },
      connectionTimeout:  10_000,
      greetingTimeout:    10_000,
      socketTimeout:      15_000,
    });

    // Retry with exponential back-off — useful for Vercel cold-start DNS delays
    async function sendWithRetry(
      options: Parameters<typeof transporter.sendMail>[0],
      retries = 2
    ) {
      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          return await transporter.sendMail(options);
        } catch (err) {
          if (attempt === retries) throw err;
          console.warn(`SMTP attempt ${attempt + 1} failed, retrying…`);
          await new Promise((r) => setTimeout(r, 1_000 * (attempt + 1)));
        }
      }
    }

    // ── HTML helper ─────────────────────────────────────────────────────────
    const esc = (s: string) => s.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const f   = `'Helvetica Neue', Helvetica, Arial, sans-serif`;

    const detailRow = (label: string, value: string, href?: string) => `
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid #f0f0f0;">
          <span style="font-family:${f};font-size:12px;color:#999;display:block;margin-bottom:3px;">${label}</span>
          ${href
            ? `<a href="${href}" style="font-family:${f};font-size:15px;color:#111;text-decoration:none;font-weight:500;">${value}</a>`
            : `<span style="font-family:${f};font-size:15px;color:#111;font-weight:500;">${value}</span>`
          }
        </td>
      </tr>`;

    const emailSubject = subject?.trim()
      ? `Contact Form: ${subject.trim()}`
      : `Contact Form: New message from ${firstName} ${lastName}`;

    const replySubject = encodeURIComponent(
      `Re: ${subject?.trim() || `Message from ${firstName} ${lastName}`}`
    );

    // ── Admin notification email ─────────────────────────────────────────────
    const adminHtml = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>New Contact Request</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:${f};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f4f4;">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;">

  <tr>
    <td style="background:#fff;border-radius:12px;overflow:hidden;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr><td style="background:#0f172a;height:4px;font-size:0;">&nbsp;</td></tr>
      </table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="padding:36px 40px 0;">
            <span style="font-family:${f};font-size:13px;color:#999;">New submission</span>
            <h1 style="margin:12px 0 0;font-family:${f};font-size:22px;font-weight:700;color:#111;">${esc(firstName)} ${esc(lastName)}</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 40px 0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              ${detailRow("Email", esc(email), `mailto:${esc(email)}`)}
              ${phone?.trim() ? detailRow("Phone", esc(phone), `tel:${esc(phone)}`) : ""}
              ${subject?.trim() ? detailRow("Subject", esc(subject)) : ""}
              ${detailRow("Message", esc(message))}
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 40px 32px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="background:#111;border-radius:8px;">
                  <a href="mailto:${esc(email)}?subject=${replySubject}" style="display:inline-block;padding:13px 28px;font-family:${f};font-size:14px;font-weight:600;color:#fff;text-decoration:none;">Reply</a>
                </td>
                ${phone?.trim() ? `
                <td width="10"></td>
                <td style="border:1.5px solid #ddd;border-radius:8px;">
                  <a href="tel:${esc(phone)}" style="display:inline-block;padding:11px 24px;font-family:${f};font-size:14px;font-weight:600;color:#333;text-decoration:none;">Call</a>
                </td>` : ""}
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>

</table>
</td></tr>
</table>
</body>
</html>`;

    await sendWithRetry({
      from:    `"Website Contact" <${smtpUser}>`,
      replyTo: email,
      to,
      subject: emailSubject,
      text:    [
        `Name: ${firstName} ${lastName}`,
        `Email: ${email}`,
        phone?.trim()   ? `Phone: ${phone}`     : null,
        subject?.trim() ? `Subject: ${subject}` : null,
        ``,
        `Message:`,
        message,
      ].filter(Boolean).join("\n"),
      html: adminHtml,
    });

    // ── Auto-reply to sender (non-critical — failure doesn't abort the request) ──
    try {
      await sendWithRetry({
        from:    `"Your Company" <${smtpUser}>`,
        to:      email,
        subject: "We received your message",
        text:    `Hi ${firstName},\n\nThank you for reaching out! We will get back to you as soon as possible.\n\nBest regards\nYour Company`,
        html:    `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
</head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:${f};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f4f4;">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;">
  <tr>
    <td style="background:#fff;border-radius:12px;overflow:hidden;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr><td style="background:#0f172a;height:4px;font-size:0;">&nbsp;</td></tr>
      </table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="padding:36px 40px 32px;">
            <h1 style="margin:0 0 12px;font-family:${f};font-size:22px;font-weight:700;color:#111;">Thank you, ${esc(firstName)}!</h1>
            <p style="margin:0;font-family:${f};font-size:15px;color:#555;line-height:1.7;">
              We received your message and will get back to you as soon as possible.
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</td></tr>
</table>
</body>
</html>`,
      });
    } catch (err) {
      console.warn("Auto-reply failed (non-critical):", err instanceof Error ? err.message : err);
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    console.error("Contact API error:", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { ok: false, error: "An internal error occurred." },
      { status: 500 }
    );
  }
}
