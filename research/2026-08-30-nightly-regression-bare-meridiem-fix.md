---
name: Nightly Regression — Bare-Meridiem Time ("PM") Fix (2026-08-30)
description: Root cause and two-layer fix for the nightly regression failure where real Gemini emitted Time "PM" (a meridiem with no clock time) and crashed createCalendarUrl()
type: bug
---

# Nightly Regression — Bare-Meridiem Time ("PM") Fix — 2026-08-30

## The failure

The nightly parsing regression test (Cloudflare Cron `0 3 * * *`, ran ~2026-08-30
03:00 UTC against the **deployed** Worker + **real** Gemini) failed on the
text-only sample:

> **Text-only newsletter (Pinecrest Elementary sample)**
> → `createCalendarUrl() returned error for event "4th/5th Grade Soccer Game vs Cedar Valley": Could not parse time "PM". Please use format like "3:00pm" or "3:00am to 5:00pm"`

The event's `Time` field came through from Gemini as the bare string `"PM"` — a
meridiem with no clock time.

The relevant lines of the Pinecrest sample (`worker/src/regression-samples.ts`,
`TEXT_SAMPLE.body`):

> "In sports news the 4th/5th grade soccer team has their first home game next
> Tuesday against Cedar Valley, everyone's welcome to come cheer them on, **I
> don't have the exact kickoff time locked down yet but it's usually right after
> school lets out.**"

No clock time anywhere — but a strong afterschool / PM cue ("right after school
lets out").

## Root cause

**Category (a): the Gemini prompt change**, with a missing backstop in
`resolveEventTimes()` as a contributing factor.

The AM/PM-inference feature (commits `a30c31d`, `f46eac9`) added this to the
`Time` field instruction in `worker/src/gemini.ts`:

> "If a time is written without am/pm (e.g. "3:30", "6 o'clock", "dinner at 6")
> but the surrounding text makes the meaning unmistakable, **add the correct
> am/pm to this value**. Use cues like "afterschool", "pickup", "dismissal" …
> (PM) …"

For the soccer game, real Gemini saw the unmistakable PM cue but **no clock
time**, and applied "add the correct am/pm to this value" to a value that did not
exist — producing `Time: "PM"`.

Downstream, nothing caught it:

1. **`resolveEventTimes()`** (`calendar-utils.ts`) checks
   `if (MERIDIEM_RE.test(time))` — `MERIDIEM_RE = /(a\.?m\.?|p\.?m\.?)/i` matches
   `"PM"`, so a lone meridiem was mistaken for an "explicit am/pm already
   present" time and passed straight through untouched (`Time` stays `"PM"`,
   `TimeConfidence` = `high`). Even the production path, which *does* call
   `resolveEventTimes()`, would not have caught this.
2. **The nightly path doesn't even call `resolveEventTimes()`** —
   `regression-test.ts` `runOneCase()` calls `callGeminiVisionAI()` then feeds
   the raw Gemini `Time` straight into `createCalendarUrl()`.
3. **`createCalendarUrl()`** calls `parseTime(event.Time || '')`.
   **`parseTime("PM")`** falls through every branch (range regex needs digits,
   single-time regex needs digits, bare-time/bare-range regexes need digits) and
   hits the final `return { error: \`Could not parse time "${timeStr}"…\` }`.
4. `createCalendarUrl()` returns that error object; the nightly harness'
   `validateCalendarUrl()` formats it as the failure message above.

### Evidence

Real-Gemini reproduction was **not possible** — `worker/.dev.vars` contains only
the placeholder `GEMINI_API_KEY=your-gemini-api-key-here` (file last touched
2026-07-20; the real key lives only as a Cloudflare secret on the deployed
Worker). Confirmed instead by static execution of the actual shipped functions:

```
parseTime("PM")            => {"error":"Could not parse time \"PM\". Please use format like \"3:00pm\" or \"3:00am to 5:00pm\""}
parseTime(" pm ")          => {"error":"Could not parse time \" pm \". …"}
parseTime("AM")            => {"error":"Could not parse time \"AM\". …"}
MERIDIEM_RE.test("PM")     => true          // why resolveEventTimes let it pass
createCalendarUrl({Time:"PM", …}) => {"error":"Could not parse time \"PM\". …"}   // == the nightly failure
resolveEventTimes([{Time:"PM"}], {body:"right after school lets out"}) => Time still "PM", conf "high"
```

The `createCalendarUrl` error string is character-for-character the nightly
failure message.

## The fix (two layers)

### Layer 1 — prompt (`worker/src/gemini.ts`)

The `Time` bullet now states the value must **always** be a real clock time with
digits or an empty string, **never** a bare meridiem, and that a source with no
stated clock time means `Time = ""` / `TimeConfidence = "high"` (all-day) — do
not invent one, do not answer with just "am"/"pm".

