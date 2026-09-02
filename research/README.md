# Calendar Scout — research index

Catalogue of everything in this folder: investigations, decision records, and
session digests for the Calendar Scout email worker and landing page.

*New research files must be added here in the same commit.*

> ⚠️ **Never paste live secrets into digests.** API tokens, keys, passwords, connection strings — redact them (`[REDACTED]`) or reference the secret's name only. Two live tokens leaked into these digests on 2026-08-26 and had to be scrubbed from git history. See `MEMORY/` in the monorepo root for the incident note.

| Date | File | Description |
|------|------|-------------|
| 2026-07-13 | [2026-07-13-calendar-scout-ocr-stress-test.md](2026-07-13-calendar-scout-ocr-stress-test.md) | Stress-test of the shipped image/PDF attachment parsing path in the Apps Script `Code.js`, grading Gemini vision output on messy real-world flyers against known ground truth. |
| 2026-07-13 | [2026-07-13-calendar-scout-platform-decision.md](2026-07-13-calendar-scout-platform-decision.md) | Re-evaluation of whether Apps Script is the right platform after a silent trigger failure; makes the case for an event-driven, remote-debuggable architecture. |
| 2026-07-21 | [2026-07-21-session-digest-calendar-scout-cloudflare-launch.md](2026-07-21-session-digest-calendar-scout-cloudflare-launch.md) | Session digest: memory-system cleanup, the runaway auto-reply loop incident, the Apps Script → Cloudflare Workers migration, and first-launch polish. |
| 2026-08-01 | [2026-08-01-session-digest-calendar-scout-deployment-subagent-compliance.md](2026-08-01-session-digest-calendar-scout-deployment-subagent-compliance.md) | Session digest: deploying three waiting commits to the Worker, credential-handling protocol, and a subagent-delegation compliance checkpoint. |
| 2026-08-04 | [2026-08-04-calendar-scout-email-redesign.md](2026-08-04-calendar-scout-email-redesign.md) | Implementation notes for the report-email layout rewrite: lead summary line, reordered sections, feedback folded in. |
| 2026-08-04 | [2026-08-04-calendar-scout-survey-integration-fix.md](2026-08-04-calendar-scout-survey-integration-fix.md) | Fix folding the after-5-uses survey into the report email and removing the internal "[Scout Survey Sent]" inbox notification. |
| 2026-08-04 | [2026-08-04-session-digest-calendar-scout-ux-polish.md](2026-08-04-session-digest-calendar-scout-ux-polish.md) | Session digest: landing-page analytics, timezone fix, email redesign, bug fixes, and marketing prep. |
| 2026-08-05 | [2026-08-05-session-digest-calendar-scout-github-ci.md](2026-08-05-session-digest-calendar-scout-github-ci.md) | Session digest: GitHub Actions CI/CD setup, email-prefix stripping fix, and consolidation of the project folder structure. |
| 2026-08-06 | [2026-08-06-calendar-scout-time-parsing-bugs.md](2026-08-06-calendar-scout-time-parsing-bugs.md) | Root-cause analysis of two time-parsing bugs (em-dash ranges, PM-after-both-times), written before the fixes landed. |
| 2026-08-06 | [2026-08-06-calendar-scout-bugs-fixed-summary.md](2026-08-06-calendar-scout-bugs-fixed-summary.md) | Summary of those two time-parsing bugs after they were found, fixed, and tested. |
| 2026-08-06 | [2026-08-06-session-digest-calendar-scout-deployment-success.md](2026-08-06-session-digest-calendar-scout-deployment-success.md) | Session digest: debugging Cloudflare deploy auth (Global API Key vs. scoped API Token) and the first successful live deployment. |
| 2026-08-07 | [2026-08-07-calendar-scout-test-endpoint-verification.md](2026-08-07-calendar-scout-test-endpoint-verification.md) | Verification of the new `POST /test` endpoint that echoes parsed times and a Google Calendar preview. |
| 2026-08-07 | [2026-08-07-calendar-scout-emtick-fix-verification-complete.md](2026-08-07-calendar-scout-emtick-fix-verification-complete.md) | End-to-end verification that the em-dash fix resolved the 2-hour shift, via the `/test` endpoint and a Calendar preview. |
| 2026-08-26 | [2026-08-26-am-pm-inference-research.txt](2026-08-26-am-pm-inference-research.txt) | Investigation into whether email context can resolve times written without am/pm (the spec that drove the feature). |
| 2026-08-26 | [2026-08-26-am-pm-inference-decisions.md](2026-08-26-am-pm-inference-decisions.md) | Final R0–R5 rule set and rationale for am/pm resolution, plus the Description-field justification decision. |
| 2026-08-30 | [2026-08-30-nightly-regression-bare-meridiem-fix.md](2026-08-30-nightly-regression-bare-meridiem-fix.md) | Root cause + two-layer fix (prompt + parser guards) for the nightly regression failure where real Gemini emitted `Time: "PM"` (a meridiem with no clock time) and crashed `createCalendarUrl()`. |
| 2026-09-02 | [2026-09-02-covington-got-talent-processing-failure.md](2026-09-02-covington-got-talent-processing-failure.md) | Root cause + fix for a real user's "Couldn't process / I hit a snag." failure: `gemini-2.5-flash` returned 200 with malformed JSON on a quote-dense newsletter and both fallback models had been 404'd by a Google deprecation. Fix: live model chain, `responseMimeType: application/json`, same-model retry, explicit error surfacing + Ian alert, and a permanent nightly regression sample. |
