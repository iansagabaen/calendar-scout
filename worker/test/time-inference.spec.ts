import { describe, it, expect } from 'vitest';
import { inferAmPm, normalize24Hour, resolveEventTimes, parseTime, createCalendarUrl } from '../src/calendar-utils';
import { buildReportEmail } from '../src/email-templates';
import type { ScoutEvent } from '../src/types';

// Context-based AM/PM inference — the deterministic safety net that runs when
// Gemini leaves a time bare. See calendar-utils.ts inferAmPm / resolveEventTimes.

describe('normalize24Hour', () => {
	it('reformats a single 24-hour time to 12-hour + suffix', () => {
		expect(normalize24Hour('15:30')).toBe('3:30pm');
	});

	it('reformats a 24-hour range, resolving each end independently', () => {
		expect(normalize24Hour('08:00-17:00')).toBe('8:00am-5:00pm');
	});

	it('treats midnight / noon correctly', () => {
		expect(normalize24Hour('00:15')).toBe('12:15am');
		// 12:00 with no >=13 hour and no leading-zero is NOT considered 24-hour
		expect(normalize24Hour('12:00')).toBeNull();
	});

	it('returns null for a bare 12-hour time or range (not 24-hour)', () => {
		expect(normalize24Hour('3:30')).toBeNull();
		expect(normalize24Hour('3-5')).toBeNull();
	});

	it('returns null when an explicit am/pm is already present', () => {
		expect(normalize24Hour('3:30pm')).toBeNull();
	});
});

describe('inferAmPm — deterministic heuristic fallback', () => {
	it('afterschool context + 1–6 start hour -> PM', () => {
		const r = inferAmPm('3:30', { body: 'Pickup for the afterschool program is at 3:30.' });
		expect(r).not.toBeNull();
		expect(r!.time).toBe('3:30pm');
		expect(r!.confidence).toBe('low');
		expect(r!.note).toMatch(/PM/);
	});

	it('practice context + bare range "3-5" -> PM range (context resolves it)', () => {
		const r = inferAmPm('3-5', { subject: 'Soccer practice schedule' });
		expect(r).not.toBeNull();
		expect(r!.time).toBe('3-5pm');
		// parseTime then propagates the suffix to both ends
		expect(parseTime(r!.time)).toEqual({ start: '3pm', end: '5pm' });
	});

	it('breakfast context -> AM', () => {
		const r = inferAmPm('8:30', { body: 'Join us for the breakfast meet-and-greet at 8:30.' });
		expect(r).not.toBeNull();
		expect(r!.time).toBe('8:30am');
		expect(r!.note).toMatch(/AM/);
	});

	it('drop-off / morning context -> AM', () => {
		const r = inferAmPm('8', { body: 'Morning drop-off begins at 8 sharp.' });
		expect(r!.time).toBe('8am');
	});

	it('evening keyword ("dinner") -> PM regardless of hour', () => {
		const r = inferAmPm('6:30', { body: 'Family dinner night, come by at 6:30.' });
		expect(r!.time).toBe('6:30pm');
	});

	it('"tonight" -> PM', () => {
		const r = inferAmPm('7', { body: 'Concert is tonight at 7.' });
		expect(r!.time).toBe('7pm');
	});

	it('explicit 24-hour time is respected as-is, with NO inference note', () => {
		const r = inferAmPm('15:30', { body: 'Meeting at 15:30 in room 4.' });
		expect(r).not.toBeNull();
		expect(r!.time).toBe('3:30pm');
		expect(r!.note).toBe('');
		expect(r!.confidence).toBe('high');
	});

	it('truly ambiguous: bare time with no useful context -> null (stays ambiguous)', () => {
		expect(inferAmPm('3:30', { body: 'See attached.' })).toBeNull();
		expect(inferAmPm('3:30', {})).toBeNull();
	});

	it('afterschool context but start hour outside 1–6 -> null (not resolved)', () => {
		expect(inferAmPm('9:00', { body: 'Afterschool club meets at 9:00.' })).toBeNull();
	});

	it('bare range "3-5" with no context keyword stays ambiguous', () => {
		expect(inferAmPm('3-5', {})).toBeNull();
	});

	it('does nothing when the time already has am/pm', () => {
		expect(inferAmPm('3:30pm', { body: 'afterschool pickup' })).toBeNull();
	});
});

