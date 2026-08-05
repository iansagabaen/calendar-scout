# Calendar Scout Worker

Cloudflare Workers port of `calendar-scout/Code.js` (Apps Script). See
`research/2026-07-13-calendar-scout-platform-decision.md` for why this migration
happened, and `research/2026-07-13-calendar-scout-ocr-stress-test.md` for parsing
reliability testing on the original.

**Status: built and tested locally. Not deployed. The Apps Script version is still
the live production system — untouched.**

## Architecture decisions

- **Inbound:** Cloudflare Email Routing's `email()` Worker export, replacing Gmail
  polling (`GmailApp.search()` on a timer). Event-driven instead of polled — no more
  `MAX_THREADS`/sort/one-per-run loop, the Worker just handles the message it's given.
- **MIME parsing:** [`postal-mime`](https://www.npmjs.com/package/postal-mime) parses
  the raw email stream Cloudflare hands the Worker into plain text + attachments
  (Gmail's API did this for free; Workers doesn't).
- **Outbound email:** [Resend](https://resend.com) HTTP API, not MailChannels.
  MailChannels' free Workers-only relay was shut down to new senders in 2024, so it's
  a dead end for a domain being set up fresh now. Resend has a free tier (3,000/mo,
  100/day) well above current volume and a plain fetch-based API. **Needs a verified
  sending domain (SPF/DKIM on sendtoschedule.com) before real sends work — that's a
  DNS change, deliberately not done as part of this task.**
- **State (PROCESSED_IDS / WELCOMED_USERS / USER_USAGE_COUNT):** Cloudflare KV,
  replacing `PropertiesService`. See `src/storage.ts` for the eventual-consistency
  caveat (KV has no atomic read-modify-write; a lock helper is included as a cheap
  safety net but isn't a strict distributed lock).
- **Execution log (was the Debug Sheet):** structured `console.log()` JSON, surfaced
  via Cloudflare Workers Logs / `wrangler tail`. This is a deliberate behavior change
  from the spreadsheet UI Ian is used to checking — see `src/debug-log.ts` for the
  reasoning and the documented fallback (Sheets API + service account) if the
  spreadsheet UX turns out to matter more than the CLI-visibility win.
- **Product analytics (new, per CLAUDE.md Section 9):** PostHog, via raw HTTP capture
  calls (`src/analytics.ts`) rather than the Node SDK, since Workers' request-scoped
  model doesn't fit the SDK's background-flush design. Tracks `email_received`,
  `event_extraction_succeeded`, `no_events_found`, `filtered_out_pre_ai`,
  `processing_error`, `ftux_welcome_sent`, `survey_email_sent` — distinct from the
  execution log above (product usage signal, not an operational trace).
- **Calendar links:** `src/calendar-utils.ts` ported near-verbatim; none of it
  actually depended on Apps Script.

## Circuit breaker (runaway-loop protection)

Added after the Apps Script version's incident where a bug (scanning the whole
personal inbox instead of a scoped address) caused it to auto-reply to an unrelated
email, triggering a reply loop with an external auto-responder — near-identical
"no events found" emails sent once a minute for 25+ minutes before being caught by
Ian noticing his inbox. Nothing detected that automatically. Email Routing's
architecture means the Worker can't have that *exact* bug (it only ever receives mail
addressed to its own dedicated address), but nothing stopped some *other* runaway
scenario (e.g. a bug causing repeated auto-replies to one sender, or a misconfigured
external system replying back and forth with the Worker) — so this closes that gap.

Three layers, implemented in `src/circuit-breaker.ts` and wired through every outbound
send in `src/email-sender.ts`:

1. **Same-recipient rate limit** — if the Worker would send more than 3 emails to the
   same recipient within a 10-minute window, it blocks that send instead of sending.
2. **Global send-rate cap** — if the Worker would send more than 100 emails total
   (any recipient) within a rolling 1-hour window, it blocks further sends.
3. **Pause flag (`SYSTEM_PAUSED` in KV)** — checked as the very first thing in the
   `email()` handler, before any parsing or processing. When either limit above trips,
   the breaker doesn't just skip the one offending email — it sets this flag, halting
   *all* processing until a human resumes it. A silently-dropped email is invisible; a
   fully paused system with an alert in Ian's inbox is not.

**Alerting:** whenever the pause flag gets set (automatically by a tripped breaker, or
manually via the endpoint below), an alert email goes to `MY_EMAIL` explaining exactly
which breaker tripped and why (e.g. "sent 4 emails to jane@example.com within 10
minutes — possible reply loop"). This alert path deliberately bypasses the breaker
itself, so a tripped breaker can't suppress the one email that tells Ian it tripped.

**Admin endpoints** — the Worker's `fetch()` handler exposes:

- `POST /admin/pause` — sets `SYSTEM_PAUSED=true` immediately (and sends a
  "manually paused" alert email).
- `POST /admin/resume` — clears `SYSTEM_PAUSED`, resuming normal processing.

Both require a shared secret, checked against either an `X-Admin-Secret` header or a
`?secret=` query param:

```bash
# Pause (e.g. from a phone browser in a pinch):
curl -X POST "https://calendar-scout-worker.<your-subdomain>.workers.dev/admin/pause?secret=YOUR_SECRET"

# Or with a header:
curl -X POST https://calendar-scout-worker.<your-subdomain>.workers.dev/admin/pause \
  -H "X-Admin-Secret: YOUR_SECRET"

# Resume:
curl -X POST "https://calendar-scout-worker.<your-subdomain>.workers.dev/admin/resume?secret=YOUR_SECRET"
```

The secret is set via `wrangler secret put ADMIN_SECRET` (see the punch list below) —
never hardcoded, never committed. If the secret isn't configured, the endpoints fail
closed (reject all requests) rather than silently allowing unauthenticated access.

## Local development

```bash
npm install
cp .dev.vars.example .dev.vars   # fill in real keys for local testing
npm run dev                       # wrangler dev --local
npm test                          # vitest, includes simulated email payloads
```

## Punch list before this could go live

1. **Cloudflare account** — Ian needs to sign in / create one (blocked this session,
   login-only screen encountered, no signup attempted per task boundaries).
2. **Create the real KV namespace** — `wrangler kv namespace create CALENDAR_SCOUT_KV`
   (and a preview namespace), then replace the placeholder IDs in `wrangler.jsonc`.
3. **Set secrets** — `wrangler secret put GEMINI_API_KEY`, `RESEND_API_KEY`,
   `POSTHOG_API_KEY`, `ADMIN_SECRET` (the last one protects the `/admin/pause` and
   `/admin/resume` circuit-breaker endpoints — see "Circuit breaker" section above;
   pick a long random string).
4. **Resend account + domain verification** — sign up, verify sendtoschedule.com
   (SPF/DKIM DNS records — a deliberate DNS change, not done here).
5. **PostHog project** — create one, grab the project API key.
6. **Cloudflare Email Routing DNS** — add sendtoschedule.com as a zone and configure
   MX/routing records pointing at this Worker (another deliberate DNS change, not
   done here — this is the actual cutover step).
7. **Decide the Debug Sheet question** — keep the new Workers Logs approach, or add
   the Sheets-API-with-service-account path back for continuity. Not decided, flagged
   as a judgment call in the final report.
8. **Decide on PostHog Surveys vs. the existing "Report an Error" Google Form** — the
   footer link is untouched and still works; whether to add PostHog Surveys on top is
   an open, deliberately-not-over-built question.
9. **Once live:** run both systems in parallel (Apps Script stays as fallback) until
   the Worker is proven out in production, per the original migration decision doc.
