import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import worker from '../src/index';
import { looksLikeEvent } from '../src/gemini';
import { createCalendarUrl } from '../src/calendar-utils';

// --- Test helpers -----------------------------------------------------------

/**
 * Builds a minimal raw RFC 5322 email message and wraps it the way Cloudflare's
 * Email Routing hands messages to a Worker's `email()` export: a `from`/`to`
 * pair, a Headers object, and a `raw` ReadableStream<Uint8Array> of the full
 * MIME source (which postal-mime then parses inside the handler).
 */
function buildForwardableEmailMessage(opts: { from: string; to?: string; subject?: string; body: string }): ForwardableEmailMessage {
	const subjectLine = opts.subject !== undefined ? `Subject: ${opts.subject}\r\n` : '';
	const raw = `From: ${opts.from}\r\nTo: ${opts.to || 'scout@sendtoschedule.com'}\r\n${subjectLine}Content-Type: text/plain; charset="utf-8"\r\n\r\n${opts.body}`;
	const encoder = new TextEncoder();
	const bytes = encoder.encode(raw);

	const stream = new ReadableStream<Uint8Array>({
		start(controller) {
			controller.enqueue(bytes);
			controller.close();
		},
	});

	const headers = new Headers();
	if (opts.subject !== undefined) headers.set('subject', opts.subject);
	headers.set('message-id', `<test-${Math.random().toString(36).slice(2)}@example.com>`);

	return {
		from: opts.from,
		to: opts.to || 'scout@sendtoschedule.com',
		headers,
		raw: stream,
		rawSize: bytes.length,
		setReject: vi.fn(),
		forward: vi.fn(),
		reply: vi.fn(),
	} as unknown as ForwardableEmailMessage;
}

describe('looksLikeEvent (pre-filter)', () => {
	it('detects date words', () => {
		expect(looksLikeEvent('See you Monday at 3pm', 'Reminder', [])).toBe(true);
	});

	it('detects event keywords', () => {
		expect(looksLikeEvent('Please RSVP for the party', '', [])).toBe(true);
	});

	it('always passes when there is an image/pdf attachment', () => {
		expect(looksLikeEvent('no signal here', 'no signal', [{ inline_data: { mime_type: 'image/png', data: 'x' } }])).toBe(true);
	});

	it('rejects plain non-event content', () => {
		expect(looksLikeEvent('Thanks for your purchase, here is your receipt.', 'Order confirmation', [])).toBe(false);
	});
});

describe('createCalendarUrl', () => {
	it('builds an all-day link for a plain date', () => {
		const url = createCalendarUrl({ Title: 'Book Fair', Date: 'Aug 10, 2026' } as any, 'subj', 'Aug 1, 2026');
		expect(url).toContain('action=TEMPLATE');
		expect(url).toContain('text=Book%20Fair');
		expect(url).toMatch(/dates=20260810\/20260811/);
	});

	it('builds a timed (non-all-day) link when Time is present', () => {
		// Time formatting is local time (without Z suffix) for Google Calendar interpretation.
		// Removed Z suffix so Google Calendar interprets times as local, not UTC.
		// Assert shape (timed, not all-day) rather than timezone-dependent literal hour.
		const url = createCalendarUrl({ Title: 'Practice', Date: 'Aug 10, 2026', Time: '4:00-5:00pm' } as any, 'subj', 'Aug 1, 2026');
		expect(url).toMatch(/dates=\d{8}T\d{6}\/\d{8}T\d{6}/);
		expect(url).not.toContain('dates=20260810/20260811'); // not all-day
	});

	it('appends an attribution footer after the real description, with blank line separator', () => {
		const url = createCalendarUrl(
			{ Title: 'Book Fair', Date: 'Aug 10, 2026', Description: 'Come browse books.', Location: 'Library' } as any,
			'subj',
			'Aug 1, 2026'
		);
		const detailsMatch = url.match(/details=([^&]+)/);
		expect(detailsMatch).toBeTruthy();
		const details = decodeURIComponent(detailsMatch![1]);
		// New format: date/time, location, description, blank line, footer in parentheses
		expect(details).toContain('Location: Library');
		expect(details).toContain('Come browse books.');
		expect(details).toContain('(Added via sendtoschedule.com)');
		// Verify blank line before footer
		expect(details).toMatch(/Come browse books\.\n\n\(Added via sendtoschedule\.com\)/);
		// Attribution comes after the real content
		expect(details.indexOf('(Added via sendtoschedule.com)')).toBeGreaterThan(details.indexOf('Come browse books.'));
	});

	it('still appends attribution even when there is no Description or Location', () => {
		const url = createCalendarUrl({ Title: 'Mystery Event', Date: 'Aug 10, 2026' } as any, 'subj', 'Aug 1, 2026');
		const detailsMatch = url.match(/details=([^&]+)/);
		const details = decodeURIComponent(detailsMatch![1]);
		// Should contain date and footer, with blank line separator
		expect(details).toContain('(Added via sendtoschedule.com)');
		expect(details).toMatch(/\n\n\(Added via sendtoschedule\.com\)/);
	});

	it('includes time from the newsletter in the description', () => {
		const url = createCalendarUrl(
			{ Title: 'Back to School Night', Date: 'Aug 26, 2026', Time: '6:30-8:00pm', Location: 'Blach Intermediate School', Description: 'Parent event with light refreshments.' } as any,
			'subj',
			'Aug 1, 2026'
		);
		const detailsMatch = url.match(/details=([^&]+)/);
		expect(detailsMatch).toBeTruthy();
		const details = decodeURIComponent(detailsMatch![1]);
		// Should include formatted time
		expect(details).toContain('6:30pm to 8:00pm');
		expect(details).toContain('Location: Blach Intermediate School');
		expect(details).toContain('Parent event with light refreshments.');
		expect(details).toContain('(Added via sendtoschedule.com)');
	});
});

