// Shared types for Calendar Scout Worker.
//
// The base `Env` interface (KV binding, SEND_EMAIL binding, and the plain-text vars
// from wrangler.jsonc) is auto-generated into worker-configuration.d.ts by
// `npm run cf-typegen` (wrangler types) and declared globally — no import needed.
// Secrets (GEMINI_API_KEY, RESEND_API_KEY, POSTHOG_API_KEY) are NOT in wrangler.jsonc
// (they're set via `wrangler secret put` / `.dev.vars` locally) so `wrangler types`
// doesn't know about them. This declaration merge adds them to the same global `Env`
// interface so the rest of the codebase can just use `Env` directly.
//
// Re-run `npm run cf-typegen` after changing wrangler.jsonc bindings/vars, then this
// file only needs updating if a new *secret* is introduced.

export {}; // ensure this file is treated as a module for the augmentation below

declare global {
	interface Env {
		GEMINI_API_KEY: string;
		RESEND_API_KEY: string;
		POSTHOG_API_KEY: string;
		// Shared secret for the /admin/pause and /admin/resume endpoints (see admin.ts).
		// Set via `wrangler secret put ADMIN_SECRET`, never committed.
		ADMIN_SECRET: string;
	}
}

export interface MediaPart {
	inline_data: {
		mime_type: string;
		data: string; // base64
	};
}

export interface ScoutEvent {
	Title: string;
	Date: string;
	Time?: string;
	Location?: string;
	Description?: string;
	RequiredItems?: string;
	DateConfidence?: 'high' | 'low';
	DateNote?: string;
	DateContext?: string;
}

export interface GeminiResult {
	is_relevant?: boolean;
	events: ScoutEvent[];
	summary: string;
}

export type ExecutionStatus = 'SUCCESS' | 'NO_EVENTS' | 'FILTERED_OUT' | 'ERROR';
