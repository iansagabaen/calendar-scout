---
name: Unparseable / Missing Event Date — Graceful Fallback (2026-09-10)
description: A missing or unparseable event date no longer disables the "Add to Calendar" button. The card keeps its ⚠ warnings, swaps the red date error for an amber notice, and hands the user a working Google Calendar link defaulted to today with a prefilled title + context-rich description they just re-date before saving.
type: feature
---

# Unparseable / Missing Event Date — Graceful Fallback — 2026-09-10

## Trigger

Ian test-forwarded a Bay Area "Transit Month" commute newsletter. Two extracted
events — **Transit Month Webinar** and **Bike Classes Planning Survey** — named no
date anywhere in the source, so Gemini returned each with `Date: ""`,
`DateConfidence: "low"`, and a `DateNote`. Each card rendered:

- "Date not specified"
- ⚠ "No specific day or date range is mentioned for this ..." (the `DateNote`)
- ⚠ red: `Calendar date error: Could not parse date "". Please use format like "Aug 10, 2026"`
- a DISABLED grey button: **"Cannot add (date error)"**

Ian's call: a hard blocker isn't helpful — the user may still want the event on
their calendar. Warn them, but give them a working link defaulted to today with as
much prefilled context as possible, so they land in Google Calendar and just fix
the date.

## Current behaviour (before this change)

`worker/src/calendar-utils.ts` → `createCalendarUrl(event, _subject, _receivedDate)`:

- Line ~484: `startD = new Date(dateStr); if (isNaN(startD.getTime())) return { error: `Could not parse date "${dateStr}"...` };`
  — for `event.Date === ""`, `new Date("")` is `Invalid Date`, so this returns the
  `{ error }` object.
- Line ~474: a `parseDateRange` that returns `{ error }` is also returned as-is.

`worker/src/email-templates.ts` → `buildReportEmail`, per-event `forEach` (~line 106):

- `const calendarLinkOrError = createCalendarUrl(...)`.
  `calendarLink = typeof … === 'string' ? … : null`;
  `calendarError = typeof … === 'string' ? null : …error`.
- `errorWarning` (~line 132): when `calendarError` is set →
  `<div style="…color:#D84040…">⚠ Calendar date error: ${calendarError}</div>` (red).
- Button (~line 143 uncertain branch, ~line 159 normal branch):
  `calendarLink ? <a …>Add to Calendar[ (review first)]</a>
   : <div …background-color:#999…>Cannot add (date error)</div>` (disabled).

The two no-date events took the `isUncertain` (`DateConfidence === 'low'`) branch,
so they showed `Add to Calendar (review first)` logic → but `calendarLink` was
`null` → disabled `Cannot add (date error)` div.

## Target behaviour

For an event whose date is **missing or unparseable** (single date or range):

1. `createCalendarUrl` no longer returns `{ error }` for the date. It falls back
   to **today** (UTC-midnight, via `Date.UTC(...)` — the existing UTC-consistent
   path, no `setHours`) and continues building a real URL.
   - **date-fail + a parseable time present** → today at that time, +1h block
     (reuses the existing `parseTime` → `applyTime` (`setUTCHours`) path).
   - **date-fail + no usable time** (no time, or an ambiguous/`{error}` time) →
     **all-day today**: `dates=YYYYMMDD/YYYYMMDD+1`.
2. **Title** = `event.Title` unchanged; if empty/whitespace →
   `"Untitled event (from newsletter)"`.
3. **Description** (placeholder path only — the normal path is byte-for-byte
   unchanged) is composed, blank-line separated, in this order:
   - `event.Description` (existing summary) if present
   - `From the newsletter: "…"` — `event.DateContext` quote if present
   - `Location: …` if present
   - raw hints that were seen but couldn't be used: `Date text seen: "…"`
     (`event.Date` when non-empty but unparseable), `Date note: …`
     (`event.DateNote`), `Time text seen: "…"` (`event.Time`)
   - blank line, then the placeholder notice:
     `⚠️ Calendar Scout could not determine the date for this event. It has been
     set to {today, e.g. "Wednesday, Sep 10, 2026"} as a placeholder — please edit
     the date/time before saving.`
   - blank line, then the existing `(Added via sendtoschedule.com)` footer.
   All of it goes through `encodeURIComponent` (unchanged), so it's URL-safe.
4. **Card** (`email-templates.ts`): the disabled `Cannot add (date error)` button
   is replaced by a real enabled link (`Add to Calendar (set the date)`), because
   `createCalendarUrl` now returns a string. The ⚠ `DateNote` warning and the
   `DateContext` quote block are KEPT. A new **amber** notice
   (`color:#92600A` on `#FFFBF0` with a `#F5C542` left border — the existing
   "review first" treatment) replaces the red line, worded:
   `⚠ Date not found in the newsletter — the calendar link defaults to today; set
   the correct date before saving.`
