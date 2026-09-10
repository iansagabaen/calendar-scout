import { describe, it, expect } from 'vitest';
import { createCalendarUrl, eventDateIsPlaceholder, resolveEventTimes } from '../src/calendar-utils';
import { buildReportEmail } from '../src/email-templates';
import { checkCalendarUrlWellFormed } from '../src/regression-test';
import { NO_DATE_EVENTS_SAMPLE } from '../src/regression-samples';
import type { ScoutEvent } from '../src/types';

// A missing / unparseable event date must NOT block "Add to Calendar" anymore.
// createCalendarUrl() falls back to today (UTC-midnight) as an editable
// placeholder and still returns a working link; the report card keeps its ⚠
// warnings, swaps the red date error for an amber notice, and offers an enabled
// "Add to Calendar (set the date)" button.
// See research/2026-09-10-unparseable-date-graceful-fallback.md.

/** Today's date as YYYYMMDD in UTC — the placeholder anchor createCalendarUrl uses. */
function todayYmdUtc(): string {
	const n = new Date();
	return `${n.getUTCFullYear()}${String(n.getUTCMonth() + 1).padStart(2, '0')}${String(n.getUTCDate()).padStart(2, '0')}`;
}

function tomorrowYmdUtc(): string {
	const n = new Date();
	const t = new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate() + 1));
	return `${t.getUTCFullYear()}${String(t.getUTCMonth() + 1).padStart(2, '0')}${String(t.getUTCDate()).padStart(2, '0')}`;
}

function details(url: string): string {
	const m = url.match(/details=([^&]+)/);
	return m ? decodeURIComponent(m[1]) : '';
}

describe('eventDateIsPlaceholder', () => {
	it('is true for an empty / missing / unparseable date', () => {
		expect(eventDateIsPlaceholder({ Title: 'X', Date: '' } as ScoutEvent)).toBe(true);
		expect(eventDateIsPlaceholder({ Title: 'X' } as unknown as ScoutEvent)).toBe(true);
		expect(eventDateIsPlaceholder({ Title: 'X', Date: 'sometime this fall' } as ScoutEvent)).toBe(true);
	});

	it('is false for a genuine date or range', () => {
		expect(eventDateIsPlaceholder({ Title: 'X', Date: 'Sep 10, 2026' } as ScoutEvent)).toBe(false);
		expect(eventDateIsPlaceholder({ Title: 'X', Date: 'Aug 10, 2026 - Aug 20, 2026' } as ScoutEvent)).toBe(false);
	});
});

describe('createCalendarUrl — missing/unparseable date falls back to today (no blocker)', () => {
	it('empty Date, no time -> all-day today URL with a filled-in details param, NO error', () => {
		const event: ScoutEvent = {
			Title: 'Transit Month Webinar',
			Date: '',
			Location: 'Online',
			Description: 'Virtual conversation about the regional transit network. Register online.',
			DateConfidence: 'low',
			DateNote: 'No specific day or date range is mentioned for this webinar.',
			DateContext: 'Register online; a recording will be shared afterward.',
		};
		const result = createCalendarUrl(event, 'Fwd: September is Transit Month!', 'Sep 10, 2026');
		expect(typeof result).toBe('string');
		const url = result as string;

		expect(url).toContain('https://www.google.com/calendar/render?action=TEMPLATE');
		expect(url).toContain(`dates=${todayYmdUtc()}/${tomorrowYmdUtc()}`);
		expect(url).toContain('text=Transit%20Month%20Webinar');

		const d = details(url);
		expect(d).toContain('Virtual conversation about the regional transit network'); // existing description carried
		expect(d).toContain('From the newsletter: "Register online; a recording will be shared afterward."');
		expect(d).toContain('Location: Online');
		expect(d).toContain('Date note: No specific day or date range is mentioned for this webinar.');
		expect(d).toMatch(/could not determine the date for this event\. It has been set to .+ as a placeholder/);
		expect(d).toContain('(Added via sendtoschedule.com)');
	});

	it('empty Date but a parsed time present -> today at that time, +1h block', () => {
		const event: ScoutEvent = { Title: 'Transit Month Webinar', Date: '', Time: '6:00pm' };
		const result = createCalendarUrl(event, 'subj', 'Sep 10, 2026');
		expect(typeof result).toBe('string');
		const url = result as string;
		// timed (not all-day) span, starting today at 18:00 UTC, ending 19:00 UTC
		expect(url).toContain(`dates=${todayYmdUtc()}T180000/${todayYmdUtc()}T190000`);
		expect(details(url)).toMatch(/as a placeholder/);
	});

	it('non-empty but unparseable Date -> placeholder today, raw text surfaced verbatim', () => {
		const event: ScoutEvent = { Title: 'Bike Classes Planning Survey', Date: 'sometime this fall', Location: 'Online' };
		const result = createCalendarUrl(event, 'subj', 'Sep 10, 2026');
		expect(typeof result).toBe('string');
		const d = details(result as string);
		expect(d).toContain('Date text seen: "sometime this fall"');
		expect(d).toContain('Location: Online');
	});

	it('empty Date AND an ambiguous time -> still all-day today, not a double blocker', () => {
		const event: ScoutEvent = { Title: 'Survey', Date: '', Time: '8:30' };
		const result = createCalendarUrl(event, 'subj', 'Sep 10, 2026');
		expect(typeof result).toBe('string');
		const url = result as string;
		expect(url).toContain(`dates=${todayYmdUtc()}/${tomorrowYmdUtc()}`);
		expect(details(url)).toContain('Time text seen: "8:30"');
	});

	it('empty Title falls back to a sensible default title', () => {
		const event: ScoutEvent = { Title: '', Date: '', Description: 'A dateless thing worth noting.' };
		const result = createCalendarUrl(event, 'subj', 'Sep 10, 2026');
		expect(typeof result).toBe('string');
		expect(result as string).toContain('text=Untitled%20event%20(from%20newsletter)');
	});
});

