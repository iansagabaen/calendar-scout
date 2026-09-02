---
name: Covington "Got Talent" Processing Failure (2026-09-02)
description: Root cause and fix for the "I hit a snag." / "Couldn't process" failure a real user hit forwarding the [COVINGTON] Coming Soon.....Covington's Got Talent! (9/24 & 9/25) newsletter
type: bug
---

# Covington "Got Talent" Processing Failure — 2026-09-02

> STATUS: IN PROGRESS — this doc is being written incrementally as the investigation proceeds.

## The report

A real Calendar Scout user (Cindy Nakasuji, cnakasuji@gmail.com) forwarded a
school newsletter to `scout@sendtoschedule.com` on 2026-09-02 ~09:54 America/Los_Angeles
and got back a failure email:

- Subject: `Calendar Scout: Couldn't process "[COVINGTON] Coming Soon.....Covington's Got Talent! (9/24 & 9/25)"`
- Body: `I hit a snag.` + standard footer. No error detail shown to the user.

Cindy forwarded the Calendar Scout reply to Ian's wife, who forwarded it to Ian
(iansagabaen@gmail.com), thread id `1a063fb97298dae9`.

## The original email

Ian received his own copy of the same newsletter on 2026-08-24 (Gmail thread
`1a035c9e41857299`), sender `mailer@email-support.classroomparent.com`. Cindy's
forward body is virtually certain to be the same text. Verbatim:

**Subject:** `[COVINGTON] Coming Soon.....Covington's Got Talent! (9/24 & 9/25)`

**Body:**

```
The following message was sent by Covington PTA to the Covington
School

Replies to this message will go to Covington PTA

Coming soon....Covington's Got Talent! It was such a big hit last
year that we need to bring it back again! Covington's Got Talent
is our school wide talent show featuring the amazing talents of
our Covington Coyotes. The show is open to any students at all
grade levels interested in participating. Students will need to
"audition" their act, commit to a couple rehearsals including the
mandatory dress rehearsal before the big shows. There will be two
shows, one for our Covington families and one for students only.

Covington's Got Talent in the Covington Multi

September 24th at 6:00 PM

September 25th at 1:00 PM (Students only)

A MANDATORY dress rehearsal for all performers will take place
Friday, September 18 from 3:00 - 5:00 PM in the Multi.

More details:

* Any student can participate. Students are allowed to be in ONE
act - either as an individual or as part of group. Each act is
limited to 2 minutes maximum.
* The stage is not huge so all group sizes should be maximum
10-12 students.
* Anything goes! Playing a musical instrument, magic tricks,
singing, dancing, stand up comedy, acrobatics, juggling, etc.
However students must spend their allotted time on stage doing
something. A "talent" is not just standing there.
* Students will have access to use the sound system (for music),
mic, piano, table, chairs and stage lights. Any other props will
need to be provided by the performer.
* This is not a competition but a showcase of our talented
Covington Coyotes.
* "Auditions" are an opportunity for administration/staff/PTA
Executive Board to review acts to ensure they are appropriate for
Covington's Got Talent. They have the right to provide feedback
to student(s) and review again if needed to make sure all acts
reflect our Coyote Way.

Please SIGN UP HERE ( https://forms.gle/wXLwhvkNmf7ze21V7 ) or
click on the link below. The submission cutoff date is September
2nd.

Hope to see you all on stage!

Submission Link - https://forms.gle/wXLwhvkNmf7ze21V7

You can access your school's directory here:
https://covington.classroomparent.com/
...(ClassroomParent boilerplate / unsubscribe footer omitted)
```

This email contains **three unambiguous date+time events** (Sep 24 6:00 PM,
Sep 25 1:00 PM, Sep 18 dress rehearsal 3:00–5:00 PM) plus a "submission cutoff
date September 2nd". It should never have produced a bare failure.

## Where "I hit a snag." comes from

