---
name: AM/PM Inference Decisions (2026-08-26)
description: Final rules and rationale for how Calendar Scout resolves times written without am/pm
type: decision
---

# AM/PM Inference Decisions — 2026-08-26

## Context

A prior refactor (`5cac00b`, "Refactor: Calendar Scout date/time parsing for UTC
consistency and strict input validation") made time parsing strict: ambiguous
input such as `"3:30"` with no am/pm marker was hard-rejected rather than guessed.
Ian asked whether surrounding context could resolve these cases instead of
rejecting them outright, since the whole point of Calendar Scout is to save the
user manual data entry.

The goal for this session: use context to resolve bare times **when we can do so
with high confidence**, keep the hard "please specify am or pm" rejection only for
genuinely ambiguous cases, and never fabricate a time silently.

## Approach chosen — two layers

1. **Gemini extraction prompt** infers am/pm from the email prose and returns a
   `TimeConfidence` value plus an optional `TimeInferenceNote` describing any
   borderline reasoning it had to do.
2. **Deterministic keyword/hour rules** (`inferAmPm` in
   `worker/src/calendar-utils.ts`) act as the safety net for anything Gemini
   leaves bare. These rules are pure and testable and do not depend on the model.

## Final deterministic rule set (priority order)

- **R0 — explicit 24-hour time** (e.g. `"15:30"`, `"08:00"`): reformatted as-is,
  high confidence, no note. Nothing to infer.
- **R1 — bare `"12:00"` / `"12:xx"`**: resolved to noon (PM), high confidence, no
  note. Midnight events are not advertised in newsletters.
- **R2 — AM keywords in context** (breakfast, before school, drop-off, morning,
  assembly) **OR** a digit-adjacent `"am"` / `"a.m."` token: resolved to AM, high
  confidence.
- **R3 — bare time where every hour is 1–6** (key decision): resolved to PM, high
  confidence, **no warning**.
  Rationale: Calendar Scout's entire input domain is newsletters and
  announcements — school bulletins, community calendars, church bulletins, camp
  flyers. Nobody advertises a 1:00–6:00 **AM** event in a newsletter. Genuine
  late-night venues (bars, clubs, 24-hour diners) always write the suffix
  explicitly. Treating bare 1–6 as PM is correct essentially always for this
  corpus, so it does not warrant a warning.
- **R4 — evening keywords** (dinner, evening, tonight, after work): resolved to
  PM. Covers hours 7–11.
- **R5 — afterschool keywords** (afterschool, dismissal, pickup, practice,
  rehearsal): resolved to PM.
- **Otherwise** (bare 7–11 o'clock with no supporting keyword): stays ambiguous →
  falls through to the existing hard `⚠ please specify am or pm` error. No
  fabricated time is written.

## Warning vs. silent

- Every resolved bare time gets an **"(inferred from context)"** label in the
  report email so the user can see it was not literally stated.
- The `⚠` warning line is reserved for **Gemini's own borderline prose
  inferences** — i.e. when `TimeInferenceNote` is set. Deterministic resolutions
  (R0–R5) are treated as high-confidence and show **no** `⚠` warning.

## Justification travels with the event (Ian's requirement)

Whenever a bare time is resolved, a short **"⏰ Time note: ..."** sentence is
appended to the calendar event's **Description** field — not just the report
email. This puts the reasoning directly on the user's calendar so they can apply
their own judgment later. The note includes:

- the raw value as written in the email,
- the interpretation Calendar Scout applied,
- the reason (which rule / what keyword or hour range triggered it).

## Bug fixed in passing

The first-pass am-token regex `/\bam\b/` matched the ordinary English word "am"
in prose (e.g. "I am delighted to announce..."), which could flip a correct PM
time to AM. Tightened to `/\d\s?a\.?m\.?\b/` — it now only matches an "am" / "a.m."
token that is directly adjacent to a digit.

## Known open items

- The `/test` debug endpoint has no email body, so it stays strict — no context
  inference happens there. Parity with the real email path is not wired up.
- Pre-existing, unrelated `tsc` error in `worker/src/test.ts:128` (not introduced
  by this work).

## Commits

Nested `projects/calendar-scout` repo, branch `main`, **not pushed**, **NOT
deployed** as of writing:

| Hash | Summary |
|------|---------|
| `b1bfa2e` | Initial context-based AM/PM inference layer |
| `821fc86` | AM/PM inference research spec (2026-08-26) |
| `a236681` | Broadened rules: bare 1–6 o'clock and 12:00 resolve without warnings |
| `7f50786` | Carry time-inference justification in event Description; tighten am-token match |

93 tests passing.