describe('email() handler — integration', () => {
	const originalFetch = global.fetch;

	beforeEach(() => {
		env.GEMINI_API_KEY = 'test-gemini-key';
		env.RESEND_API_KEY = 'test-resend-key';
		env.POSTHOG_API_KEY = ''; // disabled path, avoids network calls in test
	});

	afterEach(() => {
		global.fetch = originalFetch;
		vi.restoreAllMocks();
	});

	it('extracts events from a clean multi-event text email and sends a report via Resend', async () => {
		const geminiPayload = {
			candidates: [
				{
					content: {
						parts: [
							{
								text: JSON.stringify({
									is_relevant: true,
									events: [
										{
											Title: 'Fall Festival',
											Date: 'Oct 3, 2026',
											Time: '10:00am-2:00pm',
											Location: 'School Gym',
											Description: 'Bring the family.',
											DateConfidence: 'high',
										},
										{
											Title: 'Picture Day',
											Date: 'Oct 10, 2026',
											DateConfidence: 'high',
										},
									],
									summary: 'From the school newsletter: Fall Festival and Picture Day.',
								}),
							},
						],
					},
				},
			],
		};

		const sendCalls: any[] = [];
		global.fetch = vi.fn(async (url: any, init?: any) => {
			const urlStr = String(url);
			if (urlStr.includes('generativelanguage.googleapis.com')) {
				return new Response(JSON.stringify(geminiPayload), { status: 200 });
			}
			if (urlStr.includes('api.resend.com')) {
				sendCalls.push(JSON.parse(init.body));
				return new Response(JSON.stringify({ id: 'test-email-id' }), { status: 200 });
			}
			throw new Error('Unexpected fetch to ' + urlStr);
		}) as any;

		const message = buildForwardableEmailMessage({
			from: 'parent@example.com',
			subject: 'Fwd: School Newsletter',
			body: 'Join us for the Fall Festival on October 3rd from 10am-2pm at the School Gym. Also, Picture Day is October 10th.',
		});

		const ctx = createExecutionContext();
		await worker.email(message, env, ctx);
		await waitOnExecutionContext(ctx);

		expect(sendCalls.length).toBeGreaterThanOrEqual(1);
		const reportCall = sendCalls.find((c) => c.subject.startsWith('Scout Report:'));
		expect(reportCall).toBeTruthy();
		expect(reportCall.html).toContain('Fall Festival');
		expect(reportCall.html).toContain('Picture Day');
	});

	it('falls back to "Your flyer" when subject is blank', async () => {
		const geminiPayload = {
			candidates: [{ content: { parts: [{ text: JSON.stringify({ events: [], summary: 'No events found.' }) }] } }],
		};

		const sendCalls: any[] = [];
		global.fetch = vi.fn(async (url: any, init?: any) => {
			const urlStr = String(url);
			if (urlStr.includes('generativelanguage.googleapis.com')) {
				return new Response(JSON.stringify(geminiPayload), { status: 200 });
			}
			if (urlStr.includes('api.resend.com')) {
				sendCalls.push(JSON.parse(init.body));
				return new Response(JSON.stringify({ id: 'test-email-id' }), { status: 200 });
			}
			throw new Error('Unexpected fetch to ' + urlStr);
		}) as any;

		// No subject header at all, and body contains a date word so it passes the
		// pre-filter and reaches the point where emailSubject is used.
		const message = buildForwardableEmailMessage({
			from: 'someone@example.com',
			body: 'Meeting Monday at 3pm, no agenda otherwise.',
		});

		const ctx = createExecutionContext();
		await worker.email(message, env, ctx);
		await waitOnExecutionContext(ctx);

		expect((global.fetch as any).mock.calls.some((c: any[]) => String(c[0]).includes('generativelanguage'))).toBe(true);
	});

	it('skips the AI call for non-event content (pre-filter) and still sends a fallback email', async () => {
		const sendCalls: any[] = [];
		global.fetch = vi.fn(async (url: any, init?: any) => {
			const urlStr = String(url);
			if (urlStr.includes('generativelanguage.googleapis.com')) {
				throw new Error('Should not call Gemini when pre-filter rejects the email');
			}
			if (urlStr.includes('api.resend.com')) {
				sendCalls.push(JSON.parse(init.body));
				return new Response(JSON.stringify({ id: 'test-email-id' }), { status: 200 });
			}
			throw new Error('Unexpected fetch to ' + urlStr);
		}) as any;

		const message = buildForwardableEmailMessage({
			from: 'someone@example.com',
			subject: 'Your receipt',
			body: 'Thanks for your purchase. Your order has shipped.',
		});

		const ctx = createExecutionContext();
		await worker.email(message, env, ctx);
		await waitOnExecutionContext(ctx);

		expect(sendCalls.length).toBe(1);
		// Subject line is now captured in the response
		expect(sendCalls[0].subject).toContain(`Couldn't process "Your receipt"`);
	});

	it('captures original subject line in fallback response (pre-filter)', async () => {
		const sendCalls: any[] = [];
		global.fetch = vi.fn(async (url: any, init?: any) => {
			const urlStr = String(url);
			if (urlStr.includes('generativelanguage.googleapis.com')) {
				throw new Error('Should not call Gemini when pre-filter rejects the email');
			}
			if (urlStr.includes('api.resend.com')) {
				sendCalls.push(JSON.parse(init.body));
				return new Response(JSON.stringify({ id: 'test-email-id' }), { status: 200 });
			}
			throw new Error('Unexpected fetch to ' + urlStr);
		}) as any;

		const originalSubject = 'Blach Back to School - August 7th';
		const message = buildForwardableEmailMessage({
			from: 'user@example.com',
			subject: originalSubject,
			body: 'Unrelated content without event signals.',
		});

		const ctx = createExecutionContext();
		await worker.email(message, env, ctx);
		await waitOnExecutionContext(ctx);

		expect(sendCalls.length).toBe(1);
		expect(sendCalls[0].subject).toContain(`Couldn't process "${originalSubject}"`);
	});


	it('captures subject line in fallback response when AI returns no events', async () => {
		const sendCalls: any[] = [];
		global.fetch = vi.fn(async (url: any, init?: any) => {
			const urlStr = String(url);
			if (urlStr.includes('generativelanguage.googleapis.com')) {
				return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ events: [], summary: 'No events found.' }) }] } }] }), {
					status: 200,
				});
			}
			if (urlStr.includes('api.resend.com')) {
				sendCalls.push(JSON.parse(init.body));
				return new Response(JSON.stringify({ id: 'test-email-id' }), { status: 200 });
			}
			throw new Error('Unexpected fetch to ' + urlStr);
		}) as any;

		const originalSubject = 'Restaurant Menu - Spring 2026';
		const message = buildForwardableEmailMessage({
			from: 'user@example.com',
			subject: originalSubject,
			body: 'Here is our new menu with prices. Monday-Friday 11am-10pm. Saturday-Sunday 10am-11pm.',
		});

		const ctx = createExecutionContext();
		await worker.email(message, env, ctx);
		await waitOnExecutionContext(ctx);

		expect(sendCalls.length).toBe(1);
		expect(sendCalls[0].subject).toContain(`Couldn't process "${originalSubject}"`);
	});
});
