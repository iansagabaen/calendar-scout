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

	it('runs every fixed sample (two text-only and one image/PDF-only) through the real Gemini pipeline', async () => {
		const geminiCalls: any[] = [];
		global.fetch = vi.fn(async (url: any, init?: any) => {
			const urlStr = String(url);
			if (urlStr.includes('generativelanguage.googleapis.com')) {
				geminiCalls.push(init);
				// 3 events satisfies both text samples' minExpectedEvents (TEXT_SAMPLE:
				// 3, QUOTE_DENSE_ANNOUNCEMENT_SAMPLE: 2) so neither case's new
				// retry-once-on-failure logic fires here — this test only cares about
				// call routing (media vs text), not pass/fail behavior.
				return geminiSuccessResponse([
					{ Title: 'Book Fair', Date: 'Sep 14, 2026' },
					{ Title: 'Field Trip', Date: 'Sep 17, 2026' },
					{ Title: 'PTA Meeting', Date: 'Sep 24, 2026' },
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

		expect(geminiCalls.length).toBe(3);
		const mediaCalls = geminiCalls.filter(requestHasMedia);
		const textCalls = geminiCalls.filter((c) => !requestHasMedia(c));
		expect(mediaCalls.length).toBe(1); // the image/PDF-only sample
		expect(textCalls.length).toBe(2); // the two text-only samples
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
		expect(executionLogLines.length).toBe(3);
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

	it('does NOT fail the nightly run when Gemini returns an event whose Time is a bare meridiem ("PM")', async () => {
		// Regression for 2026-08-30: real Gemini returned Time: "PM" (no clock time)
		// for the Pinecrest "soccer game … right after school lets out" line, and
		// createCalendarUrl() -> parseTime("PM") produced "Could not parse time \"PM\"",
		// which validateCalendarUrls() surfaced as a nightly failure. A lone meridiem
		// must now degrade to an all-day event, so the run stays green.
		const resendCalls: any[] = [];
		global.fetch = vi.fn(async (url: any, init?: any) => {
			const urlStr = String(url);
			if (urlStr.includes('generativelanguage.googleapis.com')) {
				if (requestHasMedia(init)) {
					return geminiSuccessResponse([{ Title: 'Founders Park Community Potluck', Date: 'Aug 8, 2026', Time: '11am' }]);
				}
				return geminiSuccessResponse([
					{ Title: 'Fall Book Fair', Date: 'Sep 14, 2026', Time: '3:00-5:30pm' },
					{ Title: 'Picture Day', Date: 'Sep 17, 2026' },
					{ Title: '4th/5th Grade Soccer Game vs Cedar Valley', Date: 'Sep 1, 2026', Time: 'PM' },
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

		// No alert email, and both samples logged SUCCESS.
		expect(resendCalls.length).toBe(0);
		const executionLogLines = logSpy.mock.calls.map((c) => String(c[0])).filter((l) => l.includes('scout_execution'));
		expect(executionLogLines.length).toBe(3);
		expect(executionLogLines.every((l) => l.includes('"status":"SUCCESS"'))).toBe(true);
	});

	it('recovers silently when a sample fails shape validation once but passes on retry (transient flakiness)', async () => {
		// Regression for 2026-09-13: the real nightly run's quote-dense Covington
		// "Got Talent" sample came back with only 1 of its 2 expected shows on a
		// single Gemini call. gemini.ts's own per-model retry only covers "200
		// but unparseable JSON" -- it never sees a shape mismatch. The nightly
		// harness must retry the whole case once before alerting, so a lone blip
		// doesn't page Ian.
		let quoteDenseCallCount = 0;
		const resendCalls: any[] = [];
		global.fetch = vi.fn(async (url: any, init?: any) => {
			const urlStr = String(url);
			if (urlStr.includes('generativelanguage.googleapis.com')) {
				if (requestHasMedia(init)) {
					return geminiSuccessResponse([{ Title: 'Founders Park Community Potluck', Date: 'Aug 8, 2026' }]);
				}
				const body = JSON.parse(init.body);
				const promptText = body.contents[0].parts[0].text as string;
				if (promptText.includes('Got Talent')) {
					quoteDenseCallCount++;
					if (quoteDenseCallCount === 1) {
						// First attempt: the two shows get merged/dropped into one event.
						return geminiSuccessResponse([{ Title: "Covington's Got Talent", Date: 'Sep 24, 2026' }]);
					}
					// Retry: both shows come back correctly.
					return geminiSuccessResponse([
						{ Title: "Covington's Got Talent (Families)", Date: 'Sep 24, 2026' },
						{ Title: "Covington's Got Talent (Students)", Date: 'Sep 25, 2026' },
					]);
				}
				// Pinecrest text-only sample.
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

		expect(quoteDenseCallCount).toBe(2);
		expect(resendCalls.length).toBe(0); // no alert -- recovered on retry

		const retryLogLines = logSpy.mock.calls.map((c) => String(c[0])).filter((l) => l.includes('passed on retry'));
		expect(retryLogLines.length).toBe(1);
		expect(retryLogLines[0]).toContain('text-quote-dense');
	});

	it('still alerts when a sample fails shape validation on both the initial attempt and the retry', async () => {
		let quoteDenseCallCount = 0;
		const resendCalls: any[] = [];
		global.fetch = vi.fn(async (url: any, init?: any) => {
			const urlStr = String(url);
			if (urlStr.includes('generativelanguage.googleapis.com')) {
				if (requestHasMedia(init)) {
					return geminiSuccessResponse([{ Title: 'Founders Park Community Potluck', Date: 'Aug 8, 2026' }]);
				}
				const body = JSON.parse(init.body);
				const promptText = body.contents[0].parts[0].text as string;
				if (promptText.includes('Got Talent')) {
					quoteDenseCallCount++;
					// Both attempts under-extract.
					return geminiSuccessResponse([{ Title: "Covington's Got Talent", Date: 'Sep 24, 2026' }]);
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

		expect(quoteDenseCallCount).toBe(2); // retried once, still failed
		expect(resendCalls.length).toBe(1);
		expect(resendCalls[0].html).toContain('Covington');
		expect(resendCalls[0].html).toContain('Expected at least 2 event(s), got 1');
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
