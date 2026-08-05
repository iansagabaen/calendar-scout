// Replaces the Debug Sheet (SpreadsheetApp logExecutionToSheet / initializeDebugSheet).
//
// Decision: use Cloudflare Workers Logs (the `observability: { enabled: true }` block
// in wrangler.jsonc) via structured console.log() rather than continuing to write to
// the Google Sheet. Reasoning:
//   - Workers Logs is already turned on for free with zero extra plumbing (no service
//     account, no Sheets API OAuth to manage), and `wrangler tail` streams it live to
//     the terminal — which is a strict upgrade on "open a Google Sheet and eyeball it,"
//     the exact pain point that motivated the whole platform migration
//     (research/2026-07-13-calendar-scout-platform-decision.md).
//   - The original Debug Sheet gave Ian a persistent, human-browsable table he's used
//     to checking. Structured JSON logs in Workers Logs are queryable/filterable in the
//     Cloudflare dashboard (30-day retention on free tier) and exportable, but they are
//     NOT a spreadsheet UI — this is a deliberate behavior change, not a hidden one.
//   - Judgment call: if Ian wants the literal spreadsheet-browsing experience preserved,
//     the fallback is writing to the same Google Sheet via the Sheets API with a service
//     account (keeps continuity, costs a bit of setup complexity + a new credential to
//     manage). Flagged in the final report as an open choice rather than silently decided.
//
// Each log line is a single JSON object so it's grep/filter-friendly in `wrangler tail`
// and in the dashboard's Logs search, mirroring the six Debug Sheet columns.

import type { ExecutionStatus } from './types';

export function logExecution(
	senderEmail: string,
	status: ExecutionStatus,
	eventsFound: number,
	errorMsg: string,
	processingTimeMs: number
): void {
	console.log(
		JSON.stringify({
			type: 'scout_execution',
			timestamp: new Date().toISOString(),
			email: senderEmail,
			status,
			eventsFound: eventsFound || 0,
			errorMsg: errorMsg || '',
			processingTimeMs: processingTimeMs || 0,
		})
	);
}
