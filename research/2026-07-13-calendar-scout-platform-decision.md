# Calendar Scout: Platform Re-evaluation & Decision

**Date:** 2026-07-13
**Context:** Follow-up to `research/2026-07-12-session-digest-calendar-scout-observability.md`. That session diagnosed a silent Apps Script trigger failure (see `projects.md` Calendar Scout section for the open-bug note). This session used that incident as the prompt to re-evaluate whether Apps Script is still the right platform going forward.

## The ask

Ian wants Claude to be able to debug Calendar Scout "with confidence without any of my intervention." This is a step up from the 2026-07-12 observability work, which was explicitly about giving *Ian* visibility (Debug Sheet + plain-English error emails), not about Claude operating autonomously. Also asked to reconsider architecture for future-proofing and scale, without being GCP-locked ("don't feel you have to be committed to the GCP suite, i'm open to all ideas as long as it doesn't affect the UX i want to create and it's ultimately easy for you to manage and update").

## Correcting the premise

Ian initially thought this picked up a prior "future proofing" conversation. Searched the repo (`research/`, `MEMORY/`, `projects.md`, `docs/strategy.md`) and found no such conversation was ever recorded. The closest prior anchor is `research/2026-06-28-session-digest.md`, where Ian explicitly deferred the platform question: *"Don't commit to platform yet. Validate with Calendar Scout → Execute 1–2 more domains → Then architect as unified platform. De-risks the architecture."* No App Engine/Cloud Functions/Cloud Run comparison had ever been written down before this session, and no detailed end-user UX spec exists beyond the high-level "email-first, dashboard is an upsell not the MVP" philosophy. This session is genuinely new ground, not a continuation of a documented prior decision.

## Core framing: the UX is platform-independent

The end-user experience (forward an email → reply in ~1–2 min → one-tap add to calendar → no login, no dashboard, no learning curve) does not depend on what runs behind it. This decoupling is the reason the platform question can be answered purely on "what's easiest for Claude to operate and what scales," without touching the product experience at all.

## Why Apps Script is the actual problem

The 2026-07-12 trigger bug happened *because* Apps Script has no remote-debuggable surface:
- Triggers (the schedule that says "run this every minute") live only in the Apps Script browser UI — not in code, not visible to git, not inspectable via any API in the current setup.
- There is no CLI/API path to read execution logs from the terminal in the current configuration — diagnosing the bug required a Chrome subagent to manually open a Google Sheet and eyeball it.
- OAuth re-consent for new scopes (e.g. adding Google Sheets access) requires a human clicking "Allow" in a browser — no way to script around this.

This is the literal opposite of "debug with confidence without intervention."

## Three options evaluated

### Option 1 — Patch Apps Script in place (no migration)
- Add a real `installTrigger()` function to `Code.js` using `ScriptApp.newTrigger(...)`, so the run schedule becomes versioned code instead of tribal knowledge in a browser tab. Directly prevents this bug class from recurring silently.
- Bind the Apps Script project to a **standard GCP project** (not the hidden default one) to unlock `clasp logs` — streams real execution logs to the terminal, closing most of the remote-debugging gap for free.
- Cheapest, fastest, zero new infrastructure. Still fundamentally Google's walled garden — better visibility, but not built to be checked on by a program.

### Option 2 — Cloudflare Workers + Email Routing (chosen)
Cloudflare can receive email sent to the real domain (`sendtoschedule.com`) directly and hand it to a small program — no Gmail account involved at all. Everything (deploy, check logs, roll back a bad change, change settings) is one command from the terminal via Cloudflare's CLI tool (`wrangler`), never a browser click.
- **End-user UX:** identical — still forward-an-email-get-a-reply.
- **Claude-manageability:** best of the three — deploying a fix, reading an error, or rolling back a bad change are all one-line commands.
- **Cost:** free tier covers current scale; a few dollars/month even at real growth.
- **Setup cost:** a few hours of one-time work (new infra built from scratch) — confirmed this is normal-session-sized Claude usage, not a heavy compute hit, comparable to a typical active coding session.
- **Scale:** built to absorb traffic spikes without any manual intervention — part of the infrastructure a large share of the internet already runs on. A viral moment for a personal project wouldn't register as unusual load.

