# Calendar Scout: Image/PDF Parsing Stress Test

**Date:** 2026-07-16
**Purpose:** Stress-test the existing (already-shipped) image/PDF attachment parsing path in `calendar-scout/Code.js` against realistic messy real-world input, per the open next-action in `projects.md` ("Confirm PDF/image-only flyer parsing is reliable").

## Method

Confirmed the production flow first: `Code.js` sends image/PDF attachments as base64 `inline_data` directly alongside the text prompt to Gemini's `generateContent` endpoint — no separate OCR step, no text extraction layer. `callGeminiVisionAI()` builds one prompt (with a `dateContext` prefix resolving relative dates against the email's received date) and tries models in order: `gemini-2.5-flash` → `gemini-2.0-flash-001` → `gemini-2.0-flash-lite`, using the first one that returns HTTP 200.

I replicated this exactly in a standalone Python script: same prompt text (verbatim, including the JSON schema instructions and expansion/numbering rules), same payload shape (`{contents: [{parts: [{text: prompt}, ...mediaParts]}]}`), same endpoint URL pattern and model fallback order. Built 4 test artifacts with known ground truth (HTML mockups rendered via headless Chrome to PDF/PNG), sent each through the script, and graded the JSON response against what I put in.

All 4 tests were answered by the **first** model in the fallback list (`gemini-2.5-flash`); none needed to fall back, so the fallback path itself remains untested by this run (that's a separate, lower-priority gap — fallback only triggers on non-200 from the first model, which didn't happen here).

## Test 1 — Clean multi-event PDF flyer (school newsletter, 2-column layout)

**Ground truth (6 events):**
1. Picture Day — Sep 16, 2026, 8:00am–3:00pm, School Gymnasium
2. PTA Bake Sale Fundraiser — Sep 18, 2026, 3:15pm–4:30pm, Front Courtyard
3. Early dismissal (staff development) — Sep 21, 2026, 1:15pm, no location
4. Fall Family Picnic — Sep 27, 2026, 11:00am–2:00pm, Willow Park Pavilion #3
5. Book Fair Kickoff — Sep 29, 2026, 9:00am–3:30pm (runs through Oct 3), Library
6. 6th Grade Parent-Teacher Conferences — Oct 2, 2026, no fixed time (sign-up slot), Room 12

**Extracted:** All 6 events found. Titles, dates, times, locations all correct. No hallucinations, no omissions.

Two minor (non-breaking) deviations:
- Event 5 was returned as "Book Fair" with `Date: "Sep 29, 2026 - Oct 3, 2026"` (a range) rather than treating Sep 29 as a distinct "kickoff" — a defensible reading of "Runs through Oct 3," not an error.
- Event 3's `Time` field came back as the literal string `"ends at 1:15pm"` instead of a clean time or empty string — cosmetic, but see note under Test 4 about downstream `parseTime()` handling of odd Time strings.

**Verdict: PASS.**

## Test 2 — "Bad photo of a flyer" simulation

Rendered an HTML flyer (Anton/Poppins fonts, warm cream background, torn-paper framing) then applied `transform: rotate(-6deg)`, `filter: blur(0.6px) contrast(0.85) brightness(0.92)`, and a diagonal light/dark gradient overlay to simulate an off-angle phone photo under uneven lighting.

