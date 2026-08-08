// Ported from Code.js — SIGNATURE, FOOTER_HTML, wrapEmail(), sendReport()'s HTML body,
// sendFallbackEmail()'s HTML body, and the survey email body. All copy and markup
// preserved exactly, including the current live fixes: the blank-subject "Your flyer"
// fallback (handled by the caller, see index.ts emailSubject logic) and the
// "photo of a flyer on a community bulletin board" bullet in the FTUX no-events email.

import type { ScoutEvent } from './types';
import { createCalendarUrl, formatDateWithDay } from './calendar-utils';

export const SIGNATURE = '<p>your calendar scout</p>';

/**
 * Generates a short summary line of found events.
 * Format: "Found N events about [event1], [event2], [event3], and more"
 */
function generateEventSummaryLine(events: ScoutEvent[]): string {
	if (!events || events.length === 0) {
		return 'Found 0 events';
	}

	const eventCount = events.length;
	const eventNames = events
		.slice(0, 3)
		.map((e) => e.Title || 'Untitled')
		.join(', ');

	if (eventCount <= 3) {
		return `Found ${eventCount} event${eventCount === 1 ? '' : 's'} about ${eventNames}`;
	}

	return `Found ${eventCount} events about ${eventNames}, and more`;
}

export const FOOTER_HTML = `
  <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
  <div style="font-size: 13px; color: #888;">
    <p><strong>About the scout</strong><br>
    I am an experimental tool built to help you easily find and add events to your calendar. I am not always perfect, so please check my work.
    <a href="https://forms.gle/687QErQW5soF9mCu8">Report an Error</a> |
    <a href="https://buymeacoffee.com/lionsaga">Buy me a coffee</a></p>
    <p><strong>Privacy</strong><br>
    I process your text, find your dates, and don't store your data.
    <a href="https://sendtoschedule.com/">sendtoschedule.com</a></p>
  </div>
`;

export function wrapEmail(bodyText: string): string {
	return `<div style="font-family: Georgia, serif; color: #333; max-width: 600px; margin: auto; line-height: 1.6;">${bodyText}${SIGNATURE}${FOOTER_HTML}</div>`;
}

export const FEEDBACK_SECTION = `
  <div style="background-color: #F0F8F0; border-left: 4px solid #2E4A2E; padding: 16px; margin: 20px 0; border-radius: 4px; font-size: 14px; color: #333; line-height: 1.6;">
    <p style="margin: 0 0 8px 0;"><strong>Quick feedback?</strong></p>
    <p style="margin: 0 0 4px 0;">• Are you enjoying Scout?</p>
    <p style="margin: 0 0 4px 0;">• Have any dates been wrong?</p>
    <p style="margin: 0 0 0 0;">• Anything you'd like to see?</p>
    <p style="margin: 8px 0 0 0; font-size: 13px; color: #555;">Just reply to this email. I read every message. 🙏</p>
  </div>
`;

