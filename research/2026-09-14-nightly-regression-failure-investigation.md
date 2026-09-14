---
name: Nightly Regression Failure Investigation — Covington Under-Extraction (2026-09-14)
description: Root cause of the 2026-09-13 nightly self-test failure (Covington "Got Talent" sample returned 1 of 2 expected events), ruling out this week's deploys, and a case-level retry added to the nightly harness to absorb this Gemini flakiness mode
type: bug
---

# Nightly Regression Failure Investigation — 2026-09-14

## The ask

Ian: the nightly regression test failed once this week after a clean prior
week. Find out why before it happens twice.

## The failure email (verbatim)

Gmail thread `1a098b6915a8e456`, from `scout@sendtoschedule.com`, received
**2026-09-13T03:01:35Z** (the `0 3 * * *` cron run), subject "🌙 Calendar
Scout: nightly self-test FAILED (not a user email)":

> This is Calendar Scout's nightly automated regression test, not a real user's
> email failing. It runs 2026-09-13 against two fixed
> saved sample inputs (one text-only, one image/PDF-only) to catch silent parsing
> regressions before a real user hits them.
>
> ❌ 1 of the nightly test case(s) failed:
>
>   • Text-only quote-dense announcement (Covington "Got Talent" sample)
>     → Expected at least 2 event(s), got 1.
>
> What to do:
> 1. Check the Cloudflare Workers Logs (search "nightly_regression" or "scout_execution")
>    for the full error / response.
> 2. Try the same sample manually if needed: see src/regression-samples.ts for the
>    fixed inputs used.
> 3. This does NOT mean a real user was affected tonight. It means the underlying
>    Gemini extraction pipeline may be broken and the NEXT real user could be.
>
> 🔍 Execution log: https://dash.cloudflare.com/?to=/:account/workers/services/view/calendar-scout-worker/production/observability/logs
>
> Your Calendar Scout (nightly regression test)

Note: the email's boilerplate intro line ("two fixed saved sample inputs (one
text-only, one image/PDF-only)") is stale — it predates the quote-dense
sample added last week (now 3 cases: text-only, quote-dense, image/PDF-only).
Cosmetic only; not investigated further here, flagged for a future pass.

No other Calendar Scout error/alert emails appeared this week
(2026-09-08 through 2026-09-14) besides normal "Scout Report" successes
(2026-09-10 x2, 2026-09-11 "Covington Howler: 9/11/26" — a real user forward
of an actual Covington newsletter that successfully found 20 events, unrelated
to the synthetic nightly sample of the same school name).

## Cloudflare Workers logs

**Blocked**: `dash.cloudflare.com` required an interactive login (no active
session in the in-app Claude Browser), and entering credentials is outside
what this assistant will do. Per the task's fallback, relied on the email
content, static code analysis, and `gh run` history for corroborating
evidence instead.

## Root cause

**Category (b): Gemini flakiness**, not caused by this week's deploys.

### This week's deploys are NOT implicated

Two changes shipped this week, both live well before the 2026-09-13 03:01 UTC
run (last deploy was the `workflow_dispatch` run at 2026-09-10 21:24:19 UTC,
~30 hours earlier — no deploy overlapped the cron):

1. `be237e7` / `f86fd58` / `1588352` — unparseable/missing-date graceful
   fallback (`worker/src/calendar-utils.ts`, `email-templates.ts`,
   `types.ts`).
2. `93cd6ea` — button-label reword ("set the date" → "fix the date").

Neither touches `worker/src/gemini.ts` (the prompt, the model call, or the
retry/fallback chain) — its last change was `b7581e4` on 2026-09-02, over a
week before this failure. Neither touches
`QUOTE_DENSE_ANNOUNCEMENT_SAMPLE` or its `minExpectedEvents: 2` in
`worker/src/regression-samples.ts` — that sample and threshold were added the
week before (2026-09-02 Covington incident fix) and are untouched since. The
failure happens at `validateShape()` — before any date-fallback or
button-label code ever runs. **This week's deploys are not in play.**

### What actually happened

`worker/src/regression-samples.ts`'s `QUOTE_DENSE_ANNOUNCEMENT_SAMPLE` (the
real Covington "Got Talent" newsletter, added 2026-09-02 to guard against a
different failure — malformed JSON on quote-heavy text) states two shows:

> September 24th at 6:00 PM
>
> September 25th at 1:00 PM (Students only)