```diff
-- Time: start and end time if mentioned, otherwise "". If a time is written without am/pm (e.g. "3:30", "6 o'clock", "dinner at 6") but the surrounding text makes the meaning unmistakable, add the correct am/pm to this value. Use cues like "afterschool", "pickup", "dismissal", "practice", "rehearsal", "dinner", "evening", "tonight", "after work" (PM) and "breakfast", "drop-off", "morning", "before school", "assembly" (AM). If the context does NOT make it clear, leave the time exactly as written with no am/pm — never guess blindly. Respect an explicit 24-hour time (e.g. "15:30") as written.
+- Time: the event's start (and end) clock time if one is actually stated, e.g. "3:30pm" or "3:30-5:00pm"; otherwise "". This value must ALWAYS be either a real clock time containing digits (e.g. "3:30", "3:30pm", "15:00", "3:30-5:00pm") or an empty string "" — it must NEVER be a bare "am"/"pm"/"AM"/"PM" and never a meridiem with no digits. If the source names no specific clock time — even if it clearly implies morning, afternoon or evening — set Time to "" and TimeConfidence to "high" (an all-day event); do not invent a time and do not answer with just "am" or "pm". Only when an actual clock time IS present but written without am/pm (e.g. "3:30", "6 o'clock", "dinner at 6"), and the surrounding text makes the meaning unmistakable, add the correct am/pm to that clock time. Use cues like "afterschool", "pickup", "dismissal", "practice", "rehearsal", "dinner", "evening", "tonight", "after work" (PM) and "breakfast", "drop-off", "morning", "before school", "assembly" (AM). If the context does NOT make it clear, leave the clock time exactly as written with no am/pm — never guess blindly. Respect an explicit 24-hour time (e.g. "15:30") as written.
```

### Layer 2 — defensive code (`worker/src/calendar-utils.ts`)

```diff
@@ parseTime()
 	if (!timeStr) return null;
 
+	// A lone meridiem — "PM", " am ", "p.m." — with no clock digits is NOT a time.
+	// … Treat it as "no time given" so callers fall back to an all-day event instead
+	// of hitting the hard "Could not parse time" error at the end of this function.
+	if (LONE_MERIDIEM_RE.test(timeStr)) return null;
+
 	// Check for range format (with explicit "to" or "-")

@@ near MERIDIEM_RE
 const MERIDIEM_RE = /(a\.?m\.?|p\.?m\.?)/i;
+
+// A string that is ONLY a meridiem ("PM", " am ", "p.m.") with no clock digits.
+// … MERIDIEM_RE alone can't do this job: it also (correctly) matches "3:30pm",
+// so the anchors here matter.
+const LONE_MERIDIEM_RE = /^\s*(a\.?m\.?|p\.?m\.?)\s*$/i;

@@ inferAmPm()
 	const raw = timeStr.trim();
 
+	// No digits at all — a bare "PM", or stray prose. There is nothing to attach a
+	// suffix to, so never synthesize a value (that is how a bare "PM" would have
+	// become the un-parseable "PMpm"). Bail before any rule runs.
+	if (!/\d/.test(raw)) return null;
+
 	// Already carries an explicit am/pm — nothing to infer.
 	if (MERIDIEM_RE.test(raw)) return null;

@@ resolveEventTimes() — top of the per-event loop, before the MERIDIEM_RE check
+		// Gemini sometimes returns a bare meridiem ("PM") as Time when the source
+		// implies an afternoon/evening event but names no clock time. That is not a
+		// time — normalise it to "no time" (all-day, high confidence) here …
+		if (LONE_MERIDIEM_RE.test(time)) {
+			event.Time = '';
+			event.TimeConfidence = 'high';
+			continue;
+		}
```

Genuine ambiguity is untouched: `parseTime("3:30")` / `parseTime("3-5")` still
return their "ambiguous, please specify am/pm" errors, and the AM/PM inference
rules R0–R5 (bare 1–6 → PM, `12:00` → noon, keyword rules, the `⏰ Time note` in
the Description) all still fire.

### Behaviour after the fix

```
parseTime("PM" | " pm " | "AM" | "p.m.")   => null            (no time → all-day)
parseTime("3:30")                          => {error: "…ambiguous…"}   (unchanged)
parseTime("3:30pm")                        => {start:"3:30pm", end:null} (unchanged)
inferAmPm("PM", {body:"afterschool pickup"}) => null           (never synthesizes)
createCalendarUrl({Title:"…Soccer…", Date:"Sep 1, 2026", Time:"PM"})
    => "https://www.google.com/calendar/render?action=TEMPLATE&text=…&dates=20260901/20260902&…"   (valid all-day URL, NO error)
resolveEventTimes([{Time:"PM"}], {body:"right after school lets out"})
    => Time "", TimeConfidence "high"
resolveEventTimes([{Time:"3:30"}], {body:"weekly chess club"})
    => Time "3:30pm"                                            (R3 unchanged)
```