export function buildReportEmail(
	events: ScoutEvent[],
	subject: string,
	receivedDate: string,
	isFirstTime: boolean,
	aiSummary: string,
	includeFeedback: boolean = false
): { subject: string; html: string } {
	// Strip email prefixes (Fwd:, Re:, etc.)
	let cleanSubject = subject.replace(/^(Fwd:|Re:|FW:|RE:)\s*/i, '').trim();
	cleanSubject = cleanSubject.replace(/^(Fwd:|Re:|FW:|RE:)\s*/i, '').trim(); // Second pass for nested prefixes like "Fwd: Fwd:"

	const sortedEvents = [...events].sort((a, b) => {
		const da = new Date(String(a.Date).split(' - ')[0]).getTime();
		const db = new Date(String(b.Date).split(' - ')[0]).getTime();
		return (isNaN(da) ? Infinity : da) - (isNaN(db) ? Infinity : db);
	});

	// LEAD: Summary line at the very top
	const summaryLine = generateEventSummaryLine(sortedEvents);
	const summaryLineHtml = `<p style="font-size: 13px; color: #888; margin-bottom: 16px; line-height: 1.6;">${summaryLine}</p>`;

	// WELCOME BOX: Only if first time (moved after summary line)
	let welcomeBoxHtml = '';
	if (isFirstTime) {
		welcomeBoxHtml = `
    <div style="background-color: #F0F8F0; border-left: 4px solid #2E4A2E; padding: 16px; margin-bottom: 20px; border-radius: 4px; font-size: 14px; color: #333; line-height: 1.6;">
      <p style="margin: 0 0 12px 0;"><strong>Welcome to Calendar Scout! Here's how it works:</strong></p>
      <p style="margin: 0 0 8px 0;">✓ No account or sign-up needed. This is completely free.</p>
      <p style="margin: 0 0 8px 0;">✓ We read your email that you forwarded to us</p>
      <p style="margin: 0 0 8px 0;">✓ We found ${sortedEvents.length} events, one tap adds each to your calendar</p>
      <p style="margin: 0 0 16px 0;">✓ We immediately delete your email in our system</p>
      <p style="margin: 0 0 8px 0;"><strong>What we use:</strong> Event dates, times, locations</p>
      <p style="margin: 0 0 8px 0;"><strong>What we don't do:</strong> Store emails, train models, sell data</p>
      <p style="margin: 8px 0 0 0; font-size: 12px; color: #666;">Save us as a contact so you never have to type the address again: <a href="https://sendtoschedule.com/calendar-scout.vcf" style="color: #2E4A2E; text-decoration: underline;">add to contacts</a></p>
      <p style="margin: 4px 0 0 0; font-size: 12px; color: #666;">Learn more: <a href="https://sendtoschedule.com/" style="color: #2E4A2E; text-decoration: underline;">sendtoschedule.com</a></p>
    </div>`;
	}

	// EVENT DETAILS HEADER: "Your events from..."
	const eventDetailsHeader = `<h3 style="font-size: 16px; color: #2E4A2E; margin-bottom: 16px;">Your events from "${cleanSubject}":</h3>`;

	// EVENT CARDS
	let eventCards = '';

	sortedEvents.forEach((event) => {
		const calendarLink = createCalendarUrl(event, cleanSubject, receivedDate);
		const formattedDate = formatDateWithDay(event.Date);
		const timeStr = event.Time ? `· ${event.Time}` : '';
		const locationStr = event.Location
			? `<div style="color:#8A9A8A; font-size:13px; margin-top:2px;"><span style="font-style:italic;">at</span> ${event.Location}</div>`
			: '';
		const descStr = event.Description
			? `<div style="font-size:13px; color:#555; margin: 8px 0 12px;">${event.Description}</div>`
			: `<div style="margin-bottom:12px;"></div>`;
		const isUncertain = event.DateConfidence === 'low';

		if (isUncertain) {
			const warningStr = event.DateNote
				? `<div style="font-size:12px; color:#92600A; margin: 6px 0 4px;">⚠ ${event.DateNote}</div>`
				: '';
			const contextStr = event.DateContext
				? `<div style="font-size:12px; color:#777; border-left: 3px solid #F5C542; padding-left: 10px; margin: 8px 0 12px; font-style: italic;">"${event.DateContext}"</div>`
				: `<div style="margin-bottom:12px;"></div>`;
			eventCards += `
        <div style="background-color: #FFFBF0; border: 1px solid #F5C542; border-radius: 16px; padding: 20px; margin-bottom: 16px;">
          <div style="font-weight: bold; font-size: 17px; color: #1a1a1a;">${event.Title}</div>
          <div style="color: #8A9A8A; font-size: 14px; margin-top: 4px;">${formattedDate} ${timeStr}</div>
          ${locationStr}
          ${warningStr}
          ${contextStr}
          ${descStr}
          <a href="${calendarLink}" style="display: block; background-color: #92600A; color: #ffffff; text-align: center; padding: 14px; text-decoration: none; border-radius: 12px; font-weight: bold;">Add to Calendar (review first)</a>
        </div>`;
		} else {
			eventCards += `
        <div style="background-color: #ffffff; border: 1px solid #E0E7E0; border-radius: 16px; padding: 20px; margin-bottom: 16px;">
          <div style="font-weight: bold; font-size: 17px; color: #1a1a1a;">${event.Title}</div>
          <div style="color: #8A9A8A; font-size: 14px; margin-top: 4px;">${formattedDate} ${timeStr}</div>
          ${locationStr}
          ${descStr}
          <a href="${calendarLink}" style="display: block; background-color: #2E4A2E; color: #ffffff; text-align: center; padding: 14px; text-decoration: none; border-radius: 12px; font-weight: bold;">Add to Calendar</a>
        </div>`;
		}
	});

	const feedbackSection = includeFeedback ? FEEDBACK_SECTION : '';

	// NEW ORDER: Summary → Welcome box → Event details → Event cards → Feedback
	const bodyContent = `
    ${summaryLineHtml}
    ${welcomeBoxHtml}
    ${eventDetailsHeader}
    ${eventCards}
    ${feedbackSection}`;

	return {
		subject: `Scout Report: "${cleanSubject}"`,
		html: wrapEmail(`<div style="background-color: #F3F7F3; padding: 24px; border-radius: 24px;">${bodyContent}</div>`),
	};
}

