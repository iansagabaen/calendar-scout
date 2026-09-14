import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import worker from '../src/index';
import { hashSenderEmail, isTestSender } from '../src/analytics';

// Sender-identity instrumentation (2026-09-14) — see
// research/2026-09-14-sender-identity-instrumentation.md for the investigation
// that motivated this: PostHog's distinct_id was already the real per-request
// sender (not a bug), but it was the raw email address, which the "we don't
// store your data" pitch shouldn't be sending anywhere. These tests cover the
// replacement: a salted one-way hash as distinct_id, plus an is_test_sender
// boolean computed against an allowlist before hashing.

describe('hashSenderEmail', () => {
	it('is deterministic for the same email + salt', async () => {
		const a = await hashSenderEmail('parent@example.com', 'salt-1');
		const b = await hashSenderEmail('parent@example.com', 'salt-1');
		expect(a).toBe(b);
	});

	it('produces a different hash for a different email (same salt)', async () => {
		const a = await hashSenderEmail('parent@example.com', 'salt-1');
		const b = await hashSenderEmail('other-parent@example.com', 'salt-1');
		expect(a).not.toBe(b);
	});

	it('produces a different hash for the same email under a different salt', async () => {
		const a = await hashSenderEmail('parent@example.com', 'salt-1');
		const b = await hashSenderEmail('parent@example.com', 'salt-2');
		expect(a).not.toBe(b);
	});

	it('is case- and whitespace-insensitive on the email (same real address hashes the same)', async () => {
		const a = await hashSenderEmail('Parent@Example.com', 'salt-1');
		const b = await hashSenderEmail('  parent@example.com  ', 'salt-1');
		expect(a).toBe(b);
	});

	it('returns a 12-character lowercase hex string', async () => {
		const hash = await hashSenderEmail('parent@example.com', 'salt-1');
		expect(hash).toMatch(/^[0-9a-f]{12}$/);
	});
});

describe('isTestSender', () => {
	it('is true when the sender matches the only entry in the allowlist', () => {
		expect(isTestSender('ian@example.com', 'ian@example.com')).toBe(true);
	});

	it('is false when the sender is not in the allowlist', () => {
		expect(isTestSender('parent@example.com', 'ian@example.com')).toBe(false);
	});

	it('matches case-insensitively and ignores surrounding whitespace', () => {
		expect(isTestSender('Ian@Example.com', ' ian@example.com , other@example.com ')).toBe(true);
	});

	it('supports a comma-separated multi-entry allowlist', () => {
		const list = 'ian@example.com,tester2@example.com';
		expect(isTestSender('tester2@example.com', list)).toBe(true);
		expect(isTestSender('parent@example.com', list)).toBe(false);
	});

	it('is false when the allowlist is empty or undefined', () => {
		expect(isTestSender('ian@example.com', '')).toBe(false);
		expect(isTestSender('ian@example.com', undefined)).toBe(false);
	});
});

