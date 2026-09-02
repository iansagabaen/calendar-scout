import { describe, it, expect, vi, afterEach } from 'vitest';
import { callGeminiVisionAI, extractJson, MODELS } from '../src/gemini';

// Regression coverage for the 2026-09-02 Covington "Got Talent" production
// failure: `gemini-2.5-flash` returned HTTP 200 with malformed JSON (an
// unescaped quote in a verbatim-copy field on a quote-dense newsletter) and
// BOTH former fallback models had been retired by Google (404). The model loop
// exhausted and returned `{ events: [], summary: 'I hit a snag.' }`, which the
// caller then surfaced to the user as a contentless "Couldn't process".
// See research/2026-09-02-covington-got-talent-processing-failure.md.

describe('extractJson', () => {
	it('parses already-clean JSON', () => {
		expect(extractJson('{"events":[],"summary":"s"}')).toEqual({ events: [], summary: 's' });
	});

	it('strips a ```json fence', () => {
		expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
	});

	it('recovers an object wrapped in stray prose', () => {
		expect(extractJson('Sure! Here is the JSON:\n{"a":1}\nHope that helps.')).toEqual({ a: 1 });
	});

	it('removes a trailing comma before a closing brace / bracket', () => {
		expect(extractJson('{"events":[1,2,],"summary":"s",}')).toEqual({ events: [1, 2], summary: 's' });
	});

	it('throws when there is no JSON object at all', () => {
		expect(() => extractJson('the model refused to answer')).toThrow();
	});
});

describe('callGeminiVisionAI — resilience', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	const okResponse = (obj: unknown): Response =>
		new Response(
			JSON.stringify({
				candidates: [{ content: { parts: [{ text: typeof obj === 'string' ? obj : JSON.stringify(obj) }] } }],
				usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 2, totalTokenCount: 3 },
			}),
			{ status: 200 }
		);
	const httpError = (status: number, body = 'err'): Response => new Response(body, { status });
	const modelFromUrl = (url: unknown): string => String(url).match(/models\/([^:]+):/)?.[1] ?? '';
	const goodResult = { is_relevant: true, events: [{ Title: 'Talent Show', Date: 'Sep 24, 2026' }], summary: 'ok' };

	it('drops the deprecated gemini-2.0-flash-* model names', () => {
		expect(MODELS).not.toContain('gemini-2.0-flash-001');
		expect(MODELS).not.toContain('gemini-2.0-flash-lite');
		expect(MODELS[0]).toBe('gemini-2.5-flash');
	});

	it('asks Gemini for strictly valid JSON (generationConfig.responseMimeType)', async () => {
		let sentBody: any;
		global.fetch = vi.fn(async (_url: any, init: any) => {
			sentBody = JSON.parse(init.body);
			return okResponse(goodResult);
		}) as any;

		await callGeminiVisionAI('key', 'some text', [], 'Sep 1, 2026', { source: 'test' });

		expect(sentBody.generationConfig.responseMimeType).toBe('application/json');
	});

	it('retries the SAME model once when a 200 response body is not valid JSON, then succeeds', async () => {
		const calls: string[] = [];
		global.fetch = vi.fn(async (url: any) => {
			calls.push(modelFromUrl(url));
			return calls.length === 1 ? okResponse('{ "events": [ { "Title": "Talent Show" ') : okResponse(goodResult);
		}) as any;

		const res = await callGeminiVisionAI('key', 't', [], 'Sep 1, 2026', { source: 'test' });

		expect(res.events).toHaveLength(1);
		expect(calls).toEqual([MODELS[0], MODELS[0]]); // same model, retried once
	});

	it('falls through to the next model when the first model keeps returning bad JSON', async () => {
		const calls: string[] = [];
		global.fetch = vi.fn(async (url: any) => {
			const model = modelFromUrl(url);
			calls.push(model);
			return model === MODELS[0] ? okResponse('not json at all') : okResponse(goodResult);
		}) as any;

		const res = await callGeminiVisionAI('key', 't', [], 'Sep 1, 2026', { source: 'test' });

		expect(res.events).toHaveLength(1);
		expect(calls.filter((m) => m === MODELS[0])).toHaveLength(2); // tried twice
		expect(calls).toContain(MODELS[1]);
	});

	it('does NOT retry a non-200 (a deprecated-model 404) — moves straight to the next model', async () => {
		const calls: string[] = [];
		global.fetch = vi.fn(async (url: any) => {
			const model = modelFromUrl(url);
			calls.push(model);
			return model === MODELS[0]
				? httpError(404, '{"error":{"message":"This model is no longer available."}}')
				: okResponse(goodResult);
		}) as any;

		const res = await callGeminiVisionAI('key', 't', [], 'Sep 1, 2026', { source: 'test' });

		expect(res.events).toHaveLength(1);
		expect(calls.filter((m) => m === MODELS[0])).toHaveLength(1); // 404 not retried
	});

	it('returns an explicit error — not a silent empty result — when every model fails (the Covington failure mode)', async () => {
		global.fetch = vi.fn(async () => httpError(404, '{"error":{"code":404,"message":"no longer available"}}')) as any;

		const res = await callGeminiVisionAI('key', 't', [], 'Sep 1, 2026', { source: 'test' });

		expect(res.events).toEqual([]);
		expect(res.error).toMatch(/all Gemini models failed/i);
		expect(res.summary).not.toBe('I hit a snag.');
		expect(res.summary.toLowerCase()).toContain("couldn't read");
	});

	it('still succeeds when Gemini wraps valid JSON in a ```json fence', async () => {
		global.fetch = vi.fn(async () => okResponse('```json\n' + JSON.stringify(goodResult) + '\n```')) as any;

		const res = await callGeminiVisionAI('key', 't', [], 'Sep 1, 2026', { source: 'test' });

		expect(res.events).toHaveLength(1);
	});
});