`minExpectedEvents: 2` (comment: "Two shows (Sep 24, Sep 25) are the hard
minimum"). The 2026-09-13 run's single Gemini call returned valid,
well-formed JSON — `extractJson()` parsed it fine, so this is not a repeat of
the 2026-09-02 malformed-JSON incident — but with only 1 event instead of 2,
almost certainly the two performances merged into one entry (a known LLM
behavior on near-duplicate same-title, same-location, different-date/time
event pairs). `worker/src/gemini.ts`'s `callGeminiVisionAI` has an existing
same-model retry (`callOneModel`, up to 2 attempts) — but **that retry only
fires on a 200 whose body won't parse as JSON at all** (`status: 'retryable'`).
A 200 with valid JSON that simply extracted the wrong number of events returns
`status: 'ok'` and is never retried. This is a gap distinct from the
2026-09-02 fix: that incident was about JSON *malformation*; this one is about
extraction *undercount* with syntactically clean JSON — the retry mechanism
built for the first doesn't cover the second.

No raw Gemini response for this exact run was recoverable (Cloudflare
dashboard login blocked, and there is no on-demand path to re-run the exact
historical nightly invocation against real Gemini). The classification above
rests on: (1) the exact error text `Expected at least 2 event(s), got 1`,
which `validateShape()` only emits for an under-count, not a parse failure;
(2) confirming via `git log -- worker/src/gemini.ts` that the extraction
prompt/pipeline has been unchanged since 2026-09-02; and (3) confirming no
deploy ran between 2026-09-10 21:24 UTC and the 2026-09-13 03:01 UTC cron
(`gh run list --workflow=deploy.yml`), so no code change coincided with the
failure.

## Fix: case-level retry in the nightly harness

Not a code defect to fix in the extraction pipeline itself (the model
behavior is inherently probabilistic, and forcing "always exactly 2 events for
two same-day shows" into the prompt/schema risks over-fitting to one sample).
Per the investigation brief's guidance for transient-with-a-resilience-gap:
added a retry **at the nightly-harness level only** (not the production email
path), since `gemini.ts`'s existing per-model retry demonstrably doesn't cover
this failure mode and duplicating it there isn't warranted for a low-volume
nightly check.

`worker/src/regression-test.ts`:

```diff
-async function runOneCase(env: Env, testCase: RegressionCase): Promise<CaseResult> {
+async function attemptOneCase(env: Env, testCase: RegressionCase): Promise<CaseResult> {
   const start = Date.now();
   const receivedDate = formatDateCleanly(new Date());
   try {
     const aiResponse = await callGeminiVisionAI(env.GEMINI_API_KEY, testCase.body || testCase.subject, testCase.mediaParts, receivedDate, {
       source: 'nightly_regression',
     });
     ... (unchanged validateShape / validateCalendarUrls logic) ...
   } catch (e: any) {
     ...
   }
 }
+
+/**
+ * Runs a case, retrying once (a second, fresh end-to-end Gemini call) before
+ * reporting a failure. gemini.ts's own per-model retry only fires when a 200
+ * response's body won't parse as JSON at all -- it has no visibility into
+ * "parsed fine, but validateShape() didn't like the result" (wrong event
+ * count, a merged/dropped event, a missing field). Retrying the whole case
+ * here catches that gap without touching the production email path or
+ * duplicating gemini.ts's own retry: a single flaky night that fails twice in
+ * a row and still alerts Ian is the actionable signal this test exists to
+ * give; a lone blip that clears on retry is not, and generates no alert email.
+ */
+async function runOneCase(env: Env, testCase: RegressionCase): Promise<CaseResult> {
+	const first = await attemptOneCase(env, testCase);
+	if (first.passed) return first;
+
+	const retry = await attemptOneCase(env, testCase);
+	if (retry.passed) {
+		console.log(
+			`nightly_regression: case "${testCase.id}" failed on attempt 1/2 (${first.reason}) but passed on retry -- treating as transient, not alerting.`
+		);
+		return retry;
+	}
+
+	return { ...retry, reason: `${retry.reason} (attempt 1/2 also failed: ${first.reason})` };
+}
```

This makes the "only alert Ian if it fails, not retry-and-still-fail" behavior
explicit: a lone under-extraction now self-heals silently (logged via
`console.log` with `nightly_regression` so it's still grep-able in Workers
Logs per the alert email's own instructions); two failures in a row still send
the alert, with both attempts' reasons in the email.

### Tests

`worker/test/regression-test.spec.ts` — 2 new cases:

- **"recovers silently when a sample fails shape validation once but passes on
  retry"** — mocks the quote-dense sample's first Gemini call returning 1
  merged event and the second call returning both shows correctly; asserts
  zero alert emails and a `"passed on retry"` log line.
- **"still alerts when a sample fails shape validation on both the initial
  attempt and the retry"** — mocks both calls under-extracting; asserts
  exactly 1 alert email containing `Expected at least 2 event(s), got 1`.

Also fixed a latent looseness in the pre-existing "runs every fixed sample…"
test: its mock returned only 2 events for any text-only call, which was
already below `TEXT_SAMPLE`'s `minExpectedEvents: 3` (silently, since that
test only asserted call counts, not pass/fail) — the new case-level retry
turned this into a visible extra fetch call and a failing assertion. Fixed by
returning 3 events (satisfies both text samples' thresholds) since this test's
purpose is call routing, not pass/fail behavior.

| | Before | After |
|---|---|---|
| Test files | 6 passed | 6 passed |
| Tests | **127 passed** | **129 passed** (+2) |
| `tsc --noEmit` | 1 known pre-existing error (`src/test.ts:128`) | same 1 error, nothing new |

## Deploy

- Commit `c15726d` on `main`, pushed to `git@github.com:iansagabaen/calendar-scout.git`.
- `deploy.yml` run `34866577471` (`workflow_dispatch`), **success** (also a
  parallel push-triggered run `34866567256` from the same push).
  - `wrangler deploy`: `Total Upload: 187.27 KiB / gzip: 48.96 KiB`,
    `Deployed calendar-scout-worker triggers`.
  - New Version ID: `d985e29e-d1c6-44f1-8c70-faf2b44a8d88`.
- Verified: `GET /admin/smoke-test` (with `X-Admin-Secret`) →
  `{"ok":true,"eventCount":1,"tookMs":2703}`.

## Follow-ups (not done here)

- The nightly failure email's intro boilerplate ("two fixed saved sample
  inputs") is stale since the quote-dense sample was added last week — should
  say "three" (or be generated from `REGRESSION_CASES.length` instead of
  hardcoded). Cosmetic, low priority.
- If the Covington sample keeps under-extracting even with the new retry
  (i.e. genuinely fails twice in a row more than rarely), worth revisiting
  whether the prompt needs an explicit rule for "two same-title events on
  different dates/times are two entries, not one" — but that's speculative
  until there's a second real occurrence to confirm the pattern.