Grep: the string `'I hit a snag.'` appears exactly once, in
`worker/src/gemini.ts` — it is the **summary** returned by `callGeminiVisionAI()`
when the ENTIRE model fallback loop (`gemini-2.5-flash`, `gemini-2.0-flash-001`,
`gemini-2.0-flash-lite`) finishes without a single successful
`return JSON.parse(cleanJson)`:

```ts
return { events: [], summary: 'I hit a snag.' };
```

`worker/src/index.ts` then sees `aiResponse.events.length === 0`, takes the
`else` branch, logs `NO_EVENTS`, and calls `sendFallbackGuarded(..., aiResponse.summary, ...)`.
`buildFallbackEmail()` in `email-templates.ts` renders the subject
`Calendar Scout: Couldn't process "<subject>"` and the body just echoes the
summary text ("I hit a snag.").

### Consequence for the "which code is implicated" question

Because `events` was empty, the deterministic time/date pipeline
(`resolveEventTimes` → `inferAmPm` → `parseTime` → `createCalendarUrl`) — i.e.
everything touched by today's **bare-meridiem fix (`479d06af` / commit `7c881b0`)**
and the earlier **AM/PM-inference work** in `calendar-utils.ts` — **never ran**
for this email. Those `calendar-utils.ts` changes are NOT implicated.

The one part of today's deploy that CAN be implicated is the **prompt change in
`gemini.ts`** (same commit `7c881b0`), which materially lengthened and
complicated the Time-field instructions. Whether that is the cause depends on the
Cloudflare logs for the 09:54 execution — see next section (in progress).

## Cloudflare logs — the 09:54 execution

Worker Observability, account `0ac77d59…`, `calendar-scout-worker` production.
Single invocation, requestId `30c2e868a8701735708bec4601df1fa7`,
**Worker version `29f3fb76-fe6e-4702-ac68-424d3c92d9a0`** (the current active
deployment — one deploy *after* `479d06af`). Email: mailFrom `cnakasuji@gmail.com`,
rcptTo `forward@sendtoschedule.com`, rawSize 25477. Six log lines,
2026-09-02 09:53:59–09:54:00 PDT:

| # | ts (PDT) | line |
|---|----------|------|
| 1 | 09:53:59.821 | `gemini_usage` — model `gemini-2.5-flash`, promptTokens 3086, **candidatesTokens 807**, totalTokens 6543, hadMediaParts false |
| 2 | 09:53:59.821 | `AI Error: SyntaxError: Expected ',' or '}' after property value in JSON at position 642 (line 16 column 5)` |
| 3 | 09:53:59.919 | `gemini_error` — model `gemini-2.0-flash-001`, **status 404**: *"This model models/gemini-2.0-flash-001 is no longer available. Please update your code to use models/gemini-3.6-flash …"* |
| 4 | 09:54:00.004 | `gemini_error` — model `gemini-2.0-flash-lite`, **status 404**: *"This model models/gemini-2.0-flash-lite is no longer available. Please update your code to use models/gemini-3.5-flash-lite …"* |
| 5 | 09:54:00.004 | `scout_execution` — status **NO_EVENTS**, eventsFound 0, processingTimeMs 14633, email cnakasuji@gmail.com |
| 6 | 09:54:00.743 | `forward@sendtoschedule.com` (info) — outbound fallback ("I hit a snag.") email |

So all three models in the fallback chain failed:

1. **`gemini-2.5-flash` (primary): HTTP 200 but the body was not valid JSON.**
   `candidatesTokenCount` 807 is a complete, non-truncated completion, so this was
   a **malformed** payload, not a length cutoff — an unescaped character around
   line 16 / byte 642. The Covington email is unusually quote-dense (`"audition"`,
   `"Auditions"`, `"talent"`, `"Coming soon…."`, `'auditions'`); the overwhelmingly
   likely trigger is Gemini copying one of those quoted phrases verbatim into a
   string field (`DateContext` — "copied verbatim" — or `Description`) **without
   escaping the inner `"`**, which produces exactly `Expected ',' or '}' after
   property value`. `JSON.parse` throws → caught by `catch (e)` → `console.log('AI Error: …')` → loop continues.
