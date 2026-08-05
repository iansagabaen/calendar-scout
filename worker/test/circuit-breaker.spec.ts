import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import worker from '../src/index';
import { checkAndRecordSend, isPaused, setPaused, SAME_RECIPIENT_THRESHOLD, GLOBAL_THRESHOLD } from '../src/circuit-breaker';

// --- Test helpers -----------------------------------------------------------

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

async function clearBreakerState() {
	// Best-effort reset of the keys this module touches, since KV state can persist
	// across tests within the same isolated storage instance.
	await env.CALENDAR_SCOUT_KV.delete('SYSTEM_PAUSED');
	await env.CALENDAR_SCOUT_KV.delete('RATE_LIMIT_GLOBAL_SENDS');
	const list = await env.CALENDAR_SCOUT_KV.list({ prefix: 'RATE_LIMIT_RECIPIENT:' });
	for (const key of list.keys) {
		await env.CALENDAR_SCOUT_KV.delete(key.name);
	}
}

const noEventsGeminiPayload = {
	candidates: [{ content: { parts: [{ text: JSON.stringify({ events: [], summary: 'No events found.' }) }] } }],
};

function mockFetchForNoEvents(sendCalls: any[]) {
	global.fetch = vi.fn(async (url: any, init?: any) => {
		const urlStr = String(url);
		if (urlStr.includes('generativelanguage.googleapis.com')) {
			return new Response(JSON.stringify(noEventsGeminiPayload), { status: 200 });
		}
		if (urlStr.includes('api.resend.com')) {
			sendCalls.push(JSON.parse(init.body));
			return new Response(JSON.stringify({ id: 'test-email-id' }), { status: 200 });
		}
		throw new Error('Unexpected fetch to ' + urlStr);
	}) as any;
}

describe('circuit breaker — unit', () => {
	const originalFetch = global.fetch;

	beforeEach(async () => {
		await clearBreakerState();
	});

	afterEach(() => {
		global.fetch = originalFetch;
		vi.restoreAllMocks();
	});

	it('allows sends under the same-recipient threshold', async () => {
		for (let i = 0; i < SAME_RECIPIENT_THRESHOLD; i++) {
			const result = await checkAndRecordSend(env.CALENDAR_SCOUT_KV, 'jane@example.com');
			expect(result.blocked).toBe(false);
		}
		expect(await isPaused(env.CALENDAR_SCOUT_KV)).toBe(false);
	});

	it('trips the same-recipient limit and auto-pauses when the threshold is exceeded', async () => {
		for (let i = 0; i < SAME_RECIPIENT_THRESHOLD; i++) {
			const result = await checkAndRecordSend(env.CALENDAR_SCOUT_KV, 'jane@example.com');
			expect(result.blocked).toBe(false);
		}
		// One more within the window should trip it.
		const tripped = await checkAndRecordSend(env.CALENDAR_SCOUT_KV, 'jane@example.com');
		expect(tripped.blocked).toBe(true);
		expect(tripped.reason?.kind).toBe('SAME_RECIPIENT');
		if (tripped.reason?.kind === 'SAME_RECIPIENT') {
			expect(tripped.reason.recipient).toBe('jane@example.com');
			expect(tripped.reason.count).toBe(SAME_RECIPIENT_THRESHOLD + 1);
		}
		expect(await isPaused(env.CALENDAR_SCOUT_KV)).toBe(true);
	});

	it('does not trip the same-recipient limit for different recipients', async () => {
		for (let i = 0; i < SAME_RECIPIENT_THRESHOLD + 2; i++) {
			const result = await checkAndRecordSend(env.CALENDAR_SCOUT_KV, `recipient-${i}@example.com`);
			expect(result.blocked).toBe(false);
		}
		expect(await isPaused(env.CALENDAR_SCOUT_KV)).toBe(false);
	});

	it('trips the global cap and auto-pauses when total sends exceed the threshold', async () => {
		for (let i = 0; i < GLOBAL_THRESHOLD; i++) {
			// Spread across distinct recipients so only the global cap is exercised,
			// not the same-recipient one.
			const result = await checkAndRecordSend(env.CALENDAR_SCOUT_KV, `person-${i}@example.com`);
			expect(result.blocked).toBe(false);
		}
		const tripped = await checkAndRecordSend(env.CALENDAR_SCOUT_KV, 'person-overflow@example.com');
		expect(tripped.blocked).toBe(true);
		expect(tripped.reason?.kind).toBe('GLOBAL_RATE');
		if (tripped.reason?.kind === 'GLOBAL_RATE') {
			expect(tripped.reason.count).toBe(GLOBAL_THRESHOLD + 1);
		}
		expect(await isPaused(env.CALENDAR_SCOUT_KV)).toBe(true);
	}, 20_000);

	it('setPaused(true)/setPaused(false) round-trip via isPaused', async () => {
		expect(await isPaused(env.CALENDAR_SCOUT_KV)).toBe(false);
		await setPaused(env.CALENDAR_SCOUT_KV, true);
		expect(await isPaused(env.CALENDAR_SCOUT_KV)).toBe(true);
		await setPaused(env.CALENDAR_SCOUT_KV, false);
		expect(await isPaused(env.CALENDAR_SCOUT_KV)).toBe(false);
	});
});