export function buildFallbackEmail(summary: string, isFirstTime: boolean, originalSubject?: string): { subject: string; html: string } {
	// Strip email prefixes (Fwd:, Re:, etc.)
	const cleanSubject = originalSubject ? originalSubject.replace(/^(Fwd:|Re:|FW:|RE:)\s*/i, '').trim().replace(/^(Fwd:|Re:|FW:|RE:)\s*/i, '').trim() : '';

	let bodyContent = '';
	const responseSubject = cleanSubject
		? `Calendar Scout: Couldn't process "${cleanSubject}"`
		: 'Calendar Scout: No events found';

	if (isFirstTime) {
		bodyContent = `
      <h2 style="font-size: 20px; color: #2E4A2E; margin-bottom: 16px;">Welcome to Calendar Scout!</h2>

      <p style="font-size: 15px; color: #333; margin-bottom: 16px;">
        I didn't find any events in that first email, but that's okay. Let me explain what I do.
      </p>

      <div style="background-color: #F0F8F0; border-left: 4px solid #2E4A2E; padding: 16px; margin-bottom: 20px; border-radius: 4px; font-size: 14px; color: #333; line-height: 1.8;">
        <p style="margin: 0 0 12px 0;"><strong>How it works:</strong></p>
        <p style="margin: 0 0 8px 0;">You forward any email to me (newsletters, flyers, invitations, anything with dates).</p>
        <p style="margin: 0 0 8px 0;">I read it, find the dates and times, and send you a clean summary.</p>
        <p style="margin: 0 0 16px 0;">You click once to add events to your calendar.</p>

        <p style="margin: 12px 0 8px 0;"><strong>I work best with:</strong></p>
        <p style="margin: 0 0 4px 0;">• Long school newsletters with multiple dates</p>
        <p style="margin: 0 0 4px 0;">• Sports practice schedules and tournament brackets</p>
        <p style="margin: 0 0 8px 0;">• Birthday party invitations with times</p>
        <p style="margin: 0 0 8px 0;"><strong>Currently supports text-based emails.</strong> Image/PDF newsletter support coming soon.</p>

        <p style="margin: 12px 0 8px 0;"><strong>Your privacy is protected:</strong></p>
        <p style="margin: 0 0 4px 0;">✓ No account ever needed. Always free to use.</p>
        <p style="margin: 0 0 4px 0;">✓ We read your email that you forward to us</p>
        <p style="margin: 0 0 4px 0;">✓ We immediately delete it from our system</p>
        <p style="margin: 0 0 0 0;">✓ We never store, sell, or train models on your data</p>
      </div>

      <p style="font-size: 14px; color: #666; margin-bottom: 8px;">
        <strong>Ready to try?</strong> Forward a school newsletter or event flyer to me and I'll show you what I can do.
      </p>
      <p style="font-size: 12px; color: #999; margin-bottom: 4px;">
        Save us as a contact so you never have to type the address again: <a href="https://sendtoschedule.com/calendar-scout.vcf" style="color: #2E4A2E; text-decoration: underline;">add to contacts</a>
      </p>
      <p style="font-size: 12px; color: #999;">
        Learn more: <a href="https://sendtoschedule.com/" style="color: #2E4A2E; text-decoration: underline;">sendtoschedule.com</a>
      </p>
    `;
	} else {
		bodyContent = `<p>${summary}</p>`;
	}

	return {
		subject: responseSubject,
		html: wrapEmail(bodyContent),
	};
}

