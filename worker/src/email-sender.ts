// Replaces GmailApp.sendEmail(). Outbound-email architecture decision:
//
// MailChannels' free "Workers-only" relay (the historical default answer for this)
// required a domain-lockdown TXT record tied to a Cloudflare account relationship that
// MailChannels shut down to new senders in 2024 — it's not a live option for a domain
// being set up fresh in 2026. Rather than build against a dead-end, this uses Resend:
// a plain HTTPS API (fetch-friendly, no SMTP), a free tier (3,000 emails/mo, 100/day)
// that comfortably covers current Scout volume, and first-class "send from your own
// domain" support once sendtoschedule.com has SPF/DKIM records added (a DNS step,
// deliberately NOT done in this task per the no-DNS-changes boundary).
//
// Needs: RESEND_API_KEY secret (wrangler secret put RESEND_API_KEY) and a verified
// sending domain in the Resend dashboard — both are account-setup steps for Ian,
// listed in the final report's punch list.

import { checkAndRecordSend, describeTripReason } from './circuit-breaker';

export interface SendEmailOptions {
	to: string;
	subject: string;
	html: string;
	fromName?: string;
	replyTo?: string;
}

/**
 * Thrown when the circuit breaker blocks a send instead of letting it go out. Callers
 * that want to react to a trip (e.g. index.ts firing the alert email) can catch this
 * specifically rather than treating it as a generic send failure.
 */
export class CircuitBreakerTrippedError extends Error {
	constructor(public readonly reasonText: string) {
		super(reasonText);
		this.name = 'CircuitBreakerTrippedError';
	}
}

async function postToResend(resendApiKey: string, fromEmail: string, opts: SendEmailOptions): Promise<void> {
	const fromHeader = opts.fromName ? `${opts.fromName} <${fromEmail}>` : fromEmail;

	const res = await fetch('https://api.resend.com/emails', {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${resendApiKey}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			from: fromHeader,
			to: [opts.to],
			subject: opts.subject,
			html: opts.html,
			reply_to: opts.replyTo,
		}),
	});

	if (!res.ok) {
		const text = await res.text().catch(() => '');
		throw new Error(`Resend send failed (${res.status}): ${text}`);
	}
}

/**
 * Normal send path — every outbound email in the product (reports, fallbacks,
 * surveys, error alerts) goes through this, and therefore through the circuit
 * breaker's same-recipient and global rate checks. If a check trips, this throws
 * CircuitBreakerTrippedError instead of sending, and the breaker has already set
 * SYSTEM_PAUSED=true as a side effect (see circuit-breaker.ts).
 *
 * The one deliberate exception is the trip-alert notification itself
 * (sendTripAlertEmail below), which bypasses this guard — otherwise a tripped
 * breaker could suppress the very email that tells Ian it tripped.
 */
export async function sendEmail(kv: KVNamespace, resendApiKey: string, fromEmail: string, opts: SendEmailOptions): Promise<void> {
	const result = await checkAndRecordSend(kv, opts.to);
	if (result.blocked && result.reason) {
		throw new CircuitBreakerTrippedError(describeTripReason(result.reason));
	}
	await postToResend(resendApiKey, fromEmail, opts);
}

/**
 * Sends the "I just paused myself" alert. Deliberately bypasses checkAndRecordSend —
 * this is a single, low-volume, always-important notification to Ian, and gating it
 * behind the same breaker it's reporting on would risk silently swallowing the one
 * email that matters most when something is actually wrong.
 */
export async function sendEmailBypassingBreaker(resendApiKey: string, fromEmail: string, opts: SendEmailOptions): Promise<void> {
	await postToResend(resendApiKey, fromEmail, opts);
}
