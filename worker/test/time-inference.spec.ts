import { describe, it, expect } from 'vitest';
import { inferAmPm, normalize24Hour, resolveEventTimes, parseTime, createCalendarUrl } from '../src/calendar-utils';
import { buildReportEmail } from '../src/email-templates';
import { checkCalendarUrlWellFormed } from '../src/regression-test';
import type { ScoutEvent } from '../src/types';

// Deterministic AM/PM resolution for the newsletter / announcement domain.
// See calendar-utils.ts inferAmPm / resolveEventTimes. Rule set (priority order):
//   R0 explicit 24-hour time            -> reformat, high, no note, no justification
//   R1 bare "12" / "12:xx"              -> PM (noon), high, no ⚠ note, + justification
//   R2 AM keyword / time-adjacent "am"  -> AM, high, no ⚠ note, + justification
//   R3 bare time, every hour 1-6        -> PM, high, no ⚠ note, + justification
//   R4 evening keyword                  -> PM, high, no ⚠ note, + justification
//   R5 afterschool keyword              -> PM, high, no ⚠ note, + justification
//   otherwise (bare 7-11, no keyword)   -> null (stays ambiguous, hard error downstream)
//
// The `justification` string is what resolveEventTimes appends to event.Description
// so the reasoning travels onto the user's calendar, not just the report email.

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

describe('inferAmPm — R0: explicit 24-hour time', () => {
	it('reformats "15:30" to 12-hour, high confidence, NO note, NO justification', () => {
		const r = inferAmPm('15:30', { body: 'Meeting at 15:30 in room 4.' });
		expect(r).toEqual({ time: '3:30pm', note: '', justification: '', confidence: 'high' });
	});

	it('treats a leading-zero "08:00" as an explicit (AM) 24-hour time', () => {
		const r = inferAmPm('08:00', {});
		expect(r).toEqual({ time: '8:00am', note: '', justification: '', confidence: 'high' });
	});

	it('reformats a 24-hour range', () => {
		expect(inferAmPm('08:00-17:00', {})!.time).toBe('8:00am-5:00pm');
	});
});

describe('inferAmPm — R1: bare 12 o’clock is noon', () => {
	it('bare "12:00" -> 12:00pm (noon), high, no ⚠ note, with a justification', () => {
		const r = inferAmPm('12:00', {});
		expect(r!.time).toBe('12:00pm');
		expect(r!.confidence).toBe('high');
		expect(r!.note).toBe('');
		expect(r!.justification).toBe('⏰ Time note: "12:00" had no am/pm; read as 12:00 PM (noon).');
	});

	it('bare "12:30" -> 12:30pm', () => {
		expect(inferAmPm('12:30', {})!.time).toBe('12:30pm');
	});

	it('bare "12:00" lands at 12:00 UTC (noon) once applied', () => {
		const url = createCalendarUrl({ Title: 'Lunch', Date: 'Sep 10, 2026', Time: '12:00pm' } as ScoutEvent, 'subj', 'Sep 1, 2026');
		expect(typeof url).toBe('string');
		expect(url as string).toContain('20260910T120000');
	});
});

describe('inferAmPm — R2: AM keywords / time-adjacent "am" token', () => {
	it('"breakfast" context -> AM, high, no ⚠ note, justification names the keyword', () => {
		const r = inferAmPm('8:30', { body: 'Join us for the breakfast meet-and-greet at 8:30.' });
		expect(r!.time).toBe('8:30am');
		expect(r!.confidence).toBe('high');
		expect(r!.note).toBe('');
		expect(r!.justification).toBe('⏰ Time note: "8:30" had no am/pm; read as 8:30 AM based on "breakfast" in the announcement.');
	});

	it('"morning drop-off" context -> AM', () => {
		expect(inferAmPm('8', { body: 'Morning drop-off begins at 8 sharp.' })!.time).toBe('8am');
	});

	it('"assembly" context -> AM', () => {
		expect(inferAmPm('9', { subject: 'Grade 4 assembly', body: 'Starts at 9.' })!.time).toBe('9am');
	});

	it('a time-adjacent "am" token in prose -> AM ("10 am")', () => {
		expect(inferAmPm('3', { body: 'The picnic kicks off at 10 am.' })!.time).toBe('3am');
	});

	it('a time-adjacent "a.m." token -> AM ("9 a.m.")', () => {
		expect(inferAmPm('9', { body: 'Doors open at 9 a.m. sharp.' })!.time).toBe('9am');
	});

	it('a stray prose "am" NOT next to a digit does NOT force AM', () => {
		// "I am thrilled" must not trigger R2; hour 5 then falls to R3 -> PM.
		const r = inferAmPm('5', { body: 'I am thrilled — dinner at 5.' });
		expect(r!.time).toBe('5pm');
		expect(r!.confidence).toBe('high');
	});

	it('R2 beats R3: "breakfast at 6" is 6 AM, not 6 PM', () => {
		expect(inferAmPm('6', { body: 'Come to the pancake breakfast at 6.' })!.time).toBe('6am');
	});
});

