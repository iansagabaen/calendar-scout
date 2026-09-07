---
name: User Feedback Loop Brainstorm (2026-09-02)
description: Ranked, non-creepy, privacy-respecting ways to build a feedback loop from real Calendar Scout users, triggered by a spike to 6 first-time-sender welcome emails in a week
type: strategy
---

# User Feedback Loop Brainstorm — 2026-09-02

> STATUS: IN PROGRESS — written incrementally, saved as it goes.

## Why this doc exists

Calendar Scout sent **6 first-time-sender welcome emails in a week**, up from ~2.
Some of those are probably real parents who forwarded a school email and watched
events land on their calendar. Ian wants their feedback but (correctly) thinks
a cold email to an address he only has because they forwarded something is
creepy and a privacy problem.

He floated an **opt-in in-product feedback prompt** — e.g. "every 5th email has a
CTA asking how it's going." This doc is a **brainstorm of options, ranked**, not
an implementation plan. It ends with a recommendation and a reply template Ian
can use *today* for the current handful of users.

---

## A. What exists today (factual baseline — read from the code)

### A1. The report-email footer (`worker/src/email-templates.ts`, `FOOTER_HTML`)

Every report and fallback email ends with `wrapEmail()`, which appends
`SIGNATURE` (`<p>your calendar scout</p>`) then `FOOTER_HTML`:

> **About the scout**
> I am an experimental tool built to help you easily find and add events to your
> calendar. I am not always perfect, so please check my work.
> [Report an Error] | [Buy me a coffee]
>
> **Privacy**
> I process your text, find your dates, and don't store your data.
> [sendtoschedule.com]

Link targets:

