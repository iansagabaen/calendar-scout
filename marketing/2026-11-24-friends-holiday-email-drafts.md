---
name: Friends holiday-week email drafts + send checklist (2026-11-24)
description: Paste-ready email, pass-it-on blurb, text and reply templates asking friends to try Calendar Scout this Thanksgiving week, plus sending logistics, a launch-readiness check read from the code, and how to read the PostHog numbers afterward.
type: marketing
---

# Friends email: holiday week (drafted Nov 24, 2026)

Goal: ask friends to forward ONE real email to the Scout, then tell Ian what it got
wrong. Same spirit as the Instagram Story copy
(`2026-09-02-instagram-story-beta-recruit-copy.md`): one tiny ask, an easy out, no
pitch voice. Everything below is draft text for Ian to copy, tweak and send himself.
Nothing here was sent, and no contact list was touched.

Voice notes applied (from `MEMORY/feedback_writing_style.md`): full flowing
sentences, no em dashes, no chains of very short sentences, humble about being early,
"my request" style asks, no closing gratitude speech, no buzzwords. Dates use
"Mmm dd" if you add one.

Placeholders: `[First name]`, `[your name]`, `[one personal sentence]`.

---

## 1. What is true right now (read from the live code, Nov 24)

| Fact | Source |
|---|---|
| Address people forward to (homepage, contact card): `forward@sendtoschedule.com`. Any `@sendtoschedule.com` prefix reaches the Scout (site FAQ). Replies come from `scout@sendtoschedule.com`. | `landing/src/App.tsx`, `landing/public/calendar-scout.vcf`, `worker/wrangler.jsonc` (`FROM_EMAIL`) |
| What comes back: a "Scout Report" email with a one-line summary, then each event on its own card (title, date, time, location, short description) and an "Add to Calendar" button. | `worker/src/email-templates.ts` `buildReportEmail` |
| The button opens a PRE-FILLED GOOGLE CALENDAR event (`google.com/calendar/render?action=TEMPLATE`). The person still taps Save. It does not add automatically, and there is no Apple Calendar, Outlook or .ics option anywhere in the code. | `worker/src/calendar-utils.ts` lines ~491 and ~643 |
| The landing page never says "Google Calendar" (searched `App.tsx` for Google, Apple, Outlook: no hits). The report email just says "Add to Calendar". So the email is the first place friends are told. | `landing/src/App.tsx` |
| Only the text of the email body is read. Images and PDFs are switched off in the code ("0% success rate in manual testing"). The site says image/PDF support is "coming soon"; these drafts do not repeat that promise. | `worker/src/index.ts` lines ~107-121 |
| Free, no account (site FAQ, welcome box). | `App.tsx`, `email-templates.ts` |
| Speed: the site says "a few seconds", the sender display name says "report in ~1 min". The drafts say "a minute or so" to stay safe. | `App.tsx`, `wrangler.jsonc` |
| An email with no date or event words never reaches the AI and gets a "couldn't find any events" reply. | `worker/src/gemini.ts` `looksLikeEvent` |

### Privacy nuance (read this before choosing any privacy wording)

What the site and emails say: "We process your text, find your dates, and don't store
your data"; "We don't have a database that stores your name, your emails, or your
calendar details"; "immediately forgets the content"; the first-time fallback email says
"We never store, sell, or train models on your data."

What the code actually keeps, as far as I can read it:

- The email body is not saved anywhere in the worker (not in KV, not in the logs). That
  part of the claim matches the code.
- The sender's email ADDRESS is kept: a list of welcomed senders and a per-address use
  counter in Cloudflare KV (no expiry in the code), plus the address in each execution
  log line, and in the error-alert emails that go to you. The last 500 message IDs are
  also kept.
- PostHog gets a salted hash of the address (not the address) plus a yes/no
  `is_test_sender`; one event (`no_events_found`) also carries the AI's one-sentence
  summary of the email.
- The email text is sent to Google's Gemini API, and the replies go out through Resend.
  I could not verify how Google or Resend retain that data under your account's plan, so
  "never train models on your data" is the strongest line to double-check.