describe('circuit breaker — email() handler integration', () => {
	const originalFetch = global.fetch;

	beforeEach(async () => {
		await clearBreakerState();
		env.GEMINI_API_KEY = 'test-gemini-key';
		env.RESEND_API_KEY = 'test-resend-key';
		env.POSTHOG_API_KEY = '';
		env.ADMIN_SECRET = 'test-admin-secret';
	});

	afterEach(() => {
		global.fetch = originalFetch;
		vi.restoreAllMocks();
	});

	it('blocks processing entirely when SYSTEM_PAUSED is set, before any send happens', async () => {
		await setPaused(env.CALENDAR_SCOUT_KV, true);

		const sendCalls: any[] = [];
		mockFetchForNoEvents(sendCalls);

		const message = buildForwardableEmailMessage({
			from: 'someone@example.com',
			subject: 'Meeting reminder',
			body: 'Meeting Monday at 3pm.',
		});

		const ctx = createExecutionContext();
		await worker.email(message, env, ctx);
		await waitOnExecutionContext(ctx);

		// Nothing should have been sent, and Gemini should not have been called either
		// — the pause check happens before any processing.
		expect(sendCalls.length).toBe(0);
		expect(global.fetch).not.toHaveBeenCalled();
	});

	it('auto-pauses after repeated sends to the same recipient trigger the same-recipient breaker, and sends a trip alert', async () => {
		const sendCalls: any[] = [];
		mockFetchForNoEvents(sendCalls);

		// Send SAME_RECIPIENT_THRESHOLD + 1 separate "no events" emails to the same
		// sender in a row — each email() invocation results in one fallback send to
		// that sender. The (threshold+1)th should trip the breaker instead of sending.
		for (let i = 0; i <= SAME_RECIPIENT_THRESHOLD; i++) {
			const message = buildForwardableEmailMessage({
				from: 'loop-target@example.com',
				subject: `Reminder ${i}`,
				body: 'Meeting Monday at 3pm, no agenda otherwise.',
			});
			const ctx = createExecutionContext();
			await worker.email(message, env, ctx);
			await waitOnExecutionContext(ctx);
		}

		// Exactly SAME_RECIPIENT_THRESHOLD fallback emails should have reached the
		// intended recipient before the breaker tripped.
		const toLoopTarget = sendCalls.filter((c) => c.to?.[0] === 'loop-target@example.com');
		expect(toLoopTarget.length).toBe(SAME_RECIPIENT_THRESHOLD);

		// A trip alert should have gone to Ian's address instead of the (blocked) send.
		const alertCalls = sendCalls.filter((c) => c.to?.[0] === env.MY_EMAIL && c.subject.includes('auto-paused'));
		expect(alertCalls.length).toBe(1);
		expect(alertCalls[0].html).toContain('loop-target@example.com');

		expect(await isPaused(env.CALENDAR_SCOUT_KV)).toBe(true);
	});
});