2. **`gemini-2.0-flash-001` (fallback 2): HTTP 404 — Google has deprecated it.**
3. **`gemini-2.0-flash-lite` (fallback 3): HTTP 404 — Google has deprecated it.**

`callGeminiVisionAI` exhausts the loop → `return { events: [], summary: 'I hit a snag.' }`.

## Root cause

**Exact chain:** `worker/src/gemini.ts` → `callGeminiVisionAI()` model loop.
`MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash-001', 'gemini-2.0-flash-lite']`.

- Model 1 returns 200; `JSON.parse(cleanJson)` inside the `try` throws
  `SyntaxError` (malformed JSON from Gemini for this quote-heavy input). The
  `catch (e)` swallows it and the loop moves on.
- Models 2 and 3 are **both dead (404)** — Google retired `gemini-2.0-flash-001`
  and `gemini-2.0-flash-lite`. The fallback chain has been non-functional since
  that deprecation; nothing in the app noticed because a 404 just logs
  `gemini_error` and continues.
- Loop ends → `{ events: [], summary: 'I hit a snag.' }`.
- `index.ts` sees `events.length === 0` → **`else` branch** → `logExecution(… 'NO_EVENTS' …)`
  (note: NOT `ERROR`, so **no alert fired to Ian** — the bug was invisible until a
  user complained) → `sendFallbackGuarded(…, 'I hit a snag.', …)`.
- `buildFallbackEmail()` → subject `Calendar Scout: Couldn't process "<subject>"`,
  body `<p>I hit a snag.</p>`.

**Were today's AM/PM / bare-meridiem changes implicated? NO (not decisively).**
The bare-meridiem fix (`479d06af` / commit `7c881b0`) and the earlier AM/PM
inference work live in `calendar-utils.ts` (`resolveEventTimes` / `inferAmPm` /
`parseTime`), which only runs when `events.length > 0`. Here `events` was empty,
so that code never executed. The only file touched by today's deploy that sits in
the failure path is `gemini.ts` (same commit lengthened the Time-field prompt
instructions). A longer, more demanding prompt with verbatim-copy fields can
*raise the odds* of model 1 emitting slightly-malformed JSON, so it is a possible
*contributing* factor to step 1 — but it is not the decisive cause: the decisive
cause is the **dead fallback chain**, which predates today. Without the 404s,
model 2 or 3 would have parsed successfully and returned the three events.

## The fix

All in `worker/src/gemini.ts` (+ a 1-line `types.ts` field, + `index.ts`
alerting, + a nightly fixture). See the committed diff. Summary:

1. **Live model chain.** `MODELS` → `['gemini-2.5-flash', 'gemini-2.5-flash-lite']`.
   The two `gemini-2.0-flash-*` names that now 404 are removed; both replacements
   are current, non-deprecated 2.5-family models.
2. **Force valid JSON.** The Gemini request now sends
   `generationConfig: { responseMimeType: 'application/json' }`, which constrains
   decoding to syntactically valid JSON and directly prevents the
   unescaped-quote-in-`DateContext` failure that broke this email.
3. **Tolerant parse + one same-model retry.** `extractJson()` strips fences,
   pulls the outermost `{…}`, and removes trailing commas before `JSON.parse`. If
   a 200 response still won't parse, the same model is retried once (LLM
   nondeterminism usually clears it) before falling through.
4. **No more silent failure.** On total model-loop exhaustion `callGeminiVisionAI`
   returns `{ events: [], summary: <clear, actionable message>, error: <detail> }`.
   `index.ts` now logs that as `ERROR` and fires the standard error alert to Ian,
   and the user gets a message that says extraction failed and to retry —
   not the contentless "I hit a snag."
5. **Nightly guard.** A Covington "Got Talent" text sample is added to
   `REGRESSION_CASES` so the 03:00 UTC nightly test (real Gemini) covers this
   input shape from now on and would catch a repeat model deprecation.

## Tests — (in progress)

## Deploy + verification — (in progress)