So "doesn't store your data" is a little broader than reality, because the address is
stored. Suggested handling for the friends email: make no privacy claim beyond what is
verified. The drafts say free, no account, and "it only sees the emails you choose to
forward" (true by design: only mail sent to the Scout's address reaches it). If you want
a stronger line, pick one yourself after checking Google's and Resend's terms; fixing the
site wording (for example "doesn't keep your emails") is a separate decision.

---

## 2. The drafts

### Version A: short and personal (close friends)

About 120 words including the personal line. Greeting and sign-off not counted.

> Hi [First name],
>
> [one personal sentence]
>
> I made a free tool called Calendar Scout, and I'm asking a few friends to try it this week. You forward an email full of dates, like a school newsletter, to forward@sendtoschedule.com, and a minute or so later it replies with each event on its own card and a button that opens a pre-filled Google Calendar entry.
>
> Could you forward one real email and then reply to me with whatever it got wrong or confused you, even the small stuff? It reads the text of the email rather than attachments, and it only works with Google Calendar. If you know a parent who might like it, passing it along is optional, and ignoring this note is fine.
>
> [your name]

Personal-line ideas (pick one, or write your own): "Hope your Thanksgiving week is a slow
one." / "It was good to see you at [place] a while back." / "I keep thinking of you
whenever a school newsletter arrives."

### Version B: broader circle (acquaintances, parent groups, old coworkers)

About 190 words. Greeting and sign-off not counted.

> Hi [First name],
>
> [optional one line on how we know each other]
>
> I'm a parent and a designer, and I got tired of digging through long school newsletters to find one early-release day, so I built a small free tool called Calendar Scout. You forward any email with dates in it, such as a school newsletter, a sports schedule or a party invitation, to forward@sendtoschedule.com. A minute or so later it replies with each event on its own card, and a button on each card opens a pre-filled Google Calendar entry where you tap Save. There is no account to create, and it only sees the emails you choose to forward.
>
> It's early and it's just me, so it does miss things, and my request is simple: would you forward one real email this week and reply to tell me anything it got wrong or any part that confused you? It reads the text of the email rather than PDFs or photos, and because the buttons open Google Calendar, it's only useful if you use that. If you know another parent who might want it, you're welcome to pass it along, but that part is optional, and it's completely fine to ignore this note.
>
> [your name]

### Version C: the "pass it on" blurb (zero context)

About 75 words. Written so a friend can paste it into a parent group chat.

> A friend of mine built a free tool called Calendar Scout: forward an email with dates in it (a school newsletter, a sports schedule) to forward@sendtoschedule.com and it replies with each event and a button that opens a pre-filled Google Calendar entry. It works with Google Calendar only, reads the text of the email rather than attachments, and is still early, so check its work. No account needed, and there's more at sendtoschedule.com.

### Version D: text / DM

Two sentences.

> Hey [First name], I made a free tool called Calendar Scout that turns a forwarded email full of dates, like a school newsletter, into Google Calendar buttons, and you just forward the email to forward@sendtoschedule.com. Would you try it with one real email and tell me what it gets wrong, with no worries at all if you'd rather skip?

### Optional add-on lines (paste into A or B only if you want them)