### Option 3 — Self-host on the home server (not chosen, but not rejected)
Ian is already planning to buy a 16GB M1/M2 MacBook Air for 24/7 headless duty (git remote, backups, Mylio photo management — see `research/2026-07-10-headless-home-server-hardware.md`), with SSH access already part of that plan. Calendar Scout could run there at effectively zero marginal cost.
- **End-user UX:** identical.
- **Claude-manageability:** highest ceiling of the three — full machine access via SSH, not just an API surface.
- **Bottleneck clarified:** not raw CPU speed (the actual AI processing already happens on Gemini's servers regardless of where the orchestration code runs) — the real constraint is the *home internet connection*: no redundancy if the connection or power drops, not built for many simultaneous visitors, potential ISP restrictions on running a public-facing service.
- **Viral scenario:** this option loses the most under a traffic spike — single machine, single home connection, no auto-scaling, no failover.

## Decision

**Cloudflare Workers (Option 2).** Reasoning that closed the decision:
- Wins on all three of Ian's stated criteria (doesn't touch end-user UX, easiest for Claude to manage, best under scale).
- The viral-growth scenario clarified the ranking further: it doesn't just fail to change the recommendation, it strengthens it — Apps Script has hard daily execution quotas that a real spike could hit, and a home server has no capacity to absorb a spike at all. Cloudflare is the only option of the three explicitly built for that scenario, and building on it now avoids an emergency migration mid-spike later.
- One caveat that holds regardless of platform: Gemini's free API tier caps at 60 requests/minute — a real spike would hit that ceiling before any hosting choice becomes the bottleneck. That's a separate cost decision (upgrade to Gemini's paid tier, ~$20–50/mo), not a hosting one.

## Sequencing (deliberately delayed)

Ian wants to set up his permanent home computer first — currently on vacation with just a laptop, wants Claude Code running on a stable home base before starting the Cloudflare migration, so the migration only has to happen once rather than being built on an unstable temporary setup. **Target: end of this week**, gated on home setup being done.

**Scope when it starts:** new Cloudflare account + domain email routing setup, port the existing email-parsing logic (`calendar-scout/Code.js`) over to a Cloudflare Worker, keep the current Apps Script version running in parallel as a fallback until the new version is proven out in production.

## Addendum (same session): does this hold up for a multi-product suite?

Ian asked whether Cloudflare still makes sense if this grows into the broader "FamilyOps Middleware" suite (HOA, Volunteer Scheduling, Landlord, Sports, Compliance verticals per the `projects.md` "Key insight" — replicating the email-in/structured-out pattern across 3–5 domains).

**Yes, and it strengthens the case for doing this now rather than later.** One Cloudflare account can host many independent Workers, each with its own domain/email routing, sharing the same CLI tooling and deployment pattern. The setup cost for Calendar Scout (a few hours) is mostly a one-time investment in account/tooling/pattern — each future vertical would cost a fraction of that to stand up, not a repeat of the full setup.

**One honest limit, deliberately not solved now:** Cloudflare gives a strong execution layer per product but no built-in shared platform layer (shared login, shared billing, one dashboard across verticals) — that would need to be added later (Cloudflare has the building blocks — D1 database, R2 storage — for when that's actually needed). Building that now would be the exact scope creep already flagged in `projects.md` under Calendar Scout's Backlog ("FamilyOps vision (broader middleware) is scope creep. Reject it. Keep Calendar Scout focused.") and in the 2026-06-28 decision to validate 1–2 more verticals before architecting a unified platform. Cloudflare keeps that door open cheaply without forcing the decision early.
