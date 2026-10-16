// Dev tool: render the REAL report-email template (buildReportEmail) with four
// FICTIONAL, friendly, all-valid-date events, for use as the pixel-accurate source
// of the Calendar Scout homepage hero screenshot.
//
// Why this exists: AI image models (Nano Banana etc.) garble small UI text. So the
// hero image uses a REAL render of the product's own email, rasterized to PNG, and
// the image model only builds the scene around it. See
// marketing/2026-10-15-homepage-hero-mockup-prompts.md.
//
// All names are made up ("Maple Grove Elementary" is fictional). Every event has a
// valid date and time, so every card shows the normal green "Add to Calendar" button.
//
// Writes two files into marketing/hero/:
//   hero-email-render.html          - phone width (~390px)
//   hero-email-render-desktop.html  - desktop/laptop width (~760px)
//
// Usage (from worker/):
//   npx esbuild scripts/render-hero-email.ts --bundle --platform=node --format=esm --outfile=../marketing/hero/.render-hero-email.mjs && node ../marketing/hero/.render-hero-email.mjs
// (or: node --experimental-strip-types scripts/render-hero-email.ts)

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildReportEmail } from '../src/email-templates.ts';
import { resolveEventTimes } from '../src/calendar-utils.ts';
import type { ScoutEvent } from '../src/types.ts';

// Resolved against the working directory — run this from worker/ (see Usage above).
const OUT_DIR = join(process.cwd(), '..', 'marketing', 'hero');

const events: ScoutEvent[] = [
	{
		Title: 'Fall Picture Day',
		Date: 'Oct 22, 2026',
		Time: '8:30am-11:30am',
		Location: 'Maple Grove Elementary Gym',
		Description: 'Individual portraits by grade. Order forms go home the week before.',
		DateConfidence: 'high',
	},
	{
		Title: 'Harvest Carnival',
		Date: 'Oct 30, 2026',
		Time: '5:30pm-8:00pm',
		Location: 'Maple Grove Elementary Playground',
		Description: 'Games, a cake walk, and a chili supper. Costumes welcome.',
		DateConfidence: 'high',
	},
	{
		Title: 'Parent-Teacher Conferences',
		Date: 'Nov 10, 2026',
		Time: '3:00pm-7:00pm',
		Location: 'Maple Grove Elementary Classrooms',
		Description: 'Fifteen-minute slots with your child’s teacher.',
		DateConfidence: 'high',
	},
	{
		Title: 'Early Release Day',
		Date: 'Nov 18, 2026',
		Time: '12:30pm',
		Location: 'Maple Grove Elementary',
		Description: 'Students are dismissed at 12:30pm for teacher planning.',
		DateConfidence: 'high',
	},
];

const SUBJECT = 'Fwd: Maple Grove Elementary: October Newsletter';
resolveEventTimes(events, { subject: SUBJECT, body: 'Maple Grove Elementary October newsletter.' });

// isFirstTime=false (no long welcome box), includeFeedback=false (no feedback box):
// the cleanest "normal report" the template can produce.
const { subject, html } = buildReportEmail(events, SUBJECT, 'Oct 15, 2026', false, 'From the Maple Grove Elementary October newsletter: picture day, a carnival, conferences, and an early release.');

function page(width: number, pad: string): string {
	return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=${width}, initial-scale=1"><title>${subject.replace(/"/g, '&quot;')}</title>
<style>html,body{margin:0;padding:0;background:#ffffff;}body{width:${width}px;padding:${pad};box-sizing:border-box;-webkit-font-smoothing:antialiased;}</style>
</head><body>
${html}
</body></html>
`;
}

// Phone: 390px wide viewport, 12px side gutters (as an email client would give it).
writeFileSync(join(OUT_DIR, 'hero-email-render.html'), page(390, '16px 12px 12px'), 'utf8');
// Desktop: 760px wide, the template's own 600px column centered with margin.
writeFileSync(join(OUT_DIR, 'hero-email-render-desktop.html'), page(760, '32px 80px 24px'), 'utf8');
console.log('Wrote hero-email-render.html and hero-email-render-desktop.html to ' + OUT_DIR);
console.log('Subject line the real template emits: ' + subject);
