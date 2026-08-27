// Calendar Scout Worker — Cloudflare Email Routing handler.
//
// Replaces Code.js's startScoutProcess() + processSingleEmail(). Architecture change:
// Apps Script polled Gmail on a timer and pulled up to CONFIG.MAX_THREADS unread
// threads, processing one per run. Cloudflare Email Routing instead invokes this
// Worker's `email()` export once per inbound message, event-driven rather than
// polled — so the search/sort/loop/"one per run" logic collapses into simply
// handling the message we were handed. The MAX_THREADS/newest-first sort no longer
// applies (there's no batch to sort); the dedup check against PROCESSED_IDS is kept
// as a safety net against Cloudflare-side retries delivering the same message twice.

import PostalMime from 'postal-mime';
import type { MediaPart, ScoutEvent } from './types';
import { isAlreadyProcessed, markProcessed, getWelcomedList, addWelcomedUser, trackUsage } from './storage';
import { looksLikeEvent, callGeminiVisionAI } from './gemini';
import { formatDateCleanly, resolveEventTimes } from './calendar-utils';
import { buildReportEmail, buildFallbackEmail, buildErrorAlertEmail, buildCircuitBreakerAlertEmail, buildGmailPermissionDiagnosticEmail } from './email-templates';
import { sendEmail, sendEmailBypassingBreaker, CircuitBreakerTrippedError } from './email-sender';
import { logExecution } from './debug-log';
import { capture } from './analytics';
import { isPaused, setPaused } from './circuit-breaker';
import { handleAdminRequest } from './admin';
import { runNightlyRegressionTest } from './regression-test';

// Alert thresholds, ported from Code.js processSingleEmail().
const SLOW_THRESHOLD_MS = 90_000; // 90 seconds
const SURVEY_AT_USE_COUNT = 5; // Trigger feedback survey at 5th use

function extractEmailAddress(fromStr: string): string {
	// Pulls jane@gmail.com out of "Jane Smith <jane@gmail.com>" or returns as-is.
	const match = fromStr.match(/<([^>]+)>/);
	return match ? match[1].trim() : fromStr.trim();
}

export default {
	async email(message: ForwardableEmailMessage, env: Env, ctx: ExecutionContext): Promise<void> {
		const startTime = Date.now();

		// Circuit breaker: checked FIRST, before any other processing, per the
		// runaway-loop postmortem. If the system is paused (manually via /admin/pause,
		// or automatically by a tripped rate limit), bail out immediately — nothing
		// gets parsed, nothing gets sent, nothing gets marked processed.
		if (await isPaused(env.CALENDAR_SCOUT_KV)) {
			console.log('SYSTEM_PAUSED is set — skipping message, not processing.');
			return;
		}

		// Cloudflare provides a unique per-message identifier via the `Message-ID`
		// header when present; fall back to a composite of from+subject+size if a
		// sender omits it (rare, but seen from some legacy mailers).
		const rawHeaderMessageId = message.headers.get('message-id');
		const messageId = rawHeaderMessageId || `${message.from}:${message.headers.get('subject')}:${message.rawSize}`;

		if (await isAlreadyProcessed(env.CALENDAR_SCOUT_KV, messageId)) {
			console.log(`Duplicate delivery of ${messageId}, skipping.`);
			return;
		}
		await markProcessed(env.CALENDAR_SCOUT_KV, messageId);

		// Do the real work inside waitUntil so PostHog capture calls (fire-and-forget
		// HTTP requests) aren't cut off when the handler's main logic resolves.
		ctx.waitUntil(processEmail(message, env, messageId, startTime));
	},

	// Small admin surface for the circuit breaker: POST /admin/pause and
	// /admin/resume, protected by a shared secret (ADMIN_SECRET, set via
	// `wrangler secret put ADMIN_SECRET`). See admin.ts for the implementation —
	// kept separate from the email-processing logic above.
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		return handleAdminRequest(request, env);
	},

	// Cloudflare Cron Trigger entry point — schedule is code-defined in
	// wrangler.jsonc's `triggers.crons` (deliberately NOT a UI-configured
	// trigger; see regression-test.ts for why). Runs the nightly parsing
	// regression test against two fixed saved samples.
	async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
		ctx.waitUntil(runNightlyRegressionTest(env));
	},
} satisfies ExportedHandler<Env>;