describe('createCalendarUrl — the ONE remaining true blocker', () => {
	it('an event with no title, no description, no date and no time still returns an error', () => {
		const result = createCalendarUrl({ Title: '', Date: '' } as ScoutEvent, 'subj', 'Sep 10, 2026');
		expect(typeof result).toBe('object');
		expect((result as { error: string }).error).toBeTruthy();
	});
});

describe('createCalendarUrl — genuine valid date is unchanged (regression)', () => {
	it('all-day plain date: exact dates= and description format preserved', () => {
		const url = createCalendarUrl(
			{ Title: 'Book Fair', Date: 'Aug 10, 2026', Description: 'Come browse books.', Location: 'Library' } as ScoutEvent,
			'subj',
			'Aug 1, 2026'
		) as string;
		expect(url).toMatch(/dates=20260810\/20260811/);
		const d = details(url);
		// unchanged legacy order: date/time line, Location, description, blank, footer
		expect(d).toMatch(/^Monday, Aug 10, 2026 \(all-day\)\nLocation: Library\nCome browse books\.\n\n\(Added via sendtoschedule\.com\)$/);
		expect(d).not.toMatch(/as a placeholder/);
	});
});

describe('buildReportEmail card — placeholder-date event', () => {
	const placeholderEvent: ScoutEvent = {
		Title: 'Transit Month Webinar',
		Date: '',
		Location: 'Online',
		Description: 'Virtual conversation about the regional transit network.',
		DateConfidence: 'low',
		DateNote: 'No specific day or date range is mentioned for this webinar.',
		DateContext: 'Register online; a recording will be shared afterward.',
	};

	it('renders an ENABLED "Add to Calendar (set the date)" link and keeps the ⚠ warnings', () => {
		const { html } = buildReportEmail([placeholderEvent], 'Fwd: September is Transit Month!', 'Sep 10, 2026', false, 'summary');
		expect(html).toContain('https://www.google.com/calendar/render?action=TEMPLATE');
		expect(html).toContain('Add to Calendar (set the date)');
		expect(html).not.toContain('Cannot add (date error)');
		// keeps the low-confidence DateNote ⚠ line
		expect(html).toContain('No specific day or date range is mentioned for this webinar.');
		// amber "date not found" notice replaces the old red "Could not parse date" line
		expect(html).toContain('Date not found in the newsletter');
		expect(html).toContain('#92600A');
		expect(html).not.toContain('Could not parse date');
	});

	it('a truly empty event (no title/desc/date/time) still shows the disabled blocker', () => {
		const { html } = buildReportEmail([{ Title: '', Date: '' } as ScoutEvent], 'subj', 'Sep 10, 2026', false, 'summary');
		expect(html).toContain('Cannot add (date error)');
	});

	it('a valid-date event still renders the normal "Add to Calendar" button (regression)', () => {
		const { html } = buildReportEmail(
			[{ Title: 'Book Fair', Date: 'Aug 10, 2026', DateConfidence: 'high' } as ScoutEvent],
			'subj',
			'Aug 1, 2026',
			false,
			'summary'
		);
		expect(html).toContain('>Add to Calendar</a>');
		expect(html).not.toContain('set the date');
		expect(html).not.toContain('Date not found in the newsletter');
	});
});

describe('NO_DATE_EVENTS_SAMPLE — nightly-harness shape, run offline', () => {
	// Mirrors runOneCase() in regression-test.ts: a Gemini-style response for the
	// dateless "Transit Month" newsletter -> the production resolveEventTimes()
	// pass -> createCalendarUrl() -> the same well-formed-URL check the nightly
	// harness uses. Every event must be addable; none may come back a bare blocker.
	it('every dateless event yields a well-formed, addable calendar URL', () => {
		const events: ScoutEvent[] = [
			{
				Title: 'Transit Month Webinar',
				Date: '',
				Time: '',
				Location: 'Online',
				Description: 'Virtual conversation about what is next for the regional transit network.',
				DateConfidence: 'low',
				DateNote: 'No specific day or date range is mentioned for this webinar.',
				DateContext: 'Register online; a recording will be shared afterward with everyone who signs up.',
			},
			{
				Title: 'Bike Classes Planning Survey',
				Date: '',
				Time: '',
				Location: 'Online',
				Description: 'Short online survey about fall/winter adult bike education classes.',
				DateConfidence: 'low',
				DateNote: 'No specific day or date range is mentioned for this survey.',
				DateContext: 'Take the short online survey to tell us which class types, days, and neighborhoods work best.',
			},
		];

		resolveEventTimes(events, { subject: NO_DATE_EVENTS_SAMPLE.subject, body: NO_DATE_EVENTS_SAMPLE.body });

		expect(events.length).toBeGreaterThanOrEqual(NO_DATE_EVENTS_SAMPLE.minExpectedEvents);
		for (const ev of events) {
			const result = createCalendarUrl(ev, NO_DATE_EVENTS_SAMPLE.subject, 'Sep 10, 2026');
			expect(typeof result, `event "${ev.Title}" should get a link, not an error`).toBe('string');
			expect(checkCalendarUrlWellFormed(result as string, `event "${ev.Title}"`)).toBeNull();
			expect(result as string).toContain(`dates=${todayYmdUtc()}/${tomorrowYmdUtc()}`);
		}
	});
});