describe('email() handler — hashed distinct_id and is_test_sender wiring', () => {
	const originalFetch = global.fetch;

	function buildForwardableEmailMessage(opts: { from: string; subject?: string; body: string }): ForwardableEmailMessage {
		const subjectLine = opts.subject !== undefined ? `Subject: ${opts.subject}\r\n` : '';
		const raw = `From: ${opts.from}\r\nTo: scout@sendtoschedule.com\r\n${subjectLine}Content-Type: text/plain; charset="utf-8"\r\n\r\n${opts.body}`;
		const bytes = new TextEncoder().encode(raw);
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
			to: 'scout@sendtoschedule.com',
			headers,
			raw: stream,
			rawSize: bytes.length,
			setReject: vi.fn(),
			forward: vi.fn(),
			reply: vi.fn(),
		} as unknown as ForwardableEmailMessage;
	}

	beforeEach(() => {
		env.GEMINI_API_KEY = 'test-gemini-key';
		env.RESEND_API_KEY = 'test-resend-key';
		env.POSTHOG_API_KEY = 'test-posthog-key'; // enabled, unlike the other suite's disabled default
		env.SENDER_HASH_SALT = 'integration-test-salt';
		env.TEST_SENDER_EMAILS = 'ian-test@example.com';
	});

	afterEach(() => {
		global.fetch = originalFetch;
		vi.restoreAllMocks();
	});

	it('tags a test-allowlisted sender is_test_sender=true and a real sender is_test_sender=false, each with an internally consistent hashed distinct_id', async () => {
		const geminiPayload = {
			candidates: [
				{
					content: {
						parts: [
							{
								text: JSON.stringify({
									is_relevant: true,
									events: [{ Title: 'Book Fair', Date: 'Oct 3, 2026', DateConfidence: 'high' }],
									summary: 'Book Fair on Oct 3.',
								}),
							},
						],
					},
				},
			],
		};

		const posthogCaptures: any[] = [];
		global.fetch = vi.fn(async (url: any, init?: any) => {
			const urlStr = String(url);
			if (urlStr.includes('generativelanguage.googleapis.com')) {
				return new Response(JSON.stringify(geminiPayload), { status: 200 });
			}
			if (urlStr.includes('api.resend.com')) {
				return new Response(JSON.stringify({ id: 'test-email-id' }), { status: 200 });
			}
			if (urlStr.includes('i.posthog.com')) {
				posthogCaptures.push(JSON.parse(init.body));
				return new Response('OK', { status: 200 });
			}
			throw new Error('Unexpected fetch to ' + urlStr);
		}) as any;

		// Test sender (in TEST_SENDER_EMAILS).
		const testMessage = buildForwardableEmailMessage({
			from: 'ian-test@example.com',
			subject: 'Fwd: Book Fair',
			body: 'Join us for the Book Fair on October 3rd.',
		});
		const ctx1 = createExecutionContext();
		await worker.email(testMessage, env, ctx1);
		await waitOnExecutionContext(ctx1);

		// Real (non-test) sender.
		const realMessage = buildForwardableEmailMessage({
			from: 'real-parent@example.com',
			subject: 'Fwd: Book Fair',
			body: 'Join us for the Book Fair on October 3rd.',
		});
		const ctx2 = createExecutionContext();
		await worker.email(realMessage, env, ctx2);
		await waitOnExecutionContext(ctx2);

		expect(posthogCaptures.length).toBeGreaterThan(0);

		const testSenderCaptures = posthogCaptures.filter((c) => c.event === 'calendar_scout_email_received' && c.properties?.messageId);
		// Split by which invocation they came from via distinct_id grouping.
		const distinctIds = [...new Set(posthogCaptures.map((c) => c.distinct_id))];
		expect(distinctIds.length).toBe(2); // two different senders -> two different hashes

		// No raw email address anywhere in any captured payload.
		for (const capture of posthogCaptures) {
			const serialized = JSON.stringify(capture);
			expect(serialized).not.toContain('ian-test@example.com');
			expect(serialized).not.toContain('real-parent@example.com');
			expect(capture.distinct_id).toMatch(/^[0-9a-f]{12}$/);
		}

		const expectedTestHash = await hashSenderEmail('ian-test@example.com', 'integration-test-salt');
		const expectedRealHash = await hashSenderEmail('real-parent@example.com', 'integration-test-salt');
		expect(expectedTestHash).not.toBe(expectedRealHash);

		const testCapture = posthogCaptures.find((c) => c.distinct_id === expectedTestHash);
		const realCapture = posthogCaptures.find((c) => c.distinct_id === expectedRealHash);
		expect(testCapture).toBeTruthy();
		expect(realCapture).toBeTruthy();
		expect(testCapture.properties.is_test_sender).toBe(true);
		expect(realCapture.properties.is_test_sender).toBe(false);

		// Every capture from the same sender uses the same hash consistently.
		const testSenderAllCaptures = posthogCaptures.filter((c) => c.distinct_id === expectedTestHash);
		expect(testSenderAllCaptures.length).toBeGreaterThan(1); // email_received + ftux_welcome_sent + event_extraction_succeeded, at least
		expect(testSenderAllCaptures.every((c) => c.properties.is_test_sender === true)).toBe(true);
	});

	it('defaults TEST_SENDER_EMAILS to MY_EMAIL when unset', async () => {
		env.TEST_SENDER_EMAILS = undefined as any;
		env.MY_EMAIL = 'iansagabaen@gmail.com';

		const geminiPayload = {
			candidates: [{ content: { parts: [{ text: JSON.stringify({ events: [], summary: 'No events.' }) }] } }],
		};

		const posthogCaptures: any[] = [];
		global.fetch = vi.fn(async (url: any, init?: any) => {
			const urlStr = String(url);
			if (urlStr.includes('generativelanguage.googleapis.com')) {
				return new Response(JSON.stringify(geminiPayload), { status: 200 });
			}
			if (urlStr.includes('api.resend.com')) {
				return new Response(JSON.stringify({ id: 'test-email-id' }), { status: 200 });
			}
			if (urlStr.includes('i.posthog.com')) {
				posthogCaptures.push(JSON.parse(init.body));
				return new Response('OK', { status: 200 });
			}
			throw new Error('Unexpected fetch to ' + urlStr);
		}) as any;

		const message = buildForwardableEmailMessage({
			from: 'iansagabaen@gmail.com',
			subject: 'Test',
			body: 'Meeting Monday at 3pm.',
		});
		const ctx = createExecutionContext();
		await worker.email(message, env, ctx);
		await waitOnExecutionContext(ctx);

		expect(posthogCaptures.length).toBeGreaterThan(0);
		expect(posthogCaptures.every((c) => c.properties.is_test_sender === true)).toBe(true);
	});
});