export function buildGmailPermissionDiagnosticEmail(originalSubject: string): { subject: string; html: string } {
	// Strip email prefixes (Fwd:, Re:, etc.)
	const cleanSubject = originalSubject.replace(/^(Fwd:|Re:|FW:|RE:)\s*/i, '').trim().replace(/^(Fwd:|Re:|FW:|RE:)\s*/i, '').trim();

	const bodyContent = `
    <h2 style="font-size: 18px; color: #D97706; margin-bottom: 16px;">⚠️ Gmail Security Blocked Your Attachment</h2>

    <p style="font-size: 14px; color: #333; margin-bottom: 16px;">
      I tried to process your email <strong>"${cleanSubject}"</strong>, but Gmail's security settings blocked my access to the attachment.
    </p>

    <div style="background-color: #FEF3C7; border-left: 4px solid #D97706; padding: 16px; margin-bottom: 20px; border-radius: 4px; font-size: 14px; color: #333; line-height: 1.6;">
      <p style="margin: 0 0 8px 0;"><strong>What's happening:</strong></p>
      <p style="margin: 0 0 8px 0;">
        Gmail limits access to Google Slides, Sheets, Docs, and some other embedded files for security reasons.
        This means I can't read the content inside them.
      </p>

      <p style="margin: 12px 0 8px 0;"><strong>What you can do:</strong></p>
      <p style="margin: 0 0 0 0;">
        Try forwarding the email <strong>without the attachment</strong>, or copy the event details to plain text and include that instead. For now, I work best with text-only emails.
      </p>
    </div>

    <p style="font-size: 13px; color: #666; margin-bottom: 16px;">
      We're working on a better solution for this. Check back at <a href="https://sendtoschedule.com/" style="color: #2E4A2E; text-decoration: underline;">sendtoschedule.com</a> for updates.
    </p>

    <p style="font-size: 12px; color: #999;">
      Questions? <a href="https://forms.gle/687QErQW5soF9mCu8" style="color: #2E4A2E; text-decoration: underline;">Send feedback</a>
    </p>
  `;

	return {
		subject: `Calendar Scout: Couldn't process "${cleanSubject}" (Gmail blocked attachment)`,
		html: wrapEmail(bodyContent),
	};
}

export function buildSurveyEmail(): { subject: string; html: string } {
	const surveyBody = `
    <h2 style="font-size: 18px; color: #2E4A2E; margin-bottom: 16px;">Quick question: How's Calendar Scout working for you?</h2>

    <p style="font-size: 14px; color: #333; margin-bottom: 12px;">
      I noticed you've used Scout 5 times now. I'd love your feedback so I can make it better.
    </p>

    <div style="background-color: #F0F8F0; border-left: 4px solid #2E4A2E; padding: 16px; margin: 16px 0; border-radius: 4px; font-size: 14px; color: #333; line-height: 1.6;">
      <p style="margin: 0 0 8px 0;"><strong>Just reply with:</strong></p>
      <p style="margin: 0 0 4px 0;">• Are you enjoying the Scout?</p>
      <p style="margin: 0 0 4px 0;">• Have any dates been wrong?</p>
      <p style="margin: 0 0 0 0;">• Anything you'd like to see?</p>
    </div>

    <p style="font-size: 14px; color: #333;">
      I read every reply. Thanks for using it! 🙏
    </p>
  `;

	return {
		subject: "How's Calendar Scout working?",
		html: wrapEmail(surveyBody),
	};
}

export function buildAutoReceiptEmail(): { subject: string; html: string } {
	return {
		subject: 'Calendar Scout: Got it!',
		html: wrapEmail(`<p>I'm scouting through your message right now and will send you a summary in just a moment.</p>`),
	};
}