describe('inferAmPm — R3: bare 1–6 o’clock is PM (broadened newsletter-domain rule)', () => {
	it('bare "1:00" -> PM, high, no ⚠ note, with a justification', () => {
		const r = inferAmPm('1:00', {});
		expect(r!.time).toBe('1:00pm');
		expect(r!.confidence).toBe('high');
		expect(r!.note).toBe('');
		expect(r!.justification).toContain('the announcement said "1:00" with no am/pm');
		expect(r!.justification).toContain('Read as 1:00 PM');
		expect(r!.justification).toContain('Verify against the original if this looks off.');
	});

	it('bare "3:30" with no keywords -> PM', () => {
		expect(inferAmPm('3:30', {})!.time).toBe('3:30pm');
	});

	it('bare "5:00" -> PM', () => {
		expect(inferAmPm('5:00', {})!.time).toBe('5:00pm');
	});

	it('bare "6" (upper boundary) -> PM', () => {
		expect(inferAmPm('6', {})!.time).toBe('6pm');
	});

	it('range "3-5" with no keywords -> both ends PM', () => {
		const r = inferAmPm('3-5', {});
		expect(r!.time).toBe('3-5pm');
		expect(r!.confidence).toBe('high');
		expect(r!.note).toBe('');
		expect(parseTime(r!.time)).toEqual({ start: '3pm', end: '5pm' });
	});

	it('range "3:30-5:00" with no keywords -> both ends PM', () => {
		expect(inferAmPm('3:30-5:00', {})!.time).toBe('3:30-5:00pm');
	});

	it('a bare irrelevant "See attached" context does NOT block R3', () => {
		expect(inferAmPm('3:30', { body: 'See attached.' })!.time).toBe('3:30pm');
	});
});

describe('inferAmPm — R4: evening keywords (covers hours 7–11)', () => {
	it('"dinner" -> PM even for an out-of-1–6 hour, justification names the keyword', () => {
		const r = inferAmPm('9:00', { body: 'Potluck dinner, please arrive by 9:00.' });
		expect(r!.time).toBe('9:00pm');
		expect(r!.justification).toBe('⏰ Time note: "9:00" had no am/pm; read as 9:00 PM based on "dinner" in the announcement.');
	});

	it('"tonight" -> PM', () => {
		expect(inferAmPm('7', { body: 'Concert is tonight at 7.' })!.time).toBe('7pm');
	});

	it('"after work" -> PM', () => {
		expect(inferAmPm('8', { body: 'After work mixer at 8.' })!.time).toBe('8pm');
	});
});

describe('inferAmPm — R5: afterschool keywords', () => {
	it('"afterschool pickup" -> PM (no hour restriction any more), justification names the keyword', () => {
		const r = inferAmPm('9:00', { body: 'Afterschool club runs late; pickup at 9:00.' });
		expect(r!.time).toBe('9:00pm');
		expect(r!.justification).toBe('⏰ Time note: "9:00" had no am/pm; read as 9:00 PM based on "afterschool" in the announcement.');
	});

	it('"rehearsal" -> PM', () => {
		expect(inferAmPm('7:30', { subject: 'Play rehearsal', body: 'Call time 7:30.' })!.time).toBe('7:30pm');
	});
});