- Holiday angle, true and natural: "December is when the school emails pile up (concerts, early-release days, winter break dates), so a quiet moment this week is a good time to try it on a real one."
- Deliverability safety net: "If nothing comes back within a few minutes, check your spam folder, and tell me if it was there." (This matters: the Scout's reply comes from a brand-new sender address and can land in spam for some people. Worth adding to A if you can spare the words.)
- Where to answer: "Just reply to this email with what you found." (Keeps feedback with you. Note that replying to the Scout's own report goes to the Scout, not to you; see the checklist.)

---

## 3. Subject lines (6)

1. A small favor this holiday week
2. Would you try something I built?
3. Help me test a free tool I made
4. Your school newsletters, but in your calendar
5. I could use one honest opinion
6. Quick question about school emails

My pick: **#1 for close friends** (plain, personal, says what it is: a favor) and **#2 for
the broader list** (a question, not a pitch, and it doesn't sound like marketing).

Spam-filter flags: #3 has the word "free", a classic trigger word (low risk, lower case
and mid-sentence, but #1 and #2 are safer). #4 reads like a product line and is the most
"marketing" of the six. #6 is fine but vague enough that people who don't have school
kids may skip it. None use all caps, exclamation marks or "Re:" / "Fwd:" tricks. The
bigger spam risks are the send method and number of links (section 5), not these words.

---

## 4. If they reply

**Thank-you reply (they tried it or said they will):**

> Thank you for trying it, [First name]. What it got wrong is the most useful thing you can tell me, so even the smallest thing helps. If you think of anything later, just reply here.

**Follow-up when they say it broke something or got something wrong:**

> Thanks for telling me, that's exactly what I need. Could you tell me the one thing it got wrong, such as a date, a time or an event it missed? Forwarding me the original email would help me fix it, but only if you're comfortable sharing it and nothing private is in it, and a description is plenty.

**If they say nothing came back:**

> Sorry about that. Could you check your spam and promotions folders, and tell me roughly what time you forwarded it?

**If they use Apple Calendar or Outlook:**

> Thanks for letting me know. The buttons only open Google Calendar, so I understand if it isn't a fit for you.

(Never ask anyone to forward a private newsletter to you without them agreeing, and
never pull anyone's address from the Scout's own data. Replying in a thread they started
is fine; contacting a Scout user cold is not. See
`research/2026-09-02-user-feedback-loop-brainstorm.md`.)

---

## 5. Sending logistics

**How to send to many friends without being awkward**

- Never put everyone in To or Cc. That exposes everyone's address and invites reply-all
  chaos. Either send one message per person, or use BCC.
- Close friends (Version A): send one at a time from your own Gmail. It takes longer, but
  it is the most personal, and individual sends are the least likely to hit spam.
- Broader circle (Version B): BCC in small groups (for example 10 to 20), with your own
  address in To, and change the first line each time. Treat the group sizes as a rule of
  thumb, not an official limit.
- Mail merge: a Google Sheets mail-merge add-on or Gmail's built-in multi-send (check
  whether your Gmail plan even offers it) will put each person's first name in and send
  individually. Check what permissions an add-on asks for (reading and sending your
  mail), and switch off any open-tracking or link-tracking it adds by default, since
  tracking pixels look spammy.
- Gmail sending limits: they exist and change over time, so check Gmail's current daily
  limits before sending anything big. I am not quoting a number because I can't verify it
  from here.
- Spam-folder risk: a big BCC blast from an account that rarely sends bulk mail can land
  in spam or Promotions. Go in small batches, spread them over a few hours, personalize
  the first line, keep the email plain text with no images, and have a couple of friends
  tell you whether it arrived in their inbox.

**When to send (a judgment call)**

- Option 1: Wed Nov 25 morning, before the holiday. Pros: friends have downtime. Cons: many
  people are traveling or cooking, schools are closed so fewer fresh school emails arrive
  to forward, and you would be watching a new traffic event on Thanksgiving Day itself
  when you are with family.
- Option 2: Sun Nov 29 evening or Mon Nov 30 morning. Pros: people are back at their
  inboxes, school newsletters resume with the December flood (concerts, early-release days,
  winter break), you get Wed to Sat to fix anything in section 6 first, and you will be at
  your desk when replies arrive. Cons: Monday inboxes are busier, so your note competes
  with more mail.
- My recommendation: send Version A to 5 to 10 close friends on Wed Nov 25 or Fri Nov 27 as
  a small test, then send the wider list Mon Nov 30 mid-morning (roughly 9 to 10am). If you
  want a single date, choose Nov 30. This is judgment, not data.

**A light out**: the drafts already say "ignoring this note is fine". Keep that sentence.

**What NOT to do**

- No screenshots or images in the first email (spam-filter risk, and unnecessary).
- No "FW:" or "Fwd:" in the subject, and no "Re:" tricks.
- Don't promise a response time you can't keep. Say "I read every reply" only if it is
  true, and avoid "I'll reply within a day".
- Don't send more than one follow-up, and not for at least a week.
- Don't add anyone to a list they didn't join, and don't use the Scout's own sender data
  for outreach.

---

## 6. Before you hit send: launch-readiness check

I read the code only (commit `8f17c00`, Oct 16, the latest deploy). I did not log into
any dashboard or enter any credential.

### Verified in the code

- **How mail comes in and goes out.** Inbound is Cloudflare Email Routing handing each
  message to the worker. Replies go out through the Resend HTTPS API from
  `scout@sendtoschedule.com` (the `SEND_EMAIL` binding in the config is local-testing
  only). Resend's free tier is described in a code comment as "3,000 emails/mo, 100/day",
  which is a note from July and needs checking (see "You must verify").
- **One forward is about one outgoing email.** Each forward produces one reply (report or
  fallback). A failure also emails you an alert, using the same sending path. The first
  report carries the welcome box, so there is no separate welcome email. The "got it"
  auto-receipt template exists but is not used.
- **The circuit breaker can pause the whole product.** If more than 3 emails go to the
  same address within 10 minutes, or more than 100 go out in any rolling hour, the system
  sets itself to paused and mails you an alert. While paused, every inbound email is
  silently ignored: friends get no reply at all. Resume with `POST /admin/resume` and your
  admin secret. Two ways your friends email could trip it:
  - One enthusiastic friend forwards 4 or more emails within 10 minutes.
  - Gemini or Resend has a bad spell: each failure sends the friend a fallback AND sends
    you an alert, so 4 failures in 10 minutes trip the same-address limit on YOUR address,
    and about 50 failures in an hour trip the hourly cap.

  For 30 to 60 friends over a day or two, the hourly 100 cap is unlikely on a normal day,
  but the same-address rule is a real risk. Asking for "one" email (as the drafts do)
  helps. Whether to loosen the threshold is your decision; I did not change any code.
- **If Gemini is rate-limited or down.** It tries `gemini-2.5-flash`, then
  `gemini-2.5-flash-lite`; a non-200 answer (including a rate limit) moves straight to
  the next model with no waiting, and an unreadable answer gets one retry per model. If
  all fail, the person is sent a fallback email and you get an ERROR alert. For a repeat
  user the fallback text is clear: "I couldn't read that email this time... try
  forwarding it again in a few minutes." **Known gap for friends: a first-time sender
  gets a different fallback that ignores that message and says "I didn't find any events
  in that first email, but that's okay."** During an outage that is misleading, and most of
  your friends will be first-time senders.
- **If Resend refuses a send** (for example a daily cap), the report path logs the failure
  and tries to alert you through the same blocked channel: the friend gets nothing.
- **Attachments are ignored.** A newsletter that is only a PDF, an image, or a link
  gets the "couldn't find events" fallback. The drafts say "text of the email rather than
  attachments" for this reason.
- **State is a shared list in KV with no locking** (welcomed senders, use counts, rate-limit
  logs). Friends forwarding minutes apart is fine; many in the same second could lose a
  write (a missed welcome box or miscounted use, not lost mail). Each forward does roughly
  3 to 5 KV writes by my count. Whether Cloudflare's per-second write behavior on a
  single key can bite in a burst is something I could not confirm.
- **Replies to a Scout report go to the Scout, not to you.** No reply-to is set, so a
  friend who hits Reply on a report is emailing `scout@sendtoschedule.com`, which the
  worker will treat as a forward. This also affects the 5th-use "Just reply to this
  email" survey line. Your drafts ask friends to reply to YOUR email instead. I did not
  test this end to end; try replying to a report yourself.

### You must verify yourself (marked "verify")

- [ ] **verify** Gemini API key: free or paid plan, daily and per-minute limits for both
      models, and the worst case of up to 4 calls per forward.
- [ ] **verify** Google's data terms for that key's plan (the site says Scout doesn't
      train models on your data).
- [ ] **verify** Resend plan: monthly and daily sending limit (the code comment says
      100 a day), whether `sendtoschedule.com` is verified, and its SPF/DKIM/DMARC status.
- [ ] **verify** Cloudflare plan: Workers request limits, KV daily write allowance,
      Workers Logs retention.
- [ ] **verify** Deliverability: forward a real newsletter from a second address that is
      not your own Gmail (your address forces the "first time" path every time) and from
      one Apple/iCloud or Outlook address if you have one. Confirm the report lands in the
      inbox, not spam.
- [ ] **verify** Nightly self-test health. It is NOT a GitHub Action: it is a Cloudflare
      scheduled job at 03:00 UTC (`wrangler.jsonc` `triggers.crons`). On a failure it
      emails you with a subject like "nightly self-test FAILED (not a user email)"; on a
      pass it logs `calendar_scout_nightly_regression_passed` to PostHog. Check your
      inbox for the failure subject over the last week and confirm PostHog shows a pass for
      last night. I could not check either.
- [ ] **verify** Not paused right now: confirm `SYSTEM_PAUSED` is clear (any recent
      breaker alert email in your inbox).

What `gh run list` showed (read-only): the five
newest runs are all "Deploy Calendar Scout" (tests plus deploy), all success, newest
Oct 16. That is the code-deploy health, not the nightly self-test. Pushing this draft
file to the repo also triggers that workflow once (it runs on every push to main) and
redeploys the same code.

### The one known gap friends will hit: Google Calendar only

The landing page does not say this anywhere, and neither do the report or welcome emails.
The drafts say it plainly ("it only works with Google Calendar"). A single line on the
homepage would help friends who click through, for example under step 3 or as a FAQ
entry: "The Add to Calendar buttons open Google Calendar." Flagging only; I did not edit
any code, and a homepage text change is the low-risk option (a change to the report email
means redeploying the worker right before a traffic event).

### What friends see if they click through

The email works without any site change. The homepage is still the OLD design (the new
hero is only a preview and has not shipped). Friends will see: "From inbox to calendar in
one tap", the mascot, the hero graphic, the three steps with a copy-the-address button
(`forward@sendtoschedule.com`) and an "Add to Contacts" button, the "What to Scout" cards
(school, sports, medical, home, community, flyers, work), "Why I built this", the privacy
paragraph, four FAQ questions, and a footer with a feedback form link and Buy me a coffee.
Two places still say image/PDF support is "coming soon".

---

## 7. How you'll know if it worked

In PostHog, filter on `is_test_sender = false` (set from your address only, so a second
account of yours counts as a real sender). A few days after sending, then again around
10 days later (Sun Dec 6, if you send Nov 30), look at:

- **Reach**: number of distinct `distinct_id` values on `calendar_scout_email_received`.
  This is the best "how many people tried it" count, because a first-timer whose email
  yields no events never appears in the welcome event.
- **First successes**: count of `calendar_scout_ftux_welcome_sent` (this one only fires
  when at least one event was found).
- **Outcome mix per send**: `calendar_scout_event_extraction_succeeded` vs
  `calendar_scout_no_events_found` vs `calendar_scout_filtered_out_pre_ai` vs
  `calendar_scout_processing_error`. A large share of no-events or filtered-out means
  friends are forwarding the wrong kind of email (PDFs, link-only emails), which tells you
  what to change in the instructions line.
- **Quality**: `eventCount` and `processingTimeMs` on the success event (slow ones over
  90 seconds also email you).
- **Come-back use**: distinct ids with two or more received emails, and
  `calendar_scout_survey_triggered` (someone reached their 5th use).
- **Health**: `calendar_scout_processing_error` volume right after you send, and any
  breaker alert email.

You see counts and salted hashes, never addresses, and that is the point: don't try to
match a hash to a friend. Who it was and what went wrong comes only from replies. Trust
numbers only from the Sep 14 deploy onward (earlier events lack the flag and hash).

Realistic expectations. These are unmeasured guesses, not data. A personal ask like this
often gets a small minority to act: for every 100 friends emailed, maybe 5 to 15 forward
an email, 2 to 6 send you feedback, and 0 to 3 pass it on. Fit narrows it further: the
person needs school or activity emails with the dates written in the message, and a
Google Calendar. Plan the launch checklist for the optimistic end (30 to 60 forwards in a
day or two) even though the likelier outcome is smaller.

---

## 8. Decisions and items for you

1. Privacy wording: use no claim (recommended), or the "only sees what you forward" line
   already in B; stronger lines need the Google and Resend checks first.
2. Keep the Google-Calendar-only sentence in every version, and decide whether to add the
   one-line homepage note before sending.
3. Pick the send plan (canary Wed Nov 25 or Fri Nov 27, wider Mon Nov 30), and whether to
   pre-test with a second address.
4. Run the "verify" boxes in section 6, especially Gemini quota, Resend's sending limit
   and the nightly self-test.
5. Decide about the breaker's same-address limit, and the misleading first-time fallback
   during an outage. Neither was changed.

Not verifiable from here: any dashboard value (Gemini, Resend, Cloudflare plan limits),
whether the nightly self-test passed last night, real delivery to spam vs inbox, how
Google and Resend retain the forwarded text, and how a reply to the Scout is routed in
practice.
