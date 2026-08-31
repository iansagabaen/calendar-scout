// Dev tool: run the nightly regression samples against the REAL Gemini API,
// exactly the way src/regression-test.ts -> runOneCase() does (callGeminiVisionAI
// then createCalendarUrl per event), so a prompt/parser regression can be
// reproduced and inspected locally without waiting for the 03:00 UTC cron.
//
// Usage (from worker/):
//   node --experimental-strip-types scripts/repro-pinecrest.ts [runs]
// or bundle first with esbuild if extensionless imports trip the loader:
//   npx esbuild scripts/repro-pinecrest.ts --bundle --platform=node --format=esm --outfile=/tmp/repro.mjs && node /tmp/repro.mjs
//
// GEMINI_API_KEY is read from worker/.dev.vars (same file `wrangler dev` uses).

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { callGeminiVisionAI } from '../src/gemini.ts';
import { createCalendarUrl, formatDateCleanly } from '../src/calendar-utils.ts';
import { REGRESSION_CASES } from '../src/regression-samples.ts';
import type { ScoutEvent } from '../src/types.ts';

const here = dirname(fileURLToPath(import.meta.url));

function loadDevVar(name: string): string {
	const raw = readFileSync(join(here, '..', '.dev.vars'), 'utf8');
	for (const line of raw.split('\n')) {
		const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.+?)\s*$/);
		if (m && m[1] === name) return m[2];
	}
	throw new Error(`${name} not found in worker/.dev.vars`);
}

const SOCCER_MATCH = /soccer game vs cedar valley/i;

async function runCase(apiKey: string, testCase: (typeof REGRESSION_CASES)[number]) {
	const receivedDate = formatDateCleanly(new Date());
	const ai = await callGeminiVisionAI(apiKey, testCase.body || testCase.subject, testCase.mediaParts, receivedDate, {
		source: 'nightly_regression',
	});
	const events: ScoutEvent[] = (ai as any).events || [];
	console.log(`\n=== ${testCase.label} — ${events.length} events ===`);

	let firstUrlError: string | null = null;
	for (const ev of events) {
		const flagged = SOCCER_MATCH.test(ev.Title || '');
		if (flagged) {
			console.log('  >>> SOCCER EVENT RAW FIELDS:');
			console.log('      Title            =', JSON.stringify(ev.Title));
			console.log('      Date             =', JSON.stringify(ev.Date));
			console.log('      Time             =', JSON.stringify(ev.Time));
			console.log('      TimeConfidence   =', JSON.stringify((ev as any).TimeConfidence));
			console.log('      TimeInferenceNote=', JSON.stringify((ev as any).TimeInferenceNote));
			console.log('      DateConfidence   =', JSON.stringify((ev as any).DateConfidence));
		}
		const result = createCalendarUrl(ev, testCase.subject, receivedDate);
		if (typeof result !== 'string') {
			const msg = `createCalendarUrl() returned error for event "${ev.Title}": ${result.error}`;
			console.log('  URL ERROR:', msg);
			if (!firstUrlError) firstUrlError = msg;
		} else if (flagged) {
			console.log('      -> calendar URL OK:', result.slice(0, 120) + '...');
		}
	}
	return { label: testCase.label, eventCount: events.length, firstUrlError, events };
}

async function main() {
	const apiKey = loadDevVar('GEMINI_API_KEY');
	const runs = parseInt(process.argv[2] || '1', 10);
	const summary: { run: number; label: string; firstUrlError: string | null }[] = [];
	for (let i = 1; i <= runs; i++) {
		console.log(`\n############ RUN ${i}/${runs} ############`);
		for (const c of REGRESSION_CASES) {
			const r = await runCase(apiKey, c);
			summary.push({ run: i, label: r.label, firstUrlError: r.firstUrlError });
		}
	}
	console.log('\n############ SUMMARY ############');
	for (const s of summary) {
		console.log(`run ${s.run} | ${s.firstUrlError ? 'FAIL' : 'pass'} | ${s.label}${s.firstUrlError ? ' | ' + s.firstUrlError : ''}`);
	}
	const anyFail = summary.some((s) => s.firstUrlError);
	process.exit(anyFail ? 1 : 0);
}

main().catch((e) => {
	console.error(e);
	process.exit(2);
});