describe('inferAmPm — stays ambiguous', () => {
	it('bare "8:00" with no keyword -> null', () => {
		expect(inferAmPm('8:00', {})).toBeNull();
	});

	it('bare "9:00" with only irrelevant context -> null', () => {
		expect(inferAmPm('9:00', { body: 'See attached.' })).toBeNull();
	});

	it('bare "11" -> null', () => {
		expect(inferAmPm('11', {})).toBeNull();
	});

	it('range "8-10" (hours outside 1–6) with no keyword -> null', () => {
		expect(inferAmPm('8-10', {})).toBeNull();
	});

	it('does nothing when the time already has am/pm', () => {
		expect(inferAmPm('3:30pm', { body: 'afterschool pickup' })).toBeNull();
	});
});

describe('resolveEventTimes — write-back onto events', () => {
	it('resolves a bare 1–6 time to PM: high confidence, NO ⚠ note, TimeInferred flag set', () => {
		const events: ScoutEvent[] = [{ Title: 'Chess Club', Date: 'Sep 10, 2026', Time: '3:30' }];
		resolveEventTimes(events, { subject: 'Chess Club', body: 'Weekly chess club.' });
		expect(events[0].Time).toBe('3:30pm');
		expect(events[0].TimeConfidence).toBe('high');
		expect(events[0].TimeInferenceNote).toBeUndefined();
		expect(events[0].TimeInferred).toBe(true);
	});

	it('resolves a bare "12:00" to noon', () => {
		const events: ScoutEvent[] = [{ Title: 'Lunch', Date: 'Sep 10, 2026', Time: '12:00' }];
		resolveEventTimes(events, {});
		expect(events[0].Time).toBe('12:00pm');
		expect(events[0].TimeConfidence).toBe('high');
		expect(events[0].TimeInferred).toBe(true);
	});

	it('resolves a bare AM-keyword time without a ⚠ note', () => {
		const events: ScoutEvent[] = [{ Title: 'Pancake Breakfast', Date: 'Sep 10, 2026', Time: '8' }];
		resolveEventTimes(events, { body: 'Pancake breakfast, doors at 8.' });
		expect(events[0].Time).toBe('8am');
		expect(events[0].TimeConfidence).toBe('high');
		expect(events[0].TimeInferenceNote).toBeUndefined();
		expect(events[0].TimeInferred).toBe(true);
	});

	it('leaves an explicit am/pm time untouched and marks it high confidence', () => {
		const events: ScoutEvent[] = [{ Title: 'Recital', Date: 'Sep 10, 2026', Time: '6:30-8:00pm', Description: 'Evening recital.' }];
		resolveEventTimes(events, { body: 'evening recital' });
		expect(events[0].Time).toBe('6:30-8:00pm');
		expect(events[0].TimeConfidence).toBe('high');
		expect(events[0].TimeInferenceNote).toBeUndefined();
		expect(events[0].TimeInferred).toBeUndefined();
		expect(events[0].Description).toBe('Evening recital.'); // not touched
	});

	it('trusts a note Gemini already supplied and does not re-run the rules', () => {
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
		expect(events[0].TimeInferred).toBe(true);
	});

	it('leaves a truly-ambiguous bare time alone so parseTime still rejects it', () => {
		const events: ScoutEvent[] = [{ Title: 'Mystery', Date: 'Sep 10, 2026', Time: '8:30' }];
		resolveEventTimes(events, { body: 'no time-of-day cues here' });
		expect(events[0].Time).toBe('8:30');
		expect(events[0].TimeConfidence).toBe('low');
		expect(events[0].TimeInferred).toBeUndefined();
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

describe('resolveEventTimes — time-inference justification travels in event.Description', () => {
	it('R3: appends the note after the existing description, blank-line separated', () => {
		const events: ScoutEvent[] = [
			{ Title: 'Robotics', Date: 'Sep 10, 2026', Time: '3:30', Description: 'Robotics club, room 12.' },
		];
		resolveEventTimes(events, { body: 'Robotics club meets Thursday.' });
		// existing text preserved, blank-line separated, then the note
		expect(events[0].Description).toMatch(/^Robotics club, room 12\.\n\n⏰ Time note: the announcement said "3:30" with no am\/pm\. Read as 3:30 PM /);
		expect(events[0].Description).toContain('are afternoon events. Verify against the original if this looks off.');
	});

	it('R1: sets the Description to the noon note when there was no description', () => {
		const events: ScoutEvent[] = [{ Title: 'Volunteer Lunch', Date: 'Sep 10, 2026', Time: '12:00' }];
		resolveEventTimes(events, {});
		expect(events[0].Description).toBe('⏰ Time note: "12:00" had no am/pm; read as 12:00 PM (noon).');
	});

	it('R2: names the AM keyword that drove the reading', () => {
		const events: ScoutEvent[] = [
			{ Title: 'Pancake Breakfast', Date: 'Sep 10, 2026', Time: '8:00', Description: 'In the gym.' },
		];
		resolveEventTimes(events, { body: 'Annual pancake breakfast fundraiser.' });
		expect(events[0].Description).toBe(
			'In the gym.\n\n⏰ Time note: "8:00" had no am/pm; read as 8:00 AM based on "breakfast" in the announcement.'
		);
	});

	it('Gemini prose inference: its own note text becomes the justification', () => {
		const events: ScoutEvent[] = [
			{
				Title: 'Open House',
				Date: 'Sep 10, 2026',
				Time: '7:00pm',
				TimeInferenceNote: 'Read "7" as PM because the passage describes an evening reception.',
				Description: 'Meet the teachers.',
			},
		];
		resolveEventTimes(events, {});
		expect(events[0].Description).toBe(
			'Meet the teachers.\n\n⏰ Time note: Read "7" as PM because the passage describes an evening reception.'
		);
	});

	it('unresolved 7–11 time: appends a "please confirm" note in case an event is still built', () => {
		const events: ScoutEvent[] = [{ Title: 'Rummage Sale', Date: 'Sep 10, 2026', Time: '8:00' }];
		resolveEventTimes(events, { body: 'Rummage sale in the gym.' });
		expect(events[0].Description).toBe(
			'⏰ Time note: the announcement said "8:00" with no am/pm and context didn\'t make it clear. ' +
				'Please confirm the time before relying on this event.'
		);
	});

	it('the justification is carried into the Google Calendar URL details param', () => {
		const events: ScoutEvent[] = [{ Title: 'Chess Club', Date: 'Sep 10, 2026', Time: '3:30' }];
		resolveEventTimes(events, { body: 'Weekly chess club.' });
		const url = createCalendarUrl(events[0], 'subj', 'Sep 1, 2026');
		expect(typeof url).toBe('string');
		expect(url as string).toContain('Time%20note'); // url-encoded "Time note"
	});
});

describe('report email surfaces inferred times', () => {
	it('labels a deterministically-resolved time "(inferred from context)" with NO ⚠ note line', () => {
		const events: ScoutEvent[] = [{ Title: 'Robotics', Date: 'Sep 10, 2026', Time: '3:30pm', TimeConfidence: 'high', TimeInferred: true }];
		const { html } = buildReportEmail(events, 'Robotics Club', 'Sep 1, 2026', false, 'summary');
		expect(html).toContain('(inferred from context)');
		expect(html).not.toContain('⚠'); // no warning triangle at all for a clean, resolved card
		expect(html).toContain('Add to Calendar');
	});

	it('labels an inferred time AND shows the ⚠ note when Gemini supplied one', () => {
		const events: ScoutEvent[] = [
			{
				Title: 'Robotics',
				Date: 'Sep 10, 2026',
				Time: '8:00pm',
				TimeConfidence: 'low',
				TimeInferred: true,
				TimeInferenceNote: 'Read "8" as PM because the passage describes families arriving after sunset.',
			},
		];
		const { html } = buildReportEmail(events, 'Robotics Club', 'Sep 1, 2026', false, 'summary');
		expect(html).toContain('(inferred from context)');
		expect(html).toContain('the passage describes families arriving after sunset');
	});

	it('does NOT add the "(inferred from context)" label for an explicit time', () => {
		const events: ScoutEvent[] = [{ Title: 'Assembly', Date: 'Sep 10, 2026', Time: '9:00am', TimeConfidence: 'high' }];
		const { html } = buildReportEmail(events, 'Assembly', 'Sep 1, 2026', false, 'summary');
		expect(html).not.toContain('(inferred from context)');
	});

	it('still shows the ⚠ ambiguous-time error when nothing could resolve it', () => {
		const events: ScoutEvent[] = [{ Title: 'Unknown', Date: 'Sep 10, 2026', Time: '8:30', TimeConfidence: 'low' }];
		const { html } = buildReportEmail(events, 'Unknown', 'Sep 1, 2026', false, 'summary');
		expect(html).toContain('Calendar date error');
		expect(html).toMatch(/ambiguous/i);
	});
});

describe('bare meridiem as Time ("PM") — no crash, resolves to an all-day event', () => {
	// Regression: the 2026-08-30 nightly regression test failed because real Gemini
	// returned Time: "PM" (a meridiem, no clock time) for the Pinecrest "soccer
	// game … kickoff is usually right after school lets out" line. parseTime("PM")
	// fell through to its "Could not parse time" error and createCalendarUrl()
	// handed that back. A lone meridiem now means "no time given" -> all-day.

	it('parseTime() treats a lone "PM" / " pm " / "AM" / "p.m." as no time (null), not an error', () => {
		expect(parseTime('PM')).toBeNull();
		expect(parseTime(' pm ')).toBeNull();
		expect(parseTime('AM')).toBeNull();
		expect(parseTime('p.m.')).toBeNull();
	});

	it('parseTime() still rejects a real bare clock time with no am/pm (genuine ambiguity kept)', () => {
		const r = parseTime('3:30');
		expect(typeof r === 'object' && r !== null && 'error' in r).toBe(true);
	});

	it('inferAmPm() never synthesizes a value from a digit-less string', () => {
		expect(inferAmPm('PM')).toBeNull();
		expect(inferAmPm(' pm ', { body: 'afterschool pickup, dinner, tonight' })).toBeNull();
		expect(inferAmPm('AM', { body: 'breakfast drop-off' })).toBeNull();
	});

	it('resolveEventTimes() strips a bare "PM" Time to "" and marks the event all-day / high confidence', () => {
		const events: ScoutEvent[] = [{ Title: '4th/5th Grade Soccer Game vs Cedar Valley', Date: 'Sep 1, 2026', Time: 'PM' }];
		resolveEventTimes(events, { body: "I don't have the exact kickoff time locked down yet but it's usually right after school lets out" });
		expect(events[0].Time).toBe('');
		expect(events[0].TimeConfidence).toBe('high');
	});

	it('createCalendarUrl() returns a valid all-day URL (NOT an error) for an event whose Time is a bare "PM"', () => {
		const event: ScoutEvent = { Title: '4th/5th Grade Soccer Game vs Cedar Valley', Date: 'Sep 1, 2026', Time: 'PM' };
		const url = createCalendarUrl(event, 'Fwd: Pinecrest Panthers Weekly Update', 'Aug 30, 2026');
		expect(typeof url).toBe('string');
		expect(url as string).toContain('https://www.google.com/calendar/render?action=TEMPLATE');
		expect(url as string).toContain('dates=20260901/20260902'); // all-day span, not a time error
	});

	it('Pinecrest-style "soccer game, no clock time" produces a usable all-day calendar entry end to end', () => {
		// Mirrors what the nightly regression harness does: Gemini output -> resolveEventTimes
		// (production path) -> createCalendarUrl -> the same well-formed-URL check the
		// nightly test uses (checkCalendarUrlWellFormed in regression-test.ts).
		const events: ScoutEvent[] = [
			{
				Title: '4th/5th Grade Soccer Game vs Cedar Valley',
				Date: 'Sep 1, 2026',
				Time: 'PM',
				Description: 'First home game against Cedar Valley — everyone welcome to come cheer.',
			},
		];
		resolveEventTimes(events, {
			subject: 'Fwd: Pinecrest Panthers Weekly Update',
			body: "the 4th/5th grade soccer team has their first home game next Tuesday against Cedar Valley … it's usually right after school lets out",
		});
		const result = createCalendarUrl(events[0], 'Fwd: Pinecrest Panthers Weekly Update', 'Aug 30, 2026');
		expect(typeof result).toBe('string');
		expect(checkCalendarUrlWellFormed(result as string, 'soccer game')).toBeNull();
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