| Link | URL | What it is |
|---|---|---|
| Report an Error | `https://forms.gle/687QErQW5soF9mCu8` | A Google Form (shared with the landing page's "Report an error or send feedback" link). Off-platform, generic, no context about which email it's about. |
| Buy me a coffee | `https://buymeacoffee.com/lionsaga` | Buy Me a Coffee tip page. |
| sendtoschedule.com | `https://sendtoschedule.com/` | The landing page. |

The `buildGmailPermissionDiagnosticEmail()` also links the same Google Form as
"Send feedback".

### A2. The "after 5 uses" survey — what it actually is now

- **Constant:** `SURVEY_AT_USE_COUNT = 5` in `worker/src/index.ts`.
- **Trigger:** on a *successful* report send, `trackUsage()` increments a
  per-email counter in KV (`USER_USAGE_COUNT` — a JSON object `{ email: count }`).
  `shouldIncludeFeedback = usageCount === SURVEY_AT_USE_COUNT` — so it fires
  **exactly once, on the 5th successful report**, not "every 5th".
- **What renders:** when true, `buildReportEmail()` appends `FEEDBACK_SECTION`
  *inside the same report email*, before the footer. There is **no separate
  survey email anymore** — that was removed on 2026-08-04 (see
  `2026-08-04-calendar-scout-survey-integration-fix.md`). The standalone
  `buildSurveyEmail()` function still exists in `email-templates.ts` but is
  **not imported or called** — dead code.
- **`FEEDBACK_SECTION` copy** (green box, `#F0F8F0` bg, 4px `#2E4A2E` left border):
  > **Quick feedback?**
  > • Are you enjoying Scout?
  > • Have any dates been wrong?
  > • Anything you'd like to see?
  > Just reply to this email. I read every message. 🙏
- **How a response comes back:** the user hits reply. It lands in the mailbox
  behind `scout@sendtoschedule.com`. Nothing parses or stores it — Ian reads it
  by hand.
- **What's stored:** only the integer counter keyed by email in KV. The reply
  text itself is not stored by Calendar Scout.

### A3. First-time-sender ("FTUX") behavior

There is **no separate welcome email**. "FTUX" = extra content folded into the
*first* email the sender gets back:

- `isFirstTime = !welcomedList.includes(senderEmail)` (or forced via the
  `DEBUG_FTUX_EMAIL` env var for testing). `welcomedList` is the KV
  `WELCOMED_USERS` array of sender emails.
- **If events were found on the first email:** `buildReportEmail(..., isFirstTime=true)`
  renders a **"Welcome to Calendar Scout! Here's how it works:"** green box above
  the event cards — "No account or sign-up needed", "We read your email that you
  forwarded", "We found N events", "We immediately delete your email in our
  system", what we use / don't do, an "add to contacts" vCard link, and
  "Learn more: sendtoschedule.com".
- **If no events were found on the first email:** `buildFallbackEmail(..., isFirstTime=true)`
  sends the longer **"Welcome to Calendar Scout!"** explainer (how it works,
  "I work best with…", privacy bullets, "Ready to try?").
- After a successful first report, `addWelcomedUser()` adds the sender to
  `WELCOMED_USERS` so the welcome content is shown only once.

### A4. Analytics events related to feedback / lifecycle (`worker/src/analytics.ts`)

PostHog HTTP capture API, distinct-id = sender email, all event names prefixed
`calendar_scout_`. Existing events:

- `calendar_scout_email_received`
- `calendar_scout_event_extraction_succeeded` (carries `eventCount`, `processingTimeMs`, `isFirstTime`)
- `calendar_scout_no_events_found`
- `calendar_scout_filtered_out_pre_ai`
- `calendar_scout_processing_error`
- `calendar_scout_ftux_welcome_sent`
- `calendar_scout_survey_triggered` — fires when the 5th-use feedback block is included
- `calendar_scout_nightly_regression_passed` / `_failed`

**There is no event for a feedback link being shown vs. clicked, and no event
for a reply coming back.** So today Ian cannot see the response rate of the
5th-use prompt at all — only that it was triggered.

### A5. The privacy promise (verbatim)

Landing page (`landing/src/App.tsx`), Privacy section:

> "We process your text, find your dates, and don't store your data.
> No accounts to create, no apps to download."
>
> "Calendar Scout is built on a pass-through architecture. We don't have a
> database that stores your name, your emails, or your calendar details."
>
> "When you forward an email, our AI reads it in real-time to find dates,
> generates your calendar links, and immediately forgets the content. We don't
> sell data, we don't train models on your personal info, and we don't read
> anything other than the specific emails you choose to send us."

Email footer, Privacy line (verbatim):

> "I process your text, find your dates, and don't store your data."

Report welcome box (verbatim): "What we don't do: Store emails, train models,
sell data" and "We immediately delete your email in our system".

**One honest caveat to hold in mind:** the promise is about *email content and
calendar details*. Calendar Scout *does* already persist the sender's **email
address** in KV (`WELCOMED_USERS`, and as the key in `USER_USAGE_COUNT`) and
sends the address to PostHog as the distinct-id. That's arguably a gap between
the "no database that stores your name / your emails" copy and the
implementation. Any new feedback mechanism should not widen that gap — in
particular, **do not start assembling a contact list / CRM of senders and their
message history.** Keeping feedback as *reply-in-thread* leaves the data where
the user already chose to put it.

---

## B. The ethics/privacy question, answered plainly

**Is it OK for Ian to reply to someone who forwarded an email to
`scout@sendtoschedule.com`?**

Yes — a **short, personal reply on that same thread** is defensible and low-creep.
The person *initiated contact with the service*: they sent mail to Ian's address
and got an automated answer. A human follow-up on that existing thread ("hi — a
real person built this, mind telling me how that went?") is **responding to an
interaction the user started**, not cold outreach. It's the same inbox, the same
thread, the same relationship the automated reply already established. Keep it
occasional (a sample of new users, not all of them), make it obviously easy to
ignore, never chase a non-reply, and it stays on the right side of the line.

**What crosses the line:** taking the forwarder's email address (or any address
harvested from the forwarded content — the school's, other parents') and sending
a *new* message to it, adding them to a list, or emailing them again later
without their say-so. That's building a contact database out of a pass-through
service and contradicts "we don't have a database that stores your emails."

**The rule of thumb:** *reply in the thread they opened = fine; anything that
requires storing them as a contact to reach again later = needs explicit opt-in.*

---

## C. Options — mechanisms, ranked roughly best-first

Effort: S = under an hour, M = a few hours, L = a day+.
Intrusiveness / privacy / response-rate are estimates for the current ~single-digit
user base.

### C1. Upgrade the footer "Report an Error" into a real one-question thing
**How:** replace the generic Google Form link in `FOOTER_HTML` with a tiny inline
row — "How did I do? 👍 nailed it · 👎 missed something · ✍️ tell me more" — where
each is a `mailto:scout@sendtoschedule.com` with a prefilled subject
(`?subject=Scout feedback: nailed it`) so the reply threads back to Ian with no
backend. Keep it one line, `#888` grey, same weight as the current "Report an
Error | Buy me a coffee".
**When:** every email, always present, passive.
**Effort:** S. **Intrusiveness:** low (it replaces text that's already there).
**Privacy-consistent:** yes — mailto only, nothing stored, no new list.
**Est. response:** 1–3% of emails, but it compounds because it's always there.
**Main risk:** `mailto:` with `subject` is well supported; `body` prefill is
flakier on some mobile clients — keep the payload to `subject` only. Emoji in a
grey footer can look unserious — tune wording.

### C2. One-tap reaction row on the report itself
**How:** a slim row just under the event cards (not in the footer): "Did this
look right? 👍 / 👎 / it missed an event". Each is a `mailto:` or a link to a
static thank-you page with a prefilled subject. No DB.
**When:** every report email (or every report after the 1st), passive-ish —
it's in the body, so more visible than the footer.
**Effort:** S–M. **Intrusiveness:** low–medium (it's above the fold-ish).
**Privacy-consistent:** yes if `mailto:`; if it's a link to a page that logs the
click, keep it event-only (no email in the URL — see §E).
**Est. response:** 3–8% — proximity to the thing being rated helps a lot.
**Main risk:** every-email placement can get wallpaper-blind fast; consider
showing it only on the 1st, 3rd, and then never. Also: a 👎 with no way to say
*what* was wrong is frustrating — pair it with "reply and tell me".

### C3. Lifecycle-timed single ask (the good version of Ian's idea)
**How:** fire the `FEEDBACK_SECTION` block **once**, after the user's **2nd or
3rd successful report** (not the 5th, not every 5th). Copy leans into "you've
used this a few times now — what's the most annoying thing about it?" Then never
again for that sender. Implementation is tiny: change the trigger from
`usageCount === 5` to `usageCount === 3`, or keep 5 but that's the only change.
**When:** exactly once, early in the relationship while the experience is fresh.
**Effort:** S (it's a constant change + copy tweak).
**Intrusiveness:** low (one shot, in an email they already wanted).
**Privacy-consistent:** yes — same counter that already exists, same
reply-in-thread.
**Est. response:** 5–12% for a single well-timed ask vs. low-single-digits for a
repeating one.
**Main risk:** at 2–3 uses some users haven't formed an opinion yet; 3 is
probably the sweet spot. If they never reach use #3, they never get asked —
acceptable.

### C4. Opt-in tester list
**How:** a one-line CTA in the footer or the welcome box — "Want to help shape
this? Reply **JOIN** and I'll email you once a month with what's new and one
question." When someone replies JOIN, Ian (manually, at this scale) keeps their
address on a short list *with their consent*. This is the one mechanism that
legitimately converts an anonymous sender into someone Ian can contact again.
**When:** welcome box (first email) + optionally the footer.
**Effort:** S to add the CTA; M if later automated. Manual list-keeping for now.
**Intrusiveness:** low (it's an offer, not a prompt).
**Privacy-consistent:** yes **because it's explicit opt-in** — the user asked to
be contacted. Document it: this list is the *only* sanctioned place a sender's
address is kept for outreach, it's consented, and there's an unsubscribe ("reply
STOP").
**Est. response:** 1–5% will opt in, but those are your highest-signal users and
you can reach them repeatedly.
**Main risk:** now you're running a tiny mailing list — needs a STOP handler and
honest handling. Keep it off the "we don't store your emails" collision course
by describing it plainly on the landing page.

### C5. Ian replies in-thread to a sample of new FTUX users (do this now)
**How:** when a new sender shows up (Ian sees the `ftux_welcome_sent` event or
just watches the inbox), he personally replies on that thread a day later with 2
sentences. Not automated. Not everyone — a sample.
**When:** ~24h after a first successful report, while it's fresh.
**Effort:** S per user, doesn't scale past ~dozens/week.
**Intrusiveness:** low if in-thread and occasional (see §B).
**Privacy-consistent:** yes — in the thread the user opened, nothing stored.
**Est. response:** 20–40% — it's a real human asking, and the bar to reply is
one line.
**Main risk:** feels bad if overdone or if sent to someone who clearly just
tried it once and bounced. Read the room per-thread.

### C6. "Reply to this email with anything" one-liner
**How:** a single plain-text sentence at the end of the report, no links, no box:
"Built by one person — just hit reply if anything's off or missing." Lower-key
than the `FEEDBACK_SECTION` box.
**When:** every report, or every report after the welcome.
**Effort:** S. **Intrusiveness:** very low (one grey sentence).
**Privacy-consistent:** yes.
**Est. response:** <1–2%, but zero downside and it sets the expectation that a
human is on the other end.
**Main risk:** so subtle it's ignored; mostly valuable as tone-setting, not as a
feedback funnel on its own.

### C7. Post-first-success micro-ask
**How:** in the first successful report only, one line under the summary: "First
time — did the calendar links work? Reply **yes** / **no**." Binary, dead simple.
**When:** once, on the first successful report (`isFirstTime === true`).
**Effort:** S (conditional one-liner in `buildReportEmail`).
**Intrusiveness:** low–medium (first impression is a sensitive moment; a question
can feel needy).
**Privacy-consistent:** yes.
**Est. response:** 5–15% — novelty + a yes/no bar.
**Main risk:** asking for feedback *before* the user knows if they like it can
sour the first impression. Softer wording ("hope that worked — reply if not")
de-risks it, but then it's basically C6.

### C8. (New idea) Contextual ask triggered by a likely-bad result
**How:** Calendar Scout already knows when a result is shaky — `DateConfidence:
'low'`, an inferred am/pm, a `TimeInferenceNote`, a calendar-URL error. When any
of those fired for an event in the report, append a targeted line to *that* card:
"Not sure I got this one right — reply and tell me?" Feedback is requested
exactly when it's most useful and most likely (the user is already scrutinizing
that card).
**When:** only on reports containing a low-confidence / inferred / errored event.
**Effort:** M (thread a flag through `buildReportEmail`'s per-event loop — the
signals are all already computed there).
**Intrusiveness:** low (only appears when the product itself is unsure, so it
reads as honesty, not nagging).
**Privacy-consistent:** yes — reply-in-thread.
**Est. response:** 10–20% *of the subset of emails where it shows*, which is the
high-value subset (these are the parses most likely to be wrong).
**Main risk:** if low-confidence fires too often it becomes noise; gate it to one
such line per email max.

### Verdict on Ian's "every 5th email CTA" idea

**Frequency-based prompting ("every Nth email") underperforms and annoys** for
three reasons:

1. **It nags the engaged users and misses the disengaged ones.** The person who
   hits use #5, #10, #15 is your happiest user — you're interrupting the people
   who already like it, repeatedly, while someone who tried it twice and had a
   bad parse never sees a prompt.
2. **Repetition trains the eye to skip it.** The 2nd time a user sees the same
   green "Quick feedback?" box they pattern-match and scroll past. A prompt seen
   once has the user's full attention; a recurring one is wallpaper by the third
   showing.
3. **It reads as "this tool wants something from me" on a schedule**, which is at
   odds with the "quiet, no-account, no-nag" personality Calendar Scout is going
   for.

**Better:** one well-timed single ask (C3, at use #2–3) for the "how's it going"
signal, **plus** an always-present, genuinely passive option (C1 / C6) that a
motivated user can act on any time without being prompted, **plus** the
context-triggered ask (C8) that only appears when feedback is actually valuable.
That gets you more signal than an every-5th CTA, with far less nagging.

---

## D. Recommendation

### Ship, in this order

1. **C1 — upgrade the footer feedback link (S).** Replace the generic
   "Report an Error" Google Form link with a one-line 👍 / 👎 / "tell me more"
   `mailto:` row. Always present, near-zero intrusion, no backend. This is the
   permanent passive channel. *Requires:* edit `FOOTER_HTML` in
   `email-templates.ts`; decide the prefilled subjects; keep the Google Form link
   too if Ian still wants the structured bug-report path (label it "Report a bug"
   and make the new row the "how'd it go" path).

2. **C3 — convert the 5th-use survey into a single early ask (S).** Change
   `SURVEY_AT_USE_COUNT` to `3` (or keep the mechanism, just make sure it's
   understood as one-shot — it already is) and soften the `FEEDBACK_SECTION`
   copy toward "what's the most annoying thing about this?" One shot per user,
   then silent. *Requires:* one constant + copy edit in `email-templates.ts` /
   `index.ts`.

3. **C4 — add the opt-in tester-list CTA (S now, M later).** One line in the
   welcome box and/or footer: "Want to help shape this? Reply JOIN." Manually
   maintain the consented list at current scale. *Requires:* copy in
   `email-templates.ts`; a note on the landing page describing the list; a plan
   for handling JOIN / STOP replies (manual for now).

Optionally follow with **C8** (context-triggered ask on low-confidence results)
once the above are in — it's the highest-signal automated option but needs a
bit more plumbing.

### For RIGHT NOW, at ~6 users: do C5 by hand

The single highest-value move today is **Ian personally replying in-thread** to
the real-looking new senders. It doesn't scale, but at 6 users it doesn't need
to, and the response rate/quality beats anything automated. Suggested reply
(send from the `scout@sendtoschedule.com` thread, as a human):

> Subject: Re: [their forwarded subject]
>
> Hi — this is Ian, the person who actually built Calendar Scout (it's just me).
> I saw your email came through and events landed on your calendar. Since it's
> still early and I'm trying to make it genuinely useful, would you mind telling
> me:
>
> - Did the calendar links work the way you expected?
> - Was anything wrong or missing?
> - What would make you forward the next email to it without thinking about it?
>
> No pressure at all — one line back is plenty, and if you'd rather not, just
> ignore this and it won't happen again.
>
> Thanks for trying it,
> Ian

Keep it to a sample, always in-thread, and never send a second chase if there's
no reply.

---

## E. What to measure (PostHog, event-only, no PII beyond the existing distinct-id)

Add these so response rate becomes visible instead of invisible:

| Event | Fires when | Properties (no new PII) |
|---|---|---|
| `calendar_scout_feedback_prompt_shown` | any feedback affordance is rendered in an outgoing email | `variant` ("footer_row" / "lifecycle_ask" / "context_low_confidence" / "tester_list_cta"), `usageCount` |
| `calendar_scout_feedback_link_clicked` | a feedback link/`mailto:` that routes through a redirect or a thank-you page is followed | `variant` |
| `calendar_scout_feedback_reply_received` | Ian manually tags a reply as feedback (or, later, an inbound-parse detects one) | `variant` if known, `sentiment` optional |
| `calendar_scout_tester_list_opt_in` | a JOIN reply is processed | — |

Notes:
- `mailto:` links can't be tracked directly; only a link through a redirect page
  can fire `..._link_clicked`. Decide per variant whether tracking is worth the
  redirect hop — for C1 it probably isn't, so lean on `..._prompt_shown` +
  manual `..._reply_received`.
- Keep the distinct-id exactly as it is today (sender email). Do **not** add the
  email or reply text as event properties.
- With `_prompt_shown` and `_reply_received` you can compute a real response rate
  per variant and kill the ones that don't earn their place.

---

## Appendix: visual mockup

`research/feedback-cta-mockup.html` renders the current footer AS-IS next to the
recommended variants (upgraded footer row, one-tap reaction row, lifecycle ask,
opt-in list CTA) using the product's real colours and Georgia serif, so the
intrusiveness of each can be eyeballed. Inline CSS only; open with a
`file://` path or a throwaway `python3 -m http.server`.
