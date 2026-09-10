// Dev tool: render the REAL report-email template (buildReportEmail) with three
// fabricated events — one placeholder-date (no date, no time), one
// placeholder-date WITH a time, one normal valid-date — and write the resulting
// HTML to research/unparseable-date-card-preview.html for visual inspection.
//
// This is the visual proof for
// research/2026-09-10-unparseable-date-graceful-fallback.md: the two
// placeholder-date cards must show an ENABLED "Add to Calendar (fix the date)"
// button and a readable amber "date not found" notice, while the normal card is
// unaffected.
//
// Usage (from worker/):
//   node --experimental-strip-types scripts/render-unparseable-date-preview.ts
// or bundle first with esbuild if extensionless imports trip the loader:
//   npx esbuild scripts/render-unparseable-date-preview.ts --bundle --platform=node --format=esm --outfile=/tmp/render.mjs && node /tmp/render.mjs

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildReportEmail } from '../src/email-templates.ts';
import { resolveEventTimes } from '../src/calendar-utils.ts';
import type { ScoutEvent } from '../src/types.ts';

// Resolved against the working directory — run this from worker/ (see Usage above).
const OUT = join(process.cwd(), '..', 'research', 'unparseable-date-card-preview.html');

const events: ScoutEvent[] = [
	{
		Title: 'Transit Month Webinar',
		Date: '', // no date in the source at all
		Time: '',
		Location: 'Online',
		Description: 'A virtual conversation with transit agency staff and advocates about what is next for the regional network.',
		DateConfidence: 'low',
		DateNote: 'No specific day or date range is mentioned for this webinar.',
		DateContext: 'Register online; a recording will be shared afterward with everyone who signs up.',
	},
	{
		Title: 'Bike Classes Planning Survey — Info Call',
		Date: '', // still no date, but a time slipped through
		Time: '12:00pm',
		Location: 'Online',
		Description: 'Optional lunchtime call to walk through the draft fall/winter adult bike-education class plan before the survey closes.',
		DateConfidence: 'low',
		DateNote: 'The newsletter mentions a lunchtime call but never says which day.',
		DateContext: 'We will do a quick lunchtime walkthrough for anyone who wants one before the survey closes.',
	},
	{
		Title: 'Fall Bike Ride',
		Date: 'Oct 4, 2026',
		Time: '9:00-11:00am',
		Location: 'Lake Merritt Pergola',
		Description: 'Easy 8-mile group ride along the bay trail. Helmets required; bring water.',
		DateConfidence: 'high',
	},
];

resolveEventTimes(events, { subject: 'Fwd: September is Transit Month!', body: 'September is Transit Month across the Bay Area.' });

const { subject, html } = buildReportEmail(events, 'Fwd: September is Transit Month!', 'Sep 10, 2026', false, 'From the Transit Month newsletter: a webinar, a planning survey, and a fall bike ride.');

writeFileSync(OUT, `<!doctype html>\n<html><head><meta charset="utf-8"><title>${subject}</title></head><body style="margin:0;background:#e9ede9;padding:24px;">\n${html}\n</body></html>\n`, 'utf8');
console.log('Wrote ' + OUT);