async function processEmail(message: ForwardableEmailMessage, env: Env, messageId: string, startTime: number): Promise<void> {
	const senderEmail = extractEmailAddress(message.from);

	await capture(env.POSTHOG_API_KEY, senderEmail, 'calendar_scout_email_received', { messageId });

	// 1. Parse the raw MIME message (Cloudflare hands us a raw stream, unlike Gmail's
	// pre-parsed message object). postal-mime gives us plain text body + attachments,
	// which is the equivalent of message.getPlainBody() / message.getAttachments().
	const rawArrayBuffer = await streamToArrayBuffer(message.raw, message.rawSize);
	const parsed = await PostalMime.parse(rawArrayBuffer);

	const emailSubject = parsed.subject || 'Your flyer'; // blank-subject fix, preserved
	const emailBody = (parsed.text || '').trim();
	const receivedDate = formatDateCleanly(parsed.date ? new Date(parsed.date) : new Date());

	// DISABLED: Media extraction (images/PDFs) has 0% success rate in manual testing.
	// Process text-only until feature is revived.
	// const mediaParts: MediaPart[] = [];
	// for (const att of parsed.attachments || []) {
	// 	const type = att.mimeType || '';
	// 	if (type.includes('image/') || type.includes('pdf')) {
	// 		mediaParts.push({
	// 			inline_data: {
	// 				mime_type: type,
	// 				data: arrayBufferToBase64(att.content as ArrayBuffer),
	// 			},
	// 		});
	// 	}
	// }
	const mediaParts: MediaPart[] = [];

	// 2. Check FTUX context.
	const welcomedList = await getWelcomedList(env.CALENDAR_SCOUT_KV);
	const isFirstTime = !welcomedList.includes(senderEmail) || (env.DEBUG_FTUX_EMAIL && senderEmail === env.DEBUG_FTUX_EMAIL);

	// 3. Pre-filter: skip obvious non-events before burning an API call.
	if (!looksLikeEvent(emailBody, emailSubject, mediaParts)) {
		console.log('Pre-filter: no event signals found, skipping AI call.');
		const processingTime = Date.now() - startTime;
		logExecution(senderEmail, 'FILTERED_OUT', 0, 'Pre-filter: no event signals', processingTime);
		await capture(env.POSTHOG_API_KEY, senderEmail, 'calendar_scout_filtered_out_pre_ai', { processingTimeMs: processingTime });

		// Detect Gmail permission issue: empty body but attachments present
		const hasAttachments = mediaParts.length > 0;
		const hasNoBody = emailBody.length === 0;

		if (hasNoBody && hasAttachments) {
			console.log('Gmail permission issue detected: empty body with attachments.');
			await sendGmailDiagnosticGuarded(env, senderEmail, emailSubject);
		} else {
			await sendFallbackGuarded(env, senderEmail, "I couldn't find any events or dates in that email.", isFirstTime, emailSubject);
		}
		return;
	}

	// 4. Call AI.
	const aiResponse = await callGeminiVisionAI(env.GEMINI_API_KEY, emailBody || emailSubject, mediaParts, receivedDate, {
		source: 'production',
	});

	// 5. Route response.
	try {
		if (aiResponse.events && aiResponse.events.length > 0) {
			// AM/PM safety net: for any event Gemini left with a bare time (no am/pm),
			// try the deterministic keyword rules against the email context. Any suffix
			// added here (or by Gemini) is surfaced in the report as "(inferred from
			// context)" — never applied silently. Times that still can't be resolved
			// stay bare and hit the existing ⚠️ ambiguous-time error.
			resolveEventTimes(aiResponse.events, { subject: emailSubject, body: emailBody });

			const usageCount = await trackUsage(env.CALENDAR_SCOUT_KV, senderEmail);
			const shouldIncludeFeedback = usageCount === SURVEY_AT_USE_COUNT;

			await sendReport(env, senderEmail, aiResponse.events, emailSubject, receivedDate, isFirstTime, aiResponse.summary, shouldIncludeFeedback);

			if (shouldIncludeFeedback) {
				await capture(env.POSTHOG_API_KEY, senderEmail, 'calendar_scout_survey_triggered', {});
			}

			const processingTime = Date.now() - startTime;
			logExecution(senderEmail, 'SUCCESS', aiResponse.events.length, '', processingTime);
			await capture(env.POSTHOG_API_KEY, senderEmail, 'calendar_scout_event_extraction_succeeded', {
				eventCount: aiResponse.events.length,
				processingTimeMs: processingTime,
				isFirstTime,
			});

			// Alert if processing was slow.
			if (processingTime > SLOW_THRESHOLD_MS) {
				await sendErrorAlert(env, senderEmail, 'SLOW', '', processingTime);
			}

			if (isFirstTime) {
				await addWelcomedUser(env.CALENDAR_SCOUT_KV, senderEmail, welcomedList);
				await capture(env.POSTHOG_API_KEY, senderEmail, 'calendar_scout_ftux_welcome_sent', {});
			}
		} else {
			const processingTime = Date.now() - startTime;
			logExecution(senderEmail, 'NO_EVENTS', 0, aiResponse.summary || 'No events found', processingTime);
			await capture(env.POSTHOG_API_KEY, senderEmail, 'calendar_scout_no_events_found', {
				processingTimeMs: processingTime,
				summary: aiResponse.summary,
			});
			await sendFallbackGuarded(env, senderEmail, aiResponse.summary, isFirstTime, emailSubject);
		}
	} catch (e: any) {
		if (e instanceof CircuitBreakerTrippedError) {
			// Already handled (breaker paused the system + alert fired) inside the
			// sendReport call below — nothing further to do here.
			console.log('Circuit breaker tripped while sending report: ' + e.message);
			return;
		}
		const processingTime = Date.now() - startTime;
		const errMsg = e?.toString?.() || String(e);
		logExecution(senderEmail, 'ERROR', 0, errMsg, processingTime);
		await capture(env.POSTHOG_API_KEY, senderEmail, 'calendar_scout_processing_error', { processingTimeMs: processingTime, error: errMsg });
		await sendErrorAlert(env, senderEmail, 'ERROR', errMsg, processingTime);
		console.log('Send failed for ' + senderEmail + ': ' + errMsg);
	}
}

