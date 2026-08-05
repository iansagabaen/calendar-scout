// Small authenticated admin HTTP surface for the circuit breaker (see
// circuit-breaker.ts). Exposes endpoints on this Worker's own `fetch` handler:
//
//   POST /admin/pause       — sets SYSTEM_PAUSED=true, sends a "manually paused" alert
//   POST /admin/resume      — clears SYSTEM_PAUSED
//   GET  /admin/smoke-test  — cheap end-to-end plumbing check (see below)
//
// Auth: a shared secret (ADMIN_SECRET, set via `wrangler secret put ADMIN_SECRET` —
// never hardcoded) checked against either an `X-Admin-Secret` header or a `?secret=`
// query param, so it's easy to hit from curl or a browser address bar in a pinch.
// This is intentionally lightweight (not full auth/session infra) — the goal is "Ian
// can flip this in 10 seconds from his phone without redeploying," not a general
// admin panel.

import { setPaused } from './circuit-breaker';
import { sendEmailBypassingBreaker } from './email-sender';
import { buildManualPauseAlertEmail } from './email-templates';
import { callGeminiVisionAI, MODELS } from './gemini';

// Fixed tiny plain-text sample for /admin/smoke-test -- exists purely to prove
// "API key valid, network path works, JSON parsing works" during a launch or
// migration, without needing production-quality extraction (that's what the
// nightly regression test is for) and without the cost of a real user email
// or an image/PDF attachment. See the 2026-07-20 Cloudflare-launch spike
// (projects.md) this was added in response to: verifying each migration step
// by sending real emails through the full pipeline, on the default (priciest)
// model, added up across a whole day.
const SMOKE_TEST_CONTENT = 'Team standup tomorrow at 10am in the main conference room.';

function checkSecret(request: Request, env: Env): boolean {
	if (!env.ADMIN_SECRET) {
		// No secret configured — fail closed. Without this, an unset secret would
		// mean `''  === ''` and anyone could hit the endpoint.
		return false;
	}
	const url = new URL(request.url);
	const headerSecret = request.headers.get('X-Admin-Secret');
	const querySecret = url.searchParams.get('secret');
	const provided = headerSecret || querySecret;
	return provided === env.ADMIN_SECRET;
}

export async function handleAdminRequest(request: Request, env: Env): Promise<Response> {
	const url = new URL(request.url);

	if (url.pathname === '/admin/pause' && request.method === 'POST') {
		if (!checkSecret(request, env)) {
			return new Response('Unauthorized', { status: 401 });
		}
		await setPaused(env.CALENDAR_SCOUT_KV, true);
		try {
			const pausedAt = new Date().toISOString();
			const { subject, html } = buildManualPauseAlertEmail(pausedAt);
			await sendEmailBypassingBreaker(env.RESEND_API_KEY, env.FROM_EMAIL, { to: env.MY_EMAIL, subject, html });
		} catch (e) {
			console.log('Failed to send manual-pause alert: ' + String(e));
		}
		return new Response(JSON.stringify({ paused: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
	}

	if (url.pathname === '/admin/resume' && request.method === 'POST') {
		if (!checkSecret(request, env)) {
			return new Response('Unauthorized', { status: 401 });
		}
		await setPaused(env.CALENDAR_SCOUT_KV, false);
		return new Response(JSON.stringify({ paused: false }), { status: 200, headers: { 'Content-Type': 'application/json' } });
	}

	if (url.pathname === '/admin/smoke-test' && request.method === 'GET') {
		if (!checkSecret(request, env)) {
			return new Response('Unauthorized', { status: 401 });
		}
		const start = Date.now();
		try {
			const result = await callGeminiVisionAI(env.GEMINI_API_KEY, SMOKE_TEST_CONTENT, [], new Date().toISOString(), {
				// Was hardcoded to 'gemini-2.0-flash-lite' -- found via this exact
				// endpoint on 2026-07-22 that Google had deprecated it (404). Using
				// MODELS[0] instead of a second hardcoded string means this can't
				// silently rot again the same way; it always matches whichever model
				// production actually currently relies on as primary.
				forceModel: MODELS[0],
				source: 'manual_smoke_test',
			});
			return new Response(
				JSON.stringify({ ok: (result.events?.length ?? 0) > 0, eventCount: result.events?.length ?? 0, tookMs: Date.now() - start }),
				{ status: 200, headers: { 'Content-Type': 'application/json' } }
			);
		} catch (e: any) {
			return new Response(JSON.stringify({ ok: false, error: e?.toString?.() || String(e), tookMs: Date.now() - start }), {
				status: 200,
				headers: { 'Content-Type': 'application/json' },
			});
		}
	}

	return new Response('Not found', { status: 404 });
}
