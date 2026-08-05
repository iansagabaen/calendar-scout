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