/**
 * Wraps a circuit-breaker-guarded send: on a trip, fires the trip-alert email (which
 * itself bypasses the breaker) and swallows the error so callers in the "no events
 * found" / pre-filter paths don't need their own try/catch.
 */
async function handleBreakerTrip(env: Env, e: CircuitBreakerTrippedError): Promise<void> {
	console.log('Circuit breaker tripped: ' + e.message);
	const pausedAt = new Date().toISOString();
	const { subject, html } = buildCircuitBreakerAlertEmail(e.reasonText, pausedAt);
	try {
		await sendEmailBypassingBreaker(env.RESEND_API_KEY, env.FROM_EMAIL, { to: env.MY_EMAIL, subject, html });
	} catch (alertErr) {
		console.log('Failed to send circuit breaker trip alert: ' + String(alertErr));
	}
}

async function sendFallbackGuarded(env: Env, recipient: string, summary: string, isFirstTime: boolean, originalSubject?: string): Promise<void> {
	try {
		await sendFallback(env, recipient, summary, isFirstTime, originalSubject);
	} catch (e: any) {
		if (e instanceof CircuitBreakerTrippedError) {
			await handleBreakerTrip(env, e);
			return;
		}
		throw e;
	}
}

async function sendGmailDiagnosticGuarded(env: Env, recipient: string, originalSubject: string): Promise<void> {
	try {
		await sendGmailDiagnostic(env, recipient, originalSubject);
	} catch (e: any) {
		if (e instanceof CircuitBreakerTrippedError) {
			await handleBreakerTrip(env, e);
			return;
		}
		throw e;
	}
}

async function sendReport(
	env: Env,
	recipient: string,
	events: ScoutEvent[],
	subject: string,
	receivedDate: string,
	isFirstTime: boolean,
	aiSummary: string,
	includeFeedback: boolean = false
): Promise<void> {
	const { subject: emailSubject, html } = buildReportEmail(events, subject, receivedDate, isFirstTime, aiSummary, includeFeedback);
	try {
		await sendEmail(env.CALENDAR_SCOUT_KV, env.RESEND_API_KEY, env.FROM_EMAIL, {
			to: recipient,
			subject: emailSubject,
			html,
			fromName: env.DISPLAY_NAME,
		});
	} catch (e: any) {
		if (e instanceof CircuitBreakerTrippedError) {
			await handleBreakerTrip(env, e);
			return;
		}
		throw e;
	}
}

async function sendFallback(env: Env, recipient: string, summary: string, isFirstTime: boolean, originalSubject?: string): Promise<void> {
	const { subject, html } = buildFallbackEmail(summary, isFirstTime, originalSubject);
	await sendEmail(env.CALENDAR_SCOUT_KV, env.RESEND_API_KEY, env.FROM_EMAIL, { to: recipient, subject, html, fromName: env.DISPLAY_NAME });
}

async function sendGmailDiagnostic(env: Env, recipient: string, originalSubject: string): Promise<void> {
	const { subject, html } = buildGmailPermissionDiagnosticEmail(originalSubject);
	await sendEmail(env.CALENDAR_SCOUT_KV, env.RESEND_API_KEY, env.FROM_EMAIL, { to: recipient, subject, html, fromName: env.DISPLAY_NAME });
}


async function sendErrorAlert(env: Env, senderEmail: string, status: 'ERROR' | 'SLOW', errorMsg: string, processingTimeMs: number): Promise<void> {
	try {
		// Replaces the Google Sheet link with the Cloudflare dashboard's Worker Logs view.
		const debugDashboardLink = `https://dash.cloudflare.com/?to=/:account/workers/services/view/calendar-scout-worker/production/observability/logs`;
		const { subject, html } = buildErrorAlertEmail(status, senderEmail, errorMsg, processingTimeMs, debugDashboardLink);
		await sendEmail(env.CALENDAR_SCOUT_KV, env.RESEND_API_KEY, env.FROM_EMAIL, { to: env.MY_EMAIL, subject, html });
	} catch (e) {
		if (e instanceof CircuitBreakerTrippedError) {
			await handleBreakerTrip(env, e);
			return;
		}
		console.log('Alert email failed: ' + String(e));
	}
}

async function streamToArrayBuffer(stream: ReadableStream<Uint8Array>, size: number): Promise<ArrayBuffer> {
	const reader = stream.getReader();
	const result = new Uint8Array(size);
	let offset = 0;
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		result.set(value, offset);
		offset += value.length;
	}
	return result.buffer;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
	const bytes = new Uint8Array(buffer);
	let binary = '';
	const chunkSize = 0x8000;
	for (let i = 0; i < bytes.length; i += chunkSize) {
		binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
	}
	return btoa(binary);
}
