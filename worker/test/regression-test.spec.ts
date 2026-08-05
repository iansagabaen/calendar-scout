import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import worker from '../src/index';
import { checkCalendarUrlWellFormed } from '../src/regression-test';

// --- Test helpers -----------------------------------------------------------

function geminiSuccessResponse(events: any[], summary = 'summary'): Response {
	return new Response(
		JSON.stringify({
			candidates: [{ content: { parts: [{ text: JSON.stringify({ is_relevant: true, events, summary }) }] } }],
		}),
		{ status: 200 }
	);
}

/** Distinguishes the image/PDF regression case's Gemini request from the text-only one. */
function requestHasMedia(init: any): boolean {
	const body = JSON.parse(init.body);
	return body.contents[0].parts.length > 1;
}

describe('checkCalendarUrlWellFormed (CTA link validation used by the nightly test)', () => {
	it('passes a well-formed Google Calendar TEMPLATE link', () => {
		const url =
			'https://www.google.com/calendar/render?action=TEMPLATE&text=Book%20Fair&dates=20260914%2F20260915&details=Come%20browse%20books.&location=Library';
		expect(checkCalendarUrlWellFormed(url)).toBeNull();
	});

	it('catches a URL that is not syntactically valid', () => {
		const err = checkCalendarUrlWellFormed('not a url at all');
		expect(err).toBeTruthy();
		expect(err).toContain('not a syntactically valid URL');
	});

	it('catches a URL that does not start with the expected Google Calendar base', () => {
		const err = checkCalendarUrlWellFormed('https://example.com/calendar/render?action=TEMPLATE&text=Foo&dates=X&details=Y');
		expect(err).toBeTruthy();
		expect(err).toContain('does not start with the expected Google Calendar base');
	});

	it('catches a URL missing a non-empty "details" param', () => {
		const err = checkCalendarUrlWellFormed('https://www.google.com/calendar/render?action=TEMPLATE&text=Book%20Fair&dates=20260914%2F20260915&details=');
		expect(err).toBeTruthy();
		expect(err).toContain('missing a non-empty "details" param');
	});

	it('catches a URL missing the "text" param entirely', () => {
		const err = checkCalendarUrlWellFormed('https://www.google.com/calendar/render?action=TEMPLATE&dates=20260914%2F20260915&details=Foo');
		expect(err).toBeTruthy();
		expect(err).toContain('missing a non-empty "text" param');
	});
});

