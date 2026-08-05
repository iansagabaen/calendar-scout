// Circuit breaker for outbound email — added after the Apps Script version's runaway
// reply-loop incident (2026-07-17): a bug caused it to scan the whole personal inbox
// instead of a scoped address, which triggered an auto-reply loop with an external
// auto-responder — near-identical "no events found" emails sent once a minute for
// 25+ minutes before being caught by Ian noticing his inbox. Nothing in that system
// detected the runaway pattern automatically.
//
// The Cloudflare Worker architecturally can't have that EXACT bug (Email Routing only
// delivers mail addressed to the Worker's own dedicated address — there's no
// personal-inbox scanning to go wrong). But nothing yet stops some OTHER runaway
// scenario: a bug that causes repeated auto-replies to the same sender, or a
// misconfigured external system replying back and forth with the Worker. This module
// is the defense-in-depth layer for that.
//
// Three mechanisms, all backed by KV:
//   1. Same-recipient rate limit — catches a reply loop with one address.
//   2. Global send-rate cap — catches a broader runaway (many recipients).
//   3. A manual/automatic SYSTEM_PAUSED flag — hard stop, checked first in email().
//
// Design choice: when either rate limit trips, we don't just drop that one email and
// move on — we set SYSTEM_PAUSED so the *whole system* halts until a human resumes it.
// A silently-dropped email is invisible; a paused system with an alert email in Ian's
// inbox is not. Safer default per the task that added this file.

const SAME_RECIPIENT_LOG_PREFIX = 'RATE_LIMIT_RECIPIENT:';
const GLOBAL_SEND_LOG_KEY = 'RATE_LIMIT_GLOBAL_SENDS';
const SYSTEM_PAUSED_KEY = 'SYSTEM_PAUSED';

// Same-recipient: N emails to the same address within this window trips the breaker.
export const SAME_RECIPIENT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
export const SAME_RECIPIENT_THRESHOLD = 3;

// Global: N emails to ANY recipient within this window trips the breaker.
export const GLOBAL_WINDOW_MS = 60 * 60 * 1000; // 1 hour
export const GLOBAL_THRESHOLD = 100;

// KV TTL for the rolling-window logs — a little longer than the window itself so a
// straggler read right at the boundary doesn't miss entries that are about to expire
// anyway; entries older than the window are filtered out in-memory regardless.
const LOG_TTL_SECONDS = 2 * 60 * 60; // 2 hours, comfortably covers both windows

export type TripReason =
	| { kind: 'SAME_RECIPIENT'; recipient: string; count: number }
	| { kind: 'GLOBAL_RATE'; count: number }
	| { kind: 'MANUAL' };

export interface BreakerCheckResult {
	blocked: boolean;
	reason?: TripReason;
}

/**
 * Is the system currently paused? Checked first thing in email(), before any other
 * processing, per the task spec — a true here means "exit immediately."
 */
export async function isPaused(kv: KVNamespace): Promise<boolean> {
	const val = await kv.get(SYSTEM_PAUSED_KEY);
	return val === 'true';
}

export async function setPaused(kv: KVNamespace, paused: boolean): Promise<void> {
	if (paused) {
		await kv.put(SYSTEM_PAUSED_KEY, 'true');
	} else {
		await kv.delete(SYSTEM_PAUSED_KEY);
	}
}

function pruneToWindow(timestamps: number[], windowMs: number, now: number): number[] {
	const cutoff = now - windowMs;
	return timestamps.filter((t) => t > cutoff);
}

/**
 * Call BEFORE sending an email. Checks (in order) the same-recipient limit and the
 * global cap. Does NOT record the send — call recordSend() only after a successful
 * send decision, so a blocked attempt doesn't itself count toward future windows.
 *
 * If either limit would be exceeded, this trips the breaker: sets SYSTEM_PAUSED and
 * returns blocked: true with the reason. Caller is expected to skip the send and
 * (for the first caller to observe the trip) fire the alert email — see
 * maybeSendTripAlert in email-sender.ts's caller (index.ts) or call sendTripAlert
 * directly from wherever the check happens.
 */
export async function checkAndRecordSend(kv: KVNamespace, recipient: string): Promise<BreakerCheckResult> {
	const now = Date.now();

	// Same-recipient check.
	const recipientKey = SAME_RECIPIENT_LOG_PREFIX + recipient.toLowerCase();
	const recipientRaw = await kv.get(recipientKey);
	const recipientLog = pruneToWindow(recipientRaw ? JSON.parse(recipientRaw) : [], SAME_RECIPIENT_WINDOW_MS, now);

	if (recipientLog.length + 1 > SAME_RECIPIENT_THRESHOLD) {
		await setPaused(kv, true);
		return {
			blocked: true,
			reason: { kind: 'SAME_RECIPIENT', recipient, count: recipientLog.length + 1 },
		};
	}

	// Global check.
	const globalRaw = await kv.get(GLOBAL_SEND_LOG_KEY);
	const globalLog = pruneToWindow(globalRaw ? JSON.parse(globalRaw) : [], GLOBAL_WINDOW_MS, now);

	if (globalLog.length + 1 > GLOBAL_THRESHOLD) {
		await setPaused(kv, true);
		return {
			blocked: true,
			reason: { kind: 'GLOBAL_RATE', count: globalLog.length + 1 },
		};
	}

	// Not blocked — record this send in both logs.
	recipientLog.push(now);
	globalLog.push(now);
	await Promise.all([
		kv.put(recipientKey, JSON.stringify(recipientLog), { expirationTtl: LOG_TTL_SECONDS }),
		kv.put(GLOBAL_SEND_LOG_KEY, JSON.stringify(globalLog), { expirationTtl: LOG_TTL_SECONDS }),
	]);

	return { blocked: false };
}

export function describeTripReason(reason: TripReason): string {
	switch (reason.kind) {
		case 'SAME_RECIPIENT':
			return `Paused automatically: sent ${reason.count} emails to ${reason.recipient} within ${
				SAME_RECIPIENT_WINDOW_MS / 60000
			} minutes (limit ${SAME_RECIPIENT_THRESHOLD}), possible reply loop.`;
		case 'GLOBAL_RATE':
			return `Paused automatically: sent ${reason.count} emails total within ${GLOBAL_WINDOW_MS / 60000} minutes (limit ${GLOBAL_THRESHOLD}), possible runaway send loop.`;
		case 'MANUAL':
			return 'Paused manually via the /admin/pause endpoint.';
	}
}