**Ground truth (1 event):**
- Fall Harvest Block Party — Sat Oct 10, 2026, 4:00pm–8:00pm, Elm Street Cul-de-Sac (in front of #142), free/all ages, bring folding chair + side dish

**Extracted:** Exact match on all fields — title, date, time, location (including the parenthetical address detail), and a description that correctly pulled in the pumpkin-decorating and live-music sub-details without hallucinating anything. `DateConfidence: "high"` — correct, since the date was unambiguous despite the visual degradation.

**Verdict: PASS.** The blur/rotation/contrast reduction applied was real but moderate (not a genuinely dark or heavily motion-blurred photo) — this validates that *moderate* photo degradation doesn't break extraction, not that arbitrarily bad photos are handled. Worth another round with more aggressive degradation (heavier blur, harsher rotation like 15-20°, actual low-res/JPEG-artifact input) if this becomes a real support complaint.

## Test 3 — Multi-page PDF (3 pages, events spread across all pages)

This was the highest-value test given the flagged concern: production sends the *entire* PDF as one `inline_data` blob, so the question was whether Gemini reads only page 1 or the whole document.

**Ground truth (7 events across 3 pages):**
- Page 1: U10 Soccer Opener (Nov 7, 9am, Field 2); U12 Soccer Opener (Nov 7, 11am, Field 3)
- Page 2: Basketball Tryouts Gr 3-5 (Nov 10, 5:30-7pm, Gym A); Basketball Tryouts Gr 6-8 (Nov 11, 6-7:30pm, Gym A); Coaches/Volunteers Info Night (Nov 12, 7pm, League Office)
- Page 3: Winter Registration Deadline (Nov 20, 11:59pm, online, $25 late fee note); End-of-Season Awards Banquet (Dec 12, 5-7pm, Community Center)

**Extracted:** All 7 events found, correctly attributed to the right dates/times/locations, including both page-3 events (which is exactly the "does it silently drop later pages" risk this test was designed to catch). No hallucinations.

**Verdict: PASS.** Multi-page PDFs are NOT silently truncated to page 1 — Gemini's multimodal PDF handling read the full 3-page document correctly in this test.

## Test 4 — Handwritten-style invite (informal, Caveat/Kalam Google Fonts)

**Ground truth (1 event, deliberately no year stated):**
- Lily's 7th Birthday Party — Sunday, Nov 22 (no year in source text), 2:30pm, Maple Grove Park (big pavilion by the swings), unicorn theme, RSVP to Jenna at (555) 019-2244

**Extracted:** Correct title, correctly inferred year (2026, matching the `dateContext`-supplied email date of Nov 1, 2026 and the `currentYear` fallback in the prompt), correct location including the pavilion detail, correct RSVP/theme info in Description. `DateConfidence: "high"` — reasonable, since "Sunday, November 22" is unambiguous even without an explicit year.

One cosmetic artifact: `Time: "2:30 PM -"` — a dangling trailing dash (source text was "Starting at 2:30 in the afternoon" with no end time; Gemini appears to have anticipated a range and left a stray separator). Checked this against production's `parseTime()` regex in `Code.js`: it does NOT break — the first regex branch (range match) requires two numbers around the dash and fails to match, so it falls through to the single-time branch and correctly parses `start: "2:30PM", end: null`, which downstream `createCalendarUrl()` handles by defaulting to a 1-hour block. **Not a functional bug**, just noting the raw string is uglier than ideal; if it recurs across real user reports, consider tightening the prompt's Time-field instruction (e.g. "if there's no end time, omit any trailing punctuation").

**Verdict: PASS.**

## Overall Recommendation

**The image/PDF parsing is reliable enough to market as a differentiator as currently implemented**, based on this test round. All 4 tests — clean multi-column PDF, degraded/rotated photo, multi-page PDF, and stylized handwriting-font invite — extracted every ground-truth event correctly with zero hallucinations and correct date-confidence flagging. The specific risk flagged in `projects.md` (multi-page PDFs silently dropping later-page events) did **not** materialize — page 3 events were captured correctly.

**Before leaning on this harder in marketing, two follow-ups are worth doing** (not blockers, just gaps this round didn't cover):
1. **Test genuinely bad photos**, not just moderately degraded ones — actual phone-camera JPEG artifacts, harsher blur/rotation, low light, partial occlusion (finger in frame, glare). This round's "bad photo" was still cleanly legible to a human; real forwarded photos from users may be worse.
2. **Force a fallback-model run** (e.g. temporarily deny `gemini-2.5-flash` or hit a rate limit) to confirm `gemini-2.0-flash-001` and `gemini-2.0-flash-lite` produce comparably reliable extractions — this round never exercised the fallback path since the first model always returned 200.

No code changes are needed based on these findings — the Time-field dangling-dash artifact in Test 4 was confirmed non-breaking against the actual `parseTime()`/`applyTime()` logic in `Code.js`.

## Artifacts

Test HTML/PDF/PNG sources and raw Gemini JSON responses were generated in a scratch directory during this session and are not checked into the repo (ephemeral test fixtures, not durable project assets). The prompt and model list used are copied verbatim from `calendar-scout/Code.js` `callGeminiVisionAI()` and `CONFIG.MODELS` as of commit `4fecf68`.