describe('admin pause/resume endpoints', () => {
	const originalFetch = global.fetch;

	beforeEach(async () => {
		await clearBreakerState();
		env.RESEND_API_KEY = 'test-resend-key';
		env.ADMIN_SECRET = 'test-admin-secret';
	});

	afterEach(() => {
		global.fetch = originalFetch;
		vi.restoreAllMocks();
	});

	it('rejects /admin/pause without the correct secret', async () => {
		const ctx = createExecutionContext();
		const req = new Request('https://worker.example/admin/pause', { method: 'POST' });
		const res = await worker.fetch!(req, env, ctx);
		await waitOnExecutionContext(ctx);

		expect(res.status).toBe(401);
		expect(await isPaused(env.CALENDAR_SCOUT_KV)).toBe(false);
	});

	it('rejects /admin/pause with a wrong secret', async () => {
		const ctx = createExecutionContext();
		const req = new Request('https://worker.example/admin/pause?secret=wrong-secret', { method: 'POST' });
		const res = await worker.fetch!(req, env, ctx);
		await waitOnExecutionContext(ctx);

		expect(res.status).toBe(401);
		expect(await isPaused(env.CALENDAR_SCOUT_KV)).toBe(false);
	});

	it('accepts /admin/pause with the correct secret via query param and sets SYSTEM_PAUSED', async () => {
		const sendCalls: any[] = [];
		global.fetch = vi.fn(async (url: any, init?: any) => {
			if (String(url).includes('api.resend.com')) {
				sendCalls.push(JSON.parse(init.body));
				return new Response(JSON.stringify({ id: 'test-email-id' }), { status: 200 });
			}
			throw new Error('Unexpected fetch to ' + String(url));
		}) as any;

		const ctx = createExecutionContext();
		const req = new Request('https://worker.example/admin/pause?secret=test-admin-secret', { method: 'POST' });
		const res = await worker.fetch!(req, env, ctx);
		await waitOnExecutionContext(ctx);

		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body).toEqual({ paused: true });
		expect(await isPaused(env.CALENDAR_SCOUT_KV)).toBe(true);

		// Manual pause should have fired its own alert email.
		expect(sendCalls.length).toBe(1);
		expect(sendCalls[0].subject).toContain('manually paused');
	});

	it('accepts /admin/pause with the correct secret via header', async () => {
		global.fetch = vi.fn(async (url: any) => {
			if (String(url).includes('api.resend.com')) {
				return new Response(JSON.stringify({ id: 'test-email-id' }), { status: 200 });
			}
			throw new Error('Unexpected fetch to ' + String(url));
		}) as any;

		const ctx = createExecutionContext();
		const req = new Request('https://worker.example/admin/pause', {
			method: 'POST',
			headers: { 'X-Admin-Secret': 'test-admin-secret' },
		});
		const res = await worker.fetch!(req, env, ctx);
		await waitOnExecutionContext(ctx);

		expect(res.status).toBe(200);
		expect(await isPaused(env.CALENDAR_SCOUT_KV)).toBe(true);
	});

	it('resumes via /admin/resume with the correct secret, clearing SYSTEM_PAUSED', async () => {
		await setPaused(env.CALENDAR_SCOUT_KV, true);
		expect(await isPaused(env.CALENDAR_SCOUT_KV)).toBe(true);

		const ctx = createExecutionContext();
		const req = new Request('https://worker.example/admin/resume?secret=test-admin-secret', { method: 'POST' });
		const res = await worker.fetch!(req, env, ctx);
		await waitOnExecutionContext(ctx);

		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body).toEqual({ paused: false });
		expect(await isPaused(env.CALENDAR_SCOUT_KV)).toBe(false);
	});

	it('rejects /admin/resume without the correct secret and leaves paused state untouched', async () => {
		await setPaused(env.CALENDAR_SCOUT_KV, true);

		const ctx = createExecutionContext();
		const req = new Request('https://worker.example/admin/resume', { method: 'POST' });
		const res = await worker.fetch!(req, env, ctx);
		await waitOnExecutionContext(ctx);

		expect(res.status).toBe(401);
		expect(await isPaused(env.CALENDAR_SCOUT_KV)).toBe(true);
	});

	it('returns 404 for unknown admin paths', async () => {
		const ctx = createExecutionContext();
		const req = new Request('https://worker.example/admin/unknown?secret=test-admin-secret', { method: 'POST' });
		const res = await worker.fetch!(req, env, ctx);
		await waitOnExecutionContext(ctx);

		expect(res.status).toBe(404);
	});
});