5. **The one remaining true blocker**: `createCalendarUrl` returns `{ error }`
   (→ disabled button, red line kept) ONLY when the event has **no Title AND no
   Description AND no Date AND no Time** — nothing usable at all. The existing
   valid-date + ambiguous-**time** hard error is also preserved unchanged (that
   path still returns the `parseTime` `{error}` and disables the button, and the
   existing test that asserts the "Calendar date error … ambiguous" text still
   passes).

Preserved: valid-date events unchanged (normal + `review first` paths, description
format, `dates=` output); AM/PM inference `⏰ Time note`; bare-meridiem → all-day;
UTC/`setUTCHours` correctness.

## Functions / branches changed

| File | Change |
|---|---|
| `worker/src/calendar-utils.ts` | New exported `eventDateIsPlaceholder(event)` (missing/unparseable date predicate, shared by the URL builder and the template). New internal `todayUtcDate()`. `createCalendarUrl`: nothing-usable guard at top; date branch sets a `datePlaceholder` flag + today instead of returning `{error}`; ambiguous-time `{error}` only returned when NOT a placeholder; placeholder-only description composition block (normal path untouched). |
| `worker/src/email-templates.ts` | Per-event: compute `datePlaceholder = eventDateIsPlaceholder(event) && !!calendarLink`; new amber `placeholderNotice` div rendered in both card branches next to `errorWarning`; button label `Add to Calendar (set the date)` when `datePlaceholder`. Red `errorWarning` line untouched (still fires for the true blocker / ambiguous-time). |
| `worker/src/types.ts` | `ScoutEvent.DatePlaceholder?: boolean` doc field (not required by the logic — the predicate is derived — but reserved / documented). |
| `worker/src/regression-samples.ts` | New exported `NO_DATE_EVENTS_SAMPLE` (Transit Month Webinar + Bike Classes Planning Survey, "at Online", the visible quotes). Kept OUT of the live `REGRESSION_CASES` array (no extra nightly Gemini call / no `validateShape` empty-Date flake); asserted offline by the new spec. |
| `worker/test/unparseable-date.spec.ts` | New. Unit + integration coverage (see Tests). |

## Tests (planned)

- `createCalendarUrl`, `Date: ""`, no time → string URL, `dates=<today>/<today+1>`,
  `details=` has title + placeholder notice, no `error`.
- `createCalendarUrl`, `Date: ""`, `Time: "6:00pm"` → today at 18:00, +1h,
  `dates=…T180000/…T190000`.
- `createCalendarUrl`, unparseable non-empty `Date` ("sometime this fall") →
  placeholder today, `Date text seen: "sometime this fall"` in details.
- `createCalendarUrl`, genuine valid date → **unchanged** (regression: exact
  `dates=` + description format).
- `createCalendarUrl`, no Title/Desc/Date/Time → still `{ error }` (true blocker).
- `buildReportEmail` card for a placeholder-date event → enabled
  `Add to Calendar (set the date)` link, KEEPS the ⚠ `DateNote`, shows the amber
  notice, does NOT contain `Cannot add (date error)`.
- `buildReportEmail` for the no-Title/Desc/Date/Time event → still shows
  `Cannot add (date error)`.
- End-to-end (nightly-harness shape): `NO_DATE_EVENTS_SAMPLE` events →
  `resolveEventTimes` → `createCalendarUrl` → `checkCalendarUrlWellFormed` returns
  `null` (addable), never a bare blocker.
- Existing ambiguous-time test still passes (valid date + `Time: "8:30"` still
  renders "Calendar date error … ambiguous").

Suite before: **114 passed** (5 files). tsc before: only the known
`src/test.ts(128,4)` error.

## Visual proof

`worker/scripts/render-unparseable-date-preview.ts` renders the real
`buildReportEmail` output for three fabricated events →
`research/unparseable-date-card-preview.html`. Run (from `worker/`):

```
npx esbuild scripts/render-unparseable-date-preview.ts --bundle --platform=node --format=esm --outfile=/tmp/render.mjs && node /tmp/render.mjs
```

(the `src/` files use extensionless imports, so `node --experimental-strip-types`
needs the esbuild bundle step — same as `scripts/repro-pinecrest.ts`.)

Rendered result (screenshot was inline-only, not saved to disk):

