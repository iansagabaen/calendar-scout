// Product analytics per CLAUDE.md Section 9 ("Product Instrumentation Standard"):
// every user-facing app ships with usage/traffic analytics + feedback capture from
// the start. This is distinct from execution logging (see debug-log.ts) — these are
// named product events for understanding usage patterns, not an operational trace.
//
// Uses PostHog's HTTP capture API directly (no SDK needed — Workers' fetch-based
// runtime makes a raw API call simpler and lighter than bundling posthog-node, which
// assumes a Node server process/background flushing model that doesn't fit a
// request-scoped Worker invocation well).

const POSTHOG_HOST = 'https://us.i.posthog.com';

// Event names are prefixed with `calendar_scout_` because this Worker shares a
// PostHog project ("Default project", org Consaga) with other apps — the prefix
// is what lets Calendar Scout's events be filtered out from the rest in shared
// insights/dashboards.
export type ScoutAnalyticsEvent =
	| 'calendar_scout_email_received'
	| 'calendar_scout_event_extraction_succeeded'
	| 'calendar_scout_no_events_found'
	| 'calendar_scout_filtered_out_pre_ai'
	| 'calendar_scout_processing_error'
	| 'calendar_scout_ftux_welcome_sent'
	| 'calendar_scout_survey_triggered'
	| 'calendar_scout_nightly_regression_passed'
	| 'calendar_scout_nightly_regression_failed';

interface CaptureProps {
	[key: string]: string | number | boolean | undefined;
}

/**
 * Fire-and-forget style capture (caller should still await it inside
 * ctx.waitUntil() so it doesn't get cut off when the email() handler returns —
 * see index.ts). Distinct-id is the sender's email so per-user funnels work,
 * consistent with how the existing USER_USAGE_COUNT tracking is keyed.
 */
export async function capture(
	posthogApiKey: string,
	distinctId: string,
	event: ScoutAnalyticsEvent,
	properties: CaptureProps = {}
): Promise<void> {
	if (!posthogApiKey) {
		console.log(`[analytics disabled, no key] ${event}`, properties);
		return;
	}
	try {
		await fetch(`${POSTHOG_HOST}/i/v0/e/`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				api_key: posthogApiKey,
				event,
				distinct_id: distinctId,
				properties: { ...properties, $lib: 'calendar-scout-worker' },
				timestamp: new Date().toISOString(),
			}),
		});
	} catch (e) {
		// Analytics must never break the email pipeline.
		console.log('PostHog capture failed: ' + String(e));
	}
}

// ─── Privacy-conscious sender identity (2026-09-14) ────────────────────────
//
// Investigation (research/2026-09-14-sender-identity-instrumentation.md):
// distinct_id was already the real per-request sender address, not a bug —
// but that means PostHog was holding raw sender emails, which sits uneasily
// next to Calendar Scout's own "we don't store your data" pitch, and it made
// "was this someone other than me" impossible to answer without eyeballing
// addresses by hand. From here on, capture() calls should pass a salted hash
// as distinct_id instead of the raw email, plus an is_test_sender boolean —
// never the address itself.

/**
 * One-way, salted identity for PostHog: SHA-256(lowercased email + salt),
 * truncated to 12 hex chars. Deterministic for the same (email, salt) pair —
 * so repeat-vs-new sender counting still works — but not reversible to an
 * email without the salt (a Cloudflare secret, never logged) and brute-force.
 * Uses Web Crypto (`crypto.subtle`), which is available in the Workers
 * runtime with no extra dependency.
 */
export async function hashSenderEmail(senderEmail: string, salt: string): Promise<string> {
	const normalized = senderEmail.trim().toLowerCase();
	const data = new TextEncoder().encode(normalized + salt);
	const digestBuffer = await crypto.subtle.digest('SHA-256', data);
	const hex = Array.from(new Uint8Array(digestBuffer))
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
	return hex.slice(0, 12);
}

/**
 * Checked against the raw sender email BEFORE hashing, so the resulting
 * true/false can be attached as an event property without ever telling
 * PostHog which address it was. `testSenderEmailsCsv` is comma-separated and
 * matched case-insensitively; callers should pass `env.TEST_SENDER_EMAILS ||
 * env.MY_EMAIL` so this still works before TEST_SENDER_EMAILS is set.
 */
export function isTestSender(senderEmail: string, testSenderEmailsCsv: string | undefined): boolean {
	const normalized = senderEmail.trim().toLowerCase();
	const list = (testSenderEmailsCsv || '')
		.split(',')
		.map((s) => s.trim().toLowerCase())
		.filter(Boolean);
	return list.includes(normalized);
}
