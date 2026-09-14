---
name: Sender Identity Investigation & Privacy-Safe FTUX Instrumentation
description: Root cause of why all 9 ftux_welcome_sent events resolve to Ian's own identity in PostHog (a debug override, not a distinct_id bug), plus new salted-hash + is_test_sender instrumentation so future events can tell "was this someone other than me" without ever storing a raw sender email in PostHog
type: investigation
---

# Sender Identity Investigation & Privacy-Safe FTUX Instrumentation — 2026-09-14

## The question

Last week's open question: are Calendar Scout's first-time-sender ("FTUX")
welcomes real parents finding it organically, or Ian testing? All 9
`ftux_welcome_sent` events in the last two weeks were logged under what
looked like a single identity tied to Ian's own account — consistent with
either "it's all Ian" or "the app logs everything under the same identity
regardless of sender" (a possible bug). This decides whether Ian cold-recruits
5–8 more parents, or starts by interviewing people who already showed up.

## Step 1 — Read the code (don't guess)

`worker/src/analytics.ts`'s `capture()` takes `distinctId` as a plain
parameter and forwards it verbatim as PostHog's `distinct_id` — no
transformation, no hardcoded value:

```ts
export async function capture(
	posthogApiKey: string,
	distinctId: string,
	event: ScoutAnalyticsEvent,
	properties: CaptureProps = {}
): Promise<void> {
	...
	body: JSON.stringify({
		api_key: posthogApiKey,
		event,
		distinct_id: distinctId,
		...
```

`worker/src/index.ts` computes the sender fresh, per request, from the actual
inbound message, and passes it straight through to every `capture()` call
(including the FTUX one) with no interception or overwrite by `env.MY_EMAIL`
anywhere on that path:

```ts
const senderEmail = extractEmailAddress(message.from);   // line 83
...
await capture(env.POSTHOG_API_KEY, senderEmail, 'calendar_scout_ftux_welcome_sent', {});  // line 176
```

So `distinctId` is NOT hardcoded — it is the real per-message sender address.
That already argues against a "bug forces one identity" theory.

But one line up is the actual mechanism worth flagging:

```ts
// line 115
const isFirstTime = !welcomedList.includes(senderEmail) ||
	(env.DEBUG_FTUX_EMAIL && senderEmail === env.DEBUG_FTUX_EMAIL);
```

`wrangler.jsonc` sets both `MY_EMAIL` and `DEBUG_FTUX_EMAIL` to
`iansagabaen@gmail.com` (plain vars, present since this Worker's very first
commit — `git log -S"DEBUG_FTUX_EMAIL"` shows it was already in the file the
day Calendar Scout was reorganized into `projects/calendar-scout/`, i.e. it
predates this investigation by weeks and was carried over from the original
Apps Script `Code.js`). The effect: for Ian's own address specifically,
`isFirstTime` is forced `true` on **every** send, regardless of whether he's
already on the welcomed list. Every successful test send from Ian's own
inbox re-fires `ftux_welcome_sent` under his own identity. This is a
deliberate (if easy to forget) debugging convenience — it lets Ian re-test
the first-time-user flow repeatedly without having to purge the KV
`WELCOMED_USERS` list by hand — not a defect in the analytics pipe.

`grep -rn 'MY_EMAIL\|DISPLAY_NAME\|FROM_EMAIL\|senderEmail\|mailFrom\|distinctId\|distinct_id\|DEBUG_FTUX_EMAIL' worker/src/`
confirmed there is no other place where `senderEmail` gets shadowed or
swapped for a constant before reaching `capture()`.

## Step 2 — Ground truth from PostHog (masked)

Queried `calendar_scout_ftux_welcome_sent` for the trailing 14 days via
`scripts/posthog-pull.mjs --query=... --json` against project 519942:

| distinct_id (masked) | count | notes |
|---|---|---|
| `ian***@gmail.com` | 9 / 9 | identical geoip (same IP, Chicago-region Cloudflare edge) on every event |

All 9 events are **the same literal address** — not merely "resolve to Ian"
via some indirect mapping, but the literal string `iansagabaen@gmail.com` on
every row.

Compared against `calendar_scout_email_received` for the same window, grouped
by `distinct_id` — this event type has no `DEBUG_FTUX_EMAIL` special-casing,
so it's the clean "who actually emailed" signal:

| distinct_id (masked) | count |
|---|---|
| `ian***@gmail.com` | 9 |
| `cna***@gmail.com` | 1 |

This is the key falsification test: **`distinct_id` does vary across senders**
when a different sender is present. Cindy Nakasuji's one email in the window
shows up under her own address, not Ian's. If the bug theory were correct
(identity forced/hardcoded regardless of sender), her `email_received` event
would also show `ian***@gmail.com`. It doesn't — so the `distinct_id`
mechanism itself is sound.

Pulled Cindy's full event trail for the window:

| event | distinct_id (masked) |
|---|---|
| `calendar_scout_email_received` | `cna***@gmail.com` |
| `calendar_scout_no_events_found` | `cna***@gmail.com` |

Her single email did not contain anything Gemini recognized as an event
(summary: "I hit a snag" / no-events fallback), so it never reached the
`aiResponse.events.length > 0` branch in `index.ts` — the **only** branch
that calls `addWelcomedUser` + captures `ftux_welcome_sent`. She got a
"couldn't find any events" reply, not a welcome. Nothing about identity
tracking kept her out of the FTUX funnel; a failed extraction did.

## Step 3 — Verdict

**Genuine, not a bug.** All 9 `ftux_welcome_sent` events in the last two
weeks are literally Ian's own address, confirmed by identical geoip on every
row and by the fact that a real second sender (Cindy) shows up correctly
under her own distinct_id elsewhere in the same dataset. The repeat count (9,
not 1) is explained by the `DEBUG_FTUX_EMAIL` override that re-arms
`isFirstTime` for Ian's address on every send — a self-inflicted testing
artifact, not organic re-discovery and not a tracking defect.

Cindy Nakasuji — the one non-Ian sender who used the product in this window —
never got a welcome message because her email didn't extract any events, not
because of anything wrong with sender identification.

**Bottom line for Ian's actual question:** zero confirmed non-Ian FTUX
completions in the last two weeks. Nobody outside Ian has been welcomed by
the product yet. Treat this as "no organic traction observed" and proceed on
that basis — cold-recruiting is the honest next move, not interviewing people
who "already showed up," because functionally nobody but Ian has.

## Step 4 — Instrumentation design (privacy-conscious)

Even though no `distinct_id` bug was found, the underlying practice — using
the raw sender email as PostHog's `distinct_id` — sits uneasily next to
Calendar Scout's own pitch ("we don't store your data"). This is also the
root reason last week's question was hard to answer at all: nothing in
PostHog said "this was Ian" versus "this was a stranger" without inspecting
the literal address by eye.

Design, before touching code:

1. **Never send a raw sender email to PostHog again.** Replace the
   email-as-`distinct_id` pattern with a **salted one-way hash**:
   `SHA-256(senderEmail.trim().toLowerCase() + SENDER_HASH_SALT)`, truncated
   to 12 hex characters, computed with Web Crypto (`crypto.subtle.digest`,
   built into the Workers runtime — no new dependency). This still gives
   Ian a stable per-sender identity for funnels/repeat-vs-new counting, but
   it is not reversible to an email without the salt (a new Cloudflare
   secret, `SENDER_HASH_SALT`, never logged) and brute-forcing every
   possible email address against it.

2. **A boolean `is_test_sender` computed BEFORE hashing.** A new env var
   `TEST_SENDER_EMAILS` (comma-separated, case-insensitive; defaults to
   `env.MY_EMAIL` alone if unset) is checked against the real `senderEmail`
   first. The result — `true`/`false`, never the address itself — is
   attached as an event property on every `calendar_scout_*` capture. Ian
   can now filter PostHog by `is_test_sender = false` to see only
   non-Ian activity, without that view ever surfacing which real address
   triggered it.

3. **Where the hash and flag get computed**: once per `processEmail()`
   invocation in `index.ts`, right where `senderEmail` is already computed,
   then threaded through to every existing `capture()` call alongside the
   existing properties.

4. **This does not retroactively fix the historical 9 events.** PostHog data
   already captured (raw email as `distinct_id`, no `is_test_sender`
   property) can't be un-captured or reinterpreted after the fact — the
   hash/flag only apply going forward. Ian should treat all
   `ftux_welcome_sent` / other `calendar_scout_*` history **before this
   deploy** as "known to include the DEBUG_FTUX_EMAIL testing artifact and
   not distinguishable from real traffic by identity alone" — i.e.
   inconclusive on its own terms (this doc's Step 2/3 analysis already
   settled the historical question by other means: geoip + cross-referencing
   `email_received`). From this deploy's Version ID onward (recorded below),
   new `calendar_scout_*` events carry `is_test_sender` and a salted hash,
   and can be trusted directly by filtering `is_test_sender = false`.

5. **Consistent with "we don't store your data.**" Arguably this is a net
   improvement on the status quo regardless of the bug verdict: moving from
   "raw email address as the identity PostHog holds" to "salted hash + a
   boolean" is strictly less data exposure, whether or not a defect was ever
   present.

## Step 5 — Implementation

`worker/src/analytics.ts` — added two pure functions:

```ts
export async function hashSenderEmail(senderEmail: string, salt: string): Promise<string> {
	const normalized = senderEmail.trim().toLowerCase();
	const data = new TextEncoder().encode(normalized + salt);
	const digestBuffer = await crypto.subtle.digest('SHA-256', data);
	const hex = Array.from(new Uint8Array(digestBuffer))
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
	return hex.slice(0, 12);
}

export function isTestSender(senderEmail: string, testSenderEmailsCsv: string | undefined): boolean {
	const normalized = senderEmail.trim().toLowerCase();
	const list = (testSenderEmailsCsv || '')
		.split(',')
		.map((s) => s.trim().toLowerCase())
		.filter(Boolean);
	return list.includes(normalized);
}
```

