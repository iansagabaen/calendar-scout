// Nightly automated parsing regression test.
//
// Design agreed in projects.md's Calendar Scout backlog ("Nightly automated
// parsing regression test", 2026-07-13): a code-defined Cloudflare Cron Trigger
// (see wrangler.jsonc's `triggers.crons`) runs this every night against two
// FIXED saved sample inputs (see regression-samples.ts) — one text-only, one
// image/PDF-only — through the SAME real parsing pipeline the live email()
// handler uses (callGeminiVisionAI, not a duplicate/mocked copy of it). This
// exists specifically to catch a silent Gemini/prompt regression (e.g. a model
// deprecation, a schema drift, a broken JSON fence) before a real user hits it,
// rather than finding out from a confused email reply.
//
// On success: a normal structured log line via logExecution (debug-log.ts) —
// no email, that would just be nightly noise.
// On failure: the SAME alert-email mechanism used for live production errors
// (sendEmailBypassingBreaker + a dedicated template), clearly labeled as an
// internal self-test so Ian never confuses it with a real user's email breaking.

// Env is declared globally (see types.ts / worker-configuration.d.ts) — no import needed.
import { callGeminiVisionAI } from './gemini';
import { formatDateCleanly, createCalendarUrl } from './calendar-utils';
import type { ScoutEvent } from './types';
import { logExecution } from './debug-log';
import { capture } from './analytics';
import { buildRegressionTestAlertEmail } from './email-templates';
import { sendEmailBypassingBreaker } from './email-sender';
import { REGRESSION_CASES, type RegressionCase } from './regression-samples';

// Synthetic "sender" identity used purely to label log lines / analytics events
// for this internal test, so it's obviously distinguishable from a real user's
// email address in the logs.
const REGRESSION_TEST_IDENTITY = 'nightly-regression-test';

interface CaseResult {
	id: string;
	label: string;
	passed: boolean;
	eventCount: number;
	processingTimeMs: number;
	reason: string; // empty when passed
}

/**
 * Validates that a Gemini result has the shape processEmail() expects to work
 * with downstream (buildReportEmail, createCalendarUrl, etc.) — catches the
 * "response doesn't match expected shape" failure mode, not just "threw" or
 * "zero events".
 */
function validateShape(aiResponse: unknown, minExpectedEvents: number): string | null {
	if (!aiResponse || typeof aiResponse !== 'object') return 'Response was not an object.';
	const events = (aiResponse as any).events;
	if (!Array.isArray(events)) return 'Response had no "events" array.';
	if (events.length < minExpectedEvents) {
		return `Expected at least ${minExpectedEvents} event(s), got ${events.length}.`;
	}
	for (const [i, ev] of events.entries()) {
		if (!ev || typeof ev !== 'object') return `Event[${i}] was not an object.`;
		if (typeof ev.Title !== 'string' || !ev.Title.trim()) return `Event[${i}] missing a Title.`;
		if (typeof ev.Date !== 'string' || !ev.Date.trim()) return `Event[${i}] missing a Date.`;
	}
	return null;
}

const EXPECTED_CALENDAR_URL_PREFIX = 'https://www.google.com/calendar/render?action=TEMPLATE';

/**
 * Pure string check: is `url` a well-formed "Add to Calendar" link? Syntactically
 * valid URL, starts with the expected Google Calendar TEMPLATE base, and has
 * non-empty text/dates/details query params. Split out from validateCalendarUrl()
 * (which calls the real createCalendarUrl()) so it can be unit-tested directly
 * against hand-crafted malformed strings, without needing to find real inputs
 * that trick createCalendarUrl() into producing broken output.
 */
export function checkCalendarUrlWellFormed(url: string, eventLabel = 'event'): string | null {
	let parsed: URL;
	try {
		parsed = new URL(url);
	} catch {
		return `Generated calendar URL for ${eventLabel} is not a syntactically valid URL: ${url}`;
	}

	if (!url.startsWith(EXPECTED_CALENDAR_URL_PREFIX)) {
		return `Generated calendar URL for ${eventLabel} does not start with the expected Google Calendar base ("${EXPECTED_CALENDAR_URL_PREFIX}"): ${url}`;
	}

	for (const key of ['text', 'dates', 'details']) {
		const val = parsed.searchParams.get(key);
		if (!val || !val.trim()) {
			return `Generated calendar URL for ${eventLabel} is missing a non-empty "${key}" param: ${url}`;
		}
	}

	return null;
}

