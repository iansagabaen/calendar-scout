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

## Cloudflare logs — (in progress)

## Root cause — (in progress)

## The fix — (in progress)

## Tests — (in progress)

## Deploy + verification — (in progress)