`worker/src/index.ts` — in `processEmail()`, right after `senderEmail` is
computed:

```ts
const isTestSenderFlag = isTestSender(senderEmail, env.TEST_SENDER_EMAILS || env.MY_EMAIL);
const senderHash = await hashSenderEmail(senderEmail, env.SENDER_HASH_SALT);
```

Every existing `capture(env.POSTHOG_API_KEY, senderEmail, ...)` call in this
file now passes `senderHash` instead of `senderEmail` for `distinct_id`, and
every properties object gains `is_test_sender: isTestSenderFlag`. This
touches all 8 `calendar_scout_*` capture call sites in `index.ts` (not just
`ftux_welcome_sent`), per the "ideally the other lifecycle events too" design
goal — consistent filtering across the whole funnel, not just FTUX.

New env vars, both treated as Cloudflare secrets (following this repo's
existing convention that anything not meant to be visible in `wrangler.jsonc`
goes through `.dev.vars` locally / `wrangler secret put` in production — the
same pattern already used for `GEMINI_API_KEY`, `RESEND_API_KEY`,
`POSTHOG_API_KEY`, `ADMIN_SECRET`):

- `SENDER_HASH_SALT` — random hex string (`openssl rand -hex 32`), never
  committed, never logged.
- `TEST_SENDER_EMAILS` — comma-separated allowlist, defaults to `MY_EMAIL`
  if unset. Treated as a secret out of caution (task guidance: "lean toward
  secret since it's still an email address"), even though `MY_EMAIL` and
  `DEBUG_FTUX_EMAIL` are currently plain `vars` in `wrangler.jsonc` — this is
  a slightly stricter bar for new instrumentation than the pre-existing vars.

`worker/.dev.vars.example` (tracked) documents both new vars with
placeholders, matching the existing comment style; `worker/.dev.vars`
(gitignored) got local dev placeholder values so `npm test` /
`wrangler dev` keep working.

## Step 6 — Tests

Added to the worker's `test/` suite (`analytics.spec.ts`, new file):

- `hashSenderEmail`: deterministic for the same input + salt; different
  output for a different email; different output for a different salt (i.e.
  the salt is load-bearing, not decorative); output is a 12-hex-char string
  with no way back to the email without the salt (asserted indirectly: two
  different emails colliding is not something a unit test can prove
  impossible, so the test asserts the properties that matter — determinism
  and salt-sensitivity — rather than claiming irreversibility itself, which
  is a property of SHA-256 not of this code).
- `isTestSender`: true when the sender is in the allowlist (single-entry and
  multi-entry CSV, case-insensitive, whitespace-tolerant), false otherwise,
  false on an empty/undefined allowlist.
- Integration-style: a "test" sender and a "non-test" sender each produce a
  captured event with the expected `is_test_sender` value and with two
  different (but each internally consistent across repeated calls) hashed
  distinct_ids.

Full worker suite before this change: **129 passing / 6 files**.
After: **141 passing / 7 files** (new `test/analytics.spec.ts`, 12 tests: 5
`hashSenderEmail` unit tests, 5 `isTestSender` unit tests, 2 full-`email()`-
handler integration tests covering the test-sender-vs-real-sender distinction
and the `TEST_SENDER_EMAILS`-unset-defaults-to-`MY_EMAIL` path).

`npx tsc --noEmit`: only the known pre-existing `src/test.ts(128,4)` error,
unchanged by this work.

## Step 7 — Deploy

`SENDER_HASH_SALT` (random, `openssl rand -hex 32`, piped directly into
`wrangler secret put` — never echoed, printed, or written to any file) and
`TEST_SENDER_EMAILS` (`iansagabaen@gmail.com`) were both set as Cloudflare
Worker secrets. Commit, push, and deploy details are in the final report for
this task.

## What Ian should watch for going forward

- After roughly a week of real traffic, filter PostHog for
  `calendar_scout_ftux_welcome_sent` with `is_test_sender = false`. Any row
  there is, by construction, not Ian — a genuine outside first-time welcome,
  identified only by a salted hash, never a raw address.
- Trust `is_test_sender` / hashed-distinct_id data only from this deploy's
  Version ID onward. Anything before it should be read the way this doc
  reads it — by cross-referencing event types and geoip by hand — not by
  filtering on a property that didn't exist yet.
- The `DEBUG_FTUX_EMAIL` override is left in place (it's a legitimate testing
  convenience — repeatedly exercising the FTUX flow without hand-editing the
  KV welcomed-list). `is_test_sender` is what makes its side effects
  filterable, rather than removing the convenience itself.