## Tests

`worker/test/time-inference.spec.ts` — new `describe('bare meridiem as Time
("PM")…')` block, 6 tests: `parseTime` returns `null` for `PM` / ` pm ` / `AM` /
`p.m.` and still errors on `3:30`; `inferAmPm` never synthesizes from a
digit-less string; `resolveEventTimes` strips `"PM"` → `""` / high; a bare-`"PM"`
event yields a valid all-day `createCalendarUrl` (`dates=20260901/20260902`, no
error); and an end-to-end Pinecrest "soccer game, no clock time" case that passes
`checkCalendarUrlWellFormed()` — the exact well-formed-URL check the nightly
harness uses.

`worker/test/regression-test.spec.ts` — new case: when Gemini returns an event
with `Time: "PM"`, `worker.scheduled()` (the real nightly handler) completes with
**zero** failure emails and both samples logged `SUCCESS`. This is the closest
available stand-in for a real-Gemini regression mode (the suite mocks Gemini at
the `fetch` boundary).

| | Before | After |
|---|---|---|
| Test files | 4 passed | 4 passed |
| Tests | **93 passed** | **100 passed** (+7) |
| `tsc --noEmit` | 1 known pre-existing error (`src/test.ts:128`) | same 1 error, nothing new |

## Deploy

- Commit `7c881b0` on `main`, pushed to `git@github.com:iansagabaen/calendar-scout.git`.
- `deploy.yml` (push-triggered run **33354503553** + a `workflow_dispatch` run
  **33354507576**), both **success**.
  - `wrangler deploy`: `Total Upload: 179.16 KiB / gzip: 46.42 KiB`,
    `Uploaded calendar-scout-worker`, `Deployed calendar-scout-worker triggers`,
    `schedule: 0 3 * * *`.
  - New Version IDs: `7dd9e502-2a93-4061-aedb-eb4e9e579154` (push run) then
    `479d06af-f12a-4c53-b87f-f5be90628f00` (dispatch run, **currently live at
    100%**). Both are the same commit; both differ from the pre-fix
    `256bd256-…`.

## Step 8 — verification on the deployed Worker

There is **no on-demand path that runs the regression samples** on the deployed
Worker: `/admin/smoke-test` runs a fixed one-line sample with `forceModel`, not
the Pinecrest text; the Worker's `fetch` handler only routes `/admin/*` (the
`POST /test` handler in `src/test.ts` is not wired into `index.ts`); and a
Cron/`scheduled()` handler cannot be triggered on demand against a deployed
Worker. So verification is:

1. **Deployed Worker (new version `479d06af-…`) is live and healthy** —
   `GET https://calendar-scout-worker.iansagabaen.workers.dev/admin/smoke-test`
   (with `X-Admin-Secret`) →
   `{"ok":true,"eventCount":1,"tookMs":3055}`. The deployed code called real
   Gemini, parsed the JSON, and extracted an event. No-secret request → `401`.
2. **The nightly regression logic no longer fails on a bare-meridiem `Time`** —
   the new `regression-test.spec.ts` case runs the real
   `worker.scheduled()` → `runNightlyRegressionTest()` → `runOneCase()` →
   `createCalendarUrl()` path with Gemini returning `Time: "PM"`: **0 failure
   emails, both samples `SUCCESS`.**
3. **Static, on the deployed code path:** `createCalendarUrl({…, Time:"PM"})` now
   returns a valid all-day URL string, not `{error: "Could not parse time
   \"PM\""}`.

Final end-to-end confirmation is the next real 03:00 UTC nightly run against
real Gemini.

## Tooling added

`worker/scripts/repro-pinecrest.ts` — runs `REGRESSION_CASES` through
`callGeminiVisionAI()` + `createCalendarUrl()` exactly the way `runOneCase()`
does, dumps the raw `Time` / `TimeConfidence` / `TimeInferenceNote` for the
soccer event, and exits non-zero on any URL error. Reads `GEMINI_API_KEY` from
`worker/.dev.vars`; needs a real key there to run. Kept as the tool for
reproducing the next prompt regression locally.

## Follow-ups (not done here)

- `regression-test.ts` `runOneCase()` does not call `resolveEventTimes()`, so the
  nightly harness tests a slightly *stricter* path than production. Worth
  aligning so the nightly test exercises exactly what a real user gets.
- Consider a guarded real-Gemini test mode (env-flagged) so the Pinecrest sample
  can be asserted against the live model in CI, not just mocks.