export function buildCircuitBreakerAlertEmail(reasonText: string, pausedAt: string): { subject: string; html: string } {
	const subject = `🛑 Calendar Scout: auto-paused (circuit breaker tripped)`;
	const body = `
Calendar Scout has automatically PAUSED itself. No emails will be sent (and no
inbound mail will be processed) until it's manually resumed.

🛑 Why: ${reasonText}
📅 Time: ${pausedAt}

This is a safety mechanism added after the runaway reply-loop incident on the old
Apps Script version (near-identical emails sent once a minute for 25+ minutes before
being caught manually). It exists specifically so a runaway pattern like that gets
caught automatically instead of relying on someone noticing their inbox.

What to do:
1. Check the Cloudflare Workers Logs for the pattern that tripped this (search for
   "scout_execution" or look at recent Resend sends).
2. Confirm it's actually a runaway/loop and not a legitimate traffic spike.
3. If safe, resume processing with:
   POST /admin/resume  (with the shared admin secret)

Your Calendar Scout (circuit breaker)
`;
	return { subject, html: `<pre style="font-family: monospace; white-space: pre-wrap;">${body}</pre>` };
}

export function buildManualPauseAlertEmail(pausedAt: string): { subject: string; html: string } {
	const subject = `⏸️ Calendar Scout: manually paused`;
	const body = `
Calendar Scout was just paused via the /admin/pause endpoint. No inbound mail will be
processed until it's resumed via POST /admin/resume.

📅 Time: ${pausedAt}

Your Calendar Scout
`;
	return { subject, html: `<pre style="font-family: monospace; white-space: pre-wrap;">${body}</pre>` };
}

/**
 * Alert for the nightly automated parsing regression test (see regression-test.ts).
 * Deliberately styled and subject-lined to be unmistakably an internal self-test,
 * not a real user's email failing — Ian should never have to open this to figure
 * out whether an actual person hit an error.
 */
export function buildRegressionTestAlertEmail(
	failures: { label: string; reason: string }[],
	debugDashboardLink: string
): { subject: string; html: string } {
	const subject = `🌙 Calendar Scout: nightly self-test FAILED (not a user email)`;
	const failureLines = failures.map((f) => `  • ${f.label}\n    → ${f.reason}`).join('\n\n');
	const body = `
This is Calendar Scout's nightly automated regression test, not a real user's
email failing. It runs ${new Date().toISOString().slice(0, 10)} against two fixed
saved sample inputs (one text-only, one image/PDF-only) to catch silent parsing
regressions before a real user hits them.

❌ ${failures.length} of the nightly test case(s) failed:

${failureLines}

What to do:
1. Check the Cloudflare Workers Logs (search "nightly_regression" or "scout_execution")
   for the full error / response.
2. Try the same sample manually if needed: see src/regression-samples.ts for the
   fixed inputs used.
3. This does NOT mean a real user was affected tonight. It means the underlying
   Gemini extraction pipeline may be broken and the NEXT real user could be.

🔍 Execution log: ${debugDashboardLink}

Your Calendar Scout (nightly regression test)
`;
	return { subject, html: `<pre style="font-family: monospace; white-space: pre-wrap;">${body}</pre>` };
}

export function buildErrorAlertEmail(
	status: 'ERROR' | 'SLOW',
	senderEmail: string,
	errorMsg: string,
	processingTimeMs: number,
	debugDashboardLink: string
): { subject: string; html: string } {
	let subject = '';
	let body = '';

	if (status === 'ERROR') {
		subject = `⚠️ Calendar Scout: Error processing email from ${senderEmail}`;
		body = `
Something went wrong while processing an email.

👤 User: ${senderEmail}
❌ Problem: ${errorMsg}
⏱️ Processing Time: ${processingTimeMs}ms (${(processingTimeMs / 1000).toFixed(1)}s)
📅 Time: ${new Date()}

What to do:
This usually happens if the AI service is temporarily down or slow. The email is safely stored upstream.
You can check the execution log to see the pattern of errors.

🔍 Execution log: ${debugDashboardLink}

Your Calendar Scout
`;
	} else {
		subject = `⏱️ Calendar Scout: Slow processing from ${senderEmail}`;
		body = `
An email took longer than expected to process.

👤 User: ${senderEmail}
⏱️ Processing Time: ${processingTimeMs}ms (${(processingTimeMs / 1000).toFixed(1)}s)
📅 Time: ${new Date()}

What to do:
This might indicate the AI service is under load. Monitor the next few emails. If this persists, check the execution log.

🔍 Execution log: ${debugDashboardLink}

Your Calendar Scout
`;
	}

	return { subject, html: `<pre style="font-family: monospace; white-space: pre-wrap;">${body}</pre>` };
}