describe('scheduled() — nightly regression test', () => {
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

	it('runs both fixed samples (text-only and image/PDF-only) through the real Gemini pipeline', async () => {
		const geminiCalls: any[] = [];
		global.fetch = vi.fn(async (url: any, init?: any) => {
			const urlStr = String(url);
			if (urlStr.includes('generativelanguage.googleapis.com')) {
				geminiCalls.push(init);
				return geminiSuccessResponse([
					{ Title: 'Book Fair', Date: 'Sep 14, 2026' },
					{ Title: 'Field Trip', Date: 'Sep 17, 2026' },
				]);
			}
			if (urlStr.includes('api.resend.com')) {
				return new Response(JSON.stringify({ id: 'x' }), { status: 200 });
			}
			throw new Error('Unexpected fetch to ' + urlStr);
		}) as any;

		const ctx = createExecutionContext();
		await worker.scheduled!({} as any, env, ctx);
		await waitOnExecutionContext(ctx);

		expect(geminiCalls.length).toBe(2);
		const mediaCalls = geminiCalls.filter(requestHasMedia);
		const textCalls = geminiCalls.filter((c) => !requestHasMedia(c));
		expect(mediaCalls.length).toBe(1); // the image/PDF-only sample
		expect(textCalls.length).toBe(1); // the text-only sample
	});

	it('does not send any email when both samples pass (a passing nightly run should be silent)', async () => {
		const resendCalls: any[] = [];
		global.fetch = vi.fn(async (url: any, init?: any) => {
			const urlStr = String(url);
			if (urlStr.includes('generativelanguage.googleapis.com')) {
				return geminiSuccessResponse([
					{ Title: 'Book Fair', Date: 'Sep 14, 2026' },
					{ Title: 'Picture Day', Date: 'Sep 17, 2026' },
					{ Title: 'PTA Meeting', Date: 'Sep 24, 2026' },
				]);
			}
			if (urlStr.includes('api.resend.com')) {
				resendCalls.push(JSON.parse(init.body));
				return new Response(JSON.stringify({ id: 'x' }), { status: 200 });
			}
			throw new Error('Unexpected fetch to ' + urlStr);
		}) as any;

		const logSpy = vi.spyOn(console, 'log');

		const ctx = createExecutionContext();
		await worker.scheduled!({} as any, env, ctx);
		await waitOnExecutionContext(ctx);

		expect(resendCalls.length).toBe(0);

		const executionLogLines = logSpy.mock.calls.map((c) => String(c[0])).filter((l) => l.includes('scout_execution'));
		expect(executionLogLines.length).toBe(2);
		expect(executionLogLines.every((l) => l.includes('"status":"SUCCESS"'))).toBe(true);
	});

	it('sends a clearly-labeled failure alert, bypassing the circuit breaker, when a sample returns zero events', async () => {
		const resendCalls: any[] = [];
		global.fetch = vi.fn(async (url: any, init?: any) => {
			const urlStr = String(url);
			if (urlStr.includes('generativelanguage.googleapis.com')) {
				if (requestHasMedia(init)) {
					// Simulate the image/PDF case silently failing to extract anything.
					return geminiSuccessResponse([], 'Nothing found.');
				}
				return geminiSuccessResponse([
					{ Title: 'Book Fair', Date: 'Sep 14, 2026' },
					{ Title: 'Picture Day', Date: 'Sep 17, 2026' },
					{ Title: 'PTA Meeting', Date: 'Sep 24, 2026' },
				]);
			}
			if (urlStr.includes('api.resend.com')) {
				resendCalls.push(JSON.parse(init.body));
				return new Response(JSON.stringify({ id: 'x' }), { status: 200 });
			}
			throw new Error('Unexpected fetch to ' + urlStr);
		}) as any;

		const ctx = createExecutionContext();
		await worker.scheduled!({} as any, env, ctx);
		await waitOnExecutionContext(ctx);

		expect(resendCalls.length).toBe(1);
		const alert = resendCalls[0];
		expect(alert.subject).toContain('nightly self-test FAILED');
		expect(alert.subject).toContain('not a user email');
		expect(alert.to).toEqual([env.MY_EMAIL]);
		expect(alert.html).toContain('Image/PDF-only flyer');
	});

	it('sends a failure alert when a sample comes back with a malformed / unexpected shape', async () => {
		const resendCalls: any[] = [];
		global.fetch = vi.fn(async (url: any, init?: any) => {
			const urlStr = String(url);
			if (urlStr.includes('generativelanguage.googleapis.com')) {
				if (!requestHasMedia(init)) {
					// Text case comes back with an event missing a Date — bad shape.
					// (Three events total so this fails on the per-event shape check,
					// not on the minExpectedEvents count check.)
					return geminiSuccessResponse([
						{ Title: 'Book Fair' },
						{ Title: 'Picture Day', Date: 'Sep 17, 2026' },
						{ Title: 'PTA Meeting', Date: 'Sep 24, 2026' },
					]);
				}
				return geminiSuccessResponse([{ Title: 'Founders Park Community Potluck', Date: 'Aug 8, 2026' }]);
			}
			if (urlStr.includes('api.resend.com')) {
				resendCalls.push(JSON.parse(init.body));
				return new Response(JSON.stringify({ id: 'x' }), { status: 200 });
			}
			throw new Error('Unexpected fetch to ' + urlStr);
		}) as any;

		const ctx = createExecutionContext();
		await worker.scheduled!({} as any, env, ctx);
		await waitOnExecutionContext(ctx);

		expect(resendCalls.length).toBe(1);
		expect(resendCalls[0].html).toContain('Text-only newsletter');
		expect(resendCalls[0].html).toContain('missing a Date');
	});

	it('sends a failure alert when the Gemini call throws entirely for a sample', async () => {
		const resendCalls: any[] = [];
		global.fetch = vi.fn(async (url: any, init?: any) => {
			const urlStr = String(url);
			if (urlStr.includes('generativelanguage.googleapis.com')) {
				if (requestHasMedia(init)) {
					throw new Error('network unreachable');
				}
				return geminiSuccessResponse([
					{ Title: 'Book Fair', Date: 'Sep 14, 2026' },
					{ Title: 'Picture Day', Date: 'Sep 17, 2026' },
					{ Title: 'PTA Meeting', Date: 'Sep 24, 2026' },
				]);
			}
			if (urlStr.includes('api.resend.com')) {
				resendCalls.push(JSON.parse(init.body));
				return new Response(JSON.stringify({ id: 'x' }), { status: 200 });
			}
			throw new Error('Unexpected fetch to ' + urlStr);
		}) as any;

		const ctx = createExecutionContext();
		await worker.scheduled!({} as any, env, ctx);
		await waitOnExecutionContext(ctx);

		// gemini.ts's callGeminiVisionAI catches per-model fetch errors internally and
		// falls through to its own zero-events fallback rather than throwing — so this
		// still surfaces as a "zero events expected" shape failure, exercised end to end.
		expect(resendCalls.length).toBe(1);
		expect(resendCalls[0].subject).toContain('nightly self-test FAILED');
	});
});