describe('resolveEventTimes — write-back onto events', () => {
	it('adds an inferred suffix + note for a bare time in afterschool context', () => {
		const events: ScoutEvent[] = [{ Title: 'Chess Club', Date: 'Sep 10, 2026', Time: '3:30' }];
		resolveEventTimes(events, { subject: 'Chess Club', body: 'Afterschool chess club, pickup at 3:30.' });
		expect(events[0].Time).toBe('3:30pm');
		expect(events[0].TimeConfidence).toBe('low');
		expect(events[0].TimeInferenceNote).toBeTruthy();
	});

	it('leaves an explicit am/pm time untouched and marks it high confidence', () => {
		const events: ScoutEvent[] = [{ Title: 'Recital', Date: 'Sep 10, 2026', Time: '6:30-8:00pm' }];
		resolveEventTimes(events, { body: 'evening recital' });
		expect(events[0].Time).toBe('6:30-8:00pm');
		expect(events[0].TimeConfidence).toBe('high');
		expect(events[0].TimeInferenceNote).toBeUndefined();
	});

	it('trusts a note Gemini already supplied and does not re-run heuristics', () => {
		const events: ScoutEvent[] = [
			{
				Title: 'Bake Sale',
				Date: 'Sep 10, 2026',
				Time: '9:00am',
				TimeConfidence: 'high',
				TimeInferenceNote: 'Read "9" as AM because it is a morning bake sale.',
			},
		];
		resolveEventTimes(events, { body: 'dinner tonight' }); // misleading context ignored
		expect(events[0].Time).toBe('9:00am');
		expect(events[0].TimeInferenceNote).toBe('Read "9" as AM because it is a morning bake sale.');
	});

	it('leaves a truly-ambiguous bare time alone so parseTime still rejects it', () => {
		const events: ScoutEvent[] = [{ Title: 'Mystery', Date: 'Sep 10, 2026', Time: '3:30' }];
		resolveEventTimes(events, { body: 'no time-of-day cues here' });
		expect(events[0].Time).toBe('3:30');
		expect(events[0].TimeConfidence).toBe('low');
		const url = createCalendarUrl(events[0], 'subj', 'Sep 1, 2026');
		expect(typeof url).toBe('object');
		expect((url as { error: string }).error).toMatch(/ambiguous/i);
	});

	it('handles events with no Time without throwing', () => {
		const events: ScoutEvent[] = [{ Title: 'All Day Thing', Date: 'Sep 10, 2026' }];
		resolveEventTimes(events, {});
		expect(events[0].Time).toBeUndefined();
		expect(events[0].TimeConfidence).toBe('high');
	});
});

describe('report email surfaces inferred times', () => {
	it('labels an inferred time "(inferred from context)" and shows the note', () => {
		const events: ScoutEvent[] = [
			{
				Title: 'Robotics',
				Date: 'Sep 10, 2026',
				Time: '3:30pm',
				TimeConfidence: 'low',
				TimeInferenceNote: 'Read "3:30" as PM — the email describes an afterschool activity.',
			},
		];
		const { html } = buildReportEmail(events, 'Robotics Club', 'Sep 1, 2026', false, 'summary');
		expect(html).toContain('(inferred from context)');
		// The inference note is rendered verbatim into the card.
		expect(html).toContain('the email describes an afterschool activity');
	});

	it('does NOT add the "(inferred from context)" label for an explicit time', () => {
		const events: ScoutEvent[] = [{ Title: 'Assembly', Date: 'Sep 10, 2026', Time: '9:00am', TimeConfidence: 'high' }];
		const { html } = buildReportEmail(events, 'Assembly', 'Sep 1, 2026', false, 'summary');
		expect(html).not.toContain('(inferred from context)');
	});

	it('still shows the ⚠ ambiguous-time error when nothing could resolve it', () => {
		const events: ScoutEvent[] = [{ Title: 'Unknown', Date: 'Sep 10, 2026', Time: '3:30', TimeConfidence: 'low' }];
		const { html } = buildReportEmail(events, 'Unknown', 'Sep 1, 2026', false, 'summary');
		expect(html).toContain('Calendar date error');
		expect(html).toMatch(/ambiguous/i);
	});
});

describe('parseTime remains strict for the un-inferrable', () => {
	it('rejects a bare time with no am/pm', () => {
		const r = parseTime('3:30');
		expect(r).not.toBeNull();
		expect(typeof r === 'object' && 'error' in r!).toBe(true);
	});

	it('rejects a bare range with no am/pm', () => {
		const r = parseTime('3-5');
		expect(typeof r === 'object' && r !== null && 'error' in r).toBe(true);
	});

	it('preserves UTC application of a resolved time (setUTCHours path)', () => {
		// 3:30pm on Sep 10 must land at 15:30 UTC, not shifted by a local offset.
		const url = createCalendarUrl({ Title: 'X', Date: 'Sep 10, 2026', Time: '3:30pm' } as ScoutEvent, 'subj', 'Sep 1, 2026');
		expect(typeof url).toBe('string');
		expect(url as string).toContain('20260910T153000');
	});
});