- **Fall Bike Ride** (valid `Oct 4, 2026`, `9:00-11:00am`): unchanged — green
  `Add to Calendar` button, `Sunday, Oct 4, 2026 · 9:00am to 11:00am` line.
- **Transit Month Webinar** (no date, no time): `Date not specified`, the ⚠
  `No specific day or date range is mentioned…` DateNote is KEPT, the DateContext
  quote is KEPT, then an amber ⚠ `Date not found in the newsletter — the calendar
  link defaults to today; set the correct date before saving.` and an **enabled**
  amber `Add to Calendar (set the date)` button. No red line, no "Cannot add".
- **Bike Classes Planning Survey — Info Call** (no date, `12:00pm`):
  `Date not specified · 12:00pm`, same amber notice, enabled
  `Add to Calendar (set the date)`.

Decoded generated URLs (from the preview HTML):

| Event | `text=` | `dates=` | `details=` highlights |
|---|---|---|---|
| Fall Bike Ride | `Fall Bike Ride` | `20261004T090000/20261004T110000` | unchanged legacy format |
| Transit Month Webinar | `Transit Month Webinar` | `20260910/20260911` (all-day **today**, 2026-09-10) | description, `From the newsletter: "…"`, `Location: Online`, `Date note: …`, `⚠️ Calendar Scout could not determine the date … set to Thursday, Sep 10, 2026 as a placeholder — please edit …`, footer |
| Bike Classes … Info Call | `Bike Classes Planning Survey — Info Call` | `20260910T120000/20260910T130000` (**today noon +1h**) | same, plus `Time text seen: "12:00pm"` |

## Status log

- 2026-09-10: design doc written, code read, baseline captured (114 tests, tsc
  clean bar the known one).
- 2026-09-10: implemented in `calendar-utils.ts` + `email-templates.ts` +
  `types.ts`; added `worker/test/unparseable-date.spec.ts` (13 tests) +
  `NO_DATE_EVENTS_SAMPLE`. Suite **114 → 127**, all pass. tsc unchanged.
- 2026-09-10: rendered `unparseable-date-card-preview.html`, verified in the
  in-app browser + decoded URLs (above).
- 2026-09-10: shipped. Commits `be237e7` (design doc), `f86fd58` (impl + tests),
  `1588352` (render script + preview + doc), `<final>` (this finalization) →
  pushed to `iansagabaen/calendar-scout` `main`.

## Deploy

- `gh workflow run deploy.yml` → run **34510952729** (`workflow_dispatch`) →
  `success`; also push-triggered run **34510945177** (`push`, same commit
  `1588352`) → `success`, deployed ~6s later so it is the live one.
- Wrangler: `Total Upload: 186.74 KiB / gzip: 48.78 KiB`, `Worker Startup Time:
  6 ms`, `Deployed calendar-scout-worker triggers` →
  `https://calendar-scout-worker.iansagabaen.workers.dev`, `schedule: 0 3 * * *`.
- New Version IDs (both from commit `1588352`, differ from the prior live
  version): dispatch run `5f37d7b9-2726-47e6-8b16-8e228f75eed6`, **live**
  (push run, deployed last) `0df24580-6d4c-4f6b-8425-fdbfd5b8fb68`.
- `.github#11` annotation `git failed with exit code 128` — pre-existing on this
  workflow (a non-fatal post-step), not introduced here; job concluded `success`.

## STEP 8 — deployed-worker verification

`GET /admin/smoke-test` with the `X-Admin-Secret` header (secret from
`worker/.dev.vars`):

```
HTTP 200
{"ok":true,"eventCount":1,"tookMs":2435}
```

**Verified:** the new version is live and the end-to-end plumbing
(fetch → Gemini → parse → `createCalendarUrl`) is healthy; the full `worker/`
suite (127 tests) exercises the new fallback against the built code, including a
nightly-harness-shape end-to-end check on `NO_DATE_EVENTS_SAMPLE`.

**Not yet verified end-to-end:** a real Gemini response returning a genuinely
date-less event, rendered in a real inbox. That path is covered going forward by
`NO_DATE_EVENTS_SAMPLE` (asserted offline each `npm test`) and by Ian
re-forwarding the Transit Month newsletter. The nightly cron regression test is
unchanged (still the two live cases); `NO_DATE_EVENTS_SAMPLE` is deliberately not
one of them (see `regression-samples.ts` comment).

## Follow-ups

- If real usage shows date-less events are common, consider surfacing the
  placeholder date more prominently in the card body (currently only the amber
  notice + the `Date not specified` line signal it).
- `createCalendarUrlWithSummary` (currently unused in the live path) still has the
  old hard date-error behaviour — align it if it is ever wired back in.