/**
 * Runs a single event through the SAME createCalendarUrl() the live email flow
 * uses to build "Add to Calendar" links, and validates the result is well-formed.
 * This exists because validateShape() only checks the AI's *response* shape —
 * it never confirmed the downstream link Calendar Scout actually hands users
 * is not broken (e.g. an empty details param, or a URL string malformed enough
 * that `new URL()` rejects it).
 */
function validateCalendarUrl(event: ScoutEvent, subject: string, receivedDate: string): string | null {
	let url: string;
	try {
		const result = createCalendarUrl(event, subject, receivedDate);
		if (typeof result !== 'string') {
			// Error case: result.error
			return `createCalendarUrl() returned error for event "${event?.Title}": ${result.error}`;
		}
		url = result;
	} catch (e: any) {
		return `createCalendarUrl() threw for event "${event?.Title}": ${e?.toString?.() || String(e)}`;
	}
	return checkCalendarUrlWellFormed(url, `event "${event.Title}"`);
}

/**
 * Validates the generated calendar link for every event in a response. Returns
 * the first failure reason found, or null if every event's link is well-formed.
 */
function validateCalendarUrls(events: ScoutEvent[], subject: string, receivedDate: string): string | null {
	for (const event of events) {
		const err = validateCalendarUrl(event, subject, receivedDate);
		if (err) return err;
	}
	return null;
}

async function runOneCase(env: Env, testCase: RegressionCase): Promise<CaseResult> {
	const start = Date.now();
	const receivedDate = formatDateCleanly(new Date());
	try {
		const aiResponse = await callGeminiVisionAI(env.GEMINI_API_KEY, testCase.body || testCase.subject, testCase.mediaParts, receivedDate, {
			source: 'nightly_regression',
		});
		const processingTimeMs = Date.now() - start;
		const shapeError = validateShape(aiResponse, testCase.minExpectedEvents);
		if (shapeError) {
			return { id: testCase.id, label: testCase.label, passed: false, eventCount: aiResponse?.events?.length || 0, processingTimeMs, reason: shapeError };
		}

		// Shape is valid — now confirm the actual "Add to Calendar" links this
		// response would produce (same createCalendarUrl() the live email flow
		// uses) are well-formed. A response can pass shape validation and still
		// hand a user a broken link, this is the check that would have caught that.
		const urlError = validateCalendarUrls(aiResponse.events, testCase.subject, receivedDate);
		if (urlError) {
			return { id: testCase.id, label: testCase.label, passed: false, eventCount: aiResponse.events.length, processingTimeMs, reason: urlError };
		}

		return { id: testCase.id, label: testCase.label, passed: true, eventCount: aiResponse.events.length, processingTimeMs, reason: '' };
	} catch (e: any) {
		const processingTimeMs = Date.now() - start;
		const reason = e?.toString?.() || String(e);
		return { id: testCase.id, label: testCase.label, passed: false, eventCount: 0, processingTimeMs, reason };
	}
}

export async function runNightlyRegressionTest(env: Env): Promise<void> {
	const results = await Promise.all(REGRESSION_CASES.map((c) => runOneCase(env, c)));

	for (const r of results) {
		logExecution(`${REGRESSION_TEST_IDENTITY}:${r.id}`, r.passed ? 'SUCCESS' : 'ERROR', r.eventCount, r.reason, r.processingTimeMs);
	}

	const failures = results.filter((r) => !r.passed);

	if (failures.length === 0) {
		await capture(env.POSTHOG_API_KEY, REGRESSION_TEST_IDENTITY, 'calendar_scout_nightly_regression_passed', {
			caseCount: results.length,
			totalEvents: results.reduce((sum, r) => sum + r.eventCount, 0),
		});
		return;
	}

	await capture(env.POSTHOG_API_KEY, REGRESSION_TEST_IDENTITY, 'calendar_scout_nightly_regression_failed', {
		failedCount: failures.length,
		failedIds: failures.map((f) => f.id).join(','),
	});

	try {
		const debugDashboardLink = `https://dash.cloudflare.com/?to=/:account/workers/services/view/calendar-scout-worker/production/observability/logs`;
		const { subject, html } = buildRegressionTestAlertEmail(
			failures.map((f) => ({ label: f.label, reason: f.reason })),
			debugDashboardLink
		);
		// Bypasses the circuit breaker deliberately, same reasoning as the breaker's
		// own trip-alert email: this is a single, low-volume, always-important
		// notification, and gating it behind the same breaker it might need to
		// report around would risk silently swallowing it.
		await sendEmailBypassingBreaker(env.RESEND_API_KEY, env.FROM_EMAIL, { to: env.MY_EMAIL, subject, html });
	} catch (e) {
		console.log('Failed to send nightly regression test failure alert: ' + String(e));
	}
}
