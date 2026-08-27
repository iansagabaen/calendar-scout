// Ported near-verbatim from Code.js — none of this depended on Apps Script APIs,
// it's plain date math and string building for a Google Calendar "render" template URL.

import type { ScoutEvent } from './types';

export function formatDateCleanly(dateInput: Date | string | null | undefined): string {
	if (!dateInput) return 'Date not specified';
	const d = new Date(dateInput);
	if (isNaN(d.getTime())) return String(dateInput);

	// CRITICAL: Use UTC explicitly, not toLocaleDateString() which depends on server's
	// local timezone. Cloudflare Workers run in various geographic regions; a server in
	// UTC+12 would shift Aug 11 22:31 UTC to Aug 12, causing Gemini to see the wrong date.
	// This broke all relative-date parsing ("tomorrow" extracts 1 day too late).
	// See: projects/calendar-scout/bugs/2026-08-11-date-timezone-bug.md
	const month = d.getUTCMonth() + 1;
	const day = d.getUTCDate();
	const year = d.getUTCFullYear();
	const monthStr = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][month - 1];
	return `${monthStr} ${day}, ${year}`;
}

export function formatDateWithDay(dateInput: string | null | undefined): string {
	if (!dateInput) return 'Date not specified';
	const d = new Date(dateInput);
	if (isNaN(d.getTime())) return String(dateInput);

	// CRITICAL: Use UTC explicitly (see formatDateCleanly() comment above).
	// This function is used to display extracted event dates in email reports.
	const month = d.getUTCMonth() + 1;
	const day = d.getUTCDate();
	const year = d.getUTCFullYear();
	const monthStr = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][month - 1];
	const dayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d.getUTCDay()];
	return `${dayOfWeek}, ${monthStr} ${day}, ${year}`;
}

export function parseTime(timeStr: string | null | undefined): { start: string; end: string | null } | { error: string } | null {
	// Parses strings like "3:30-5:30pm", "4:00pm", "9:00pm", "3:30-10:00pm" or "3:30 to 5:30pm"
	// STRICT mode: rejects ambiguous input
	if (!timeStr) return null;

	// Check for range format (with explicit "to" or "-")
	// This regex captures: time1 (with optional am/pm), range delimiter, time2 (with optional am/pm), and optional trailing am/pm
	const rangeMatch = timeStr.match(/(\d{1,2}(?::\d{2})?)(?:\s*(am|pm))?\s*(?:to|-)\s*(\d{1,2}(?::\d{2})?)(?:\s*(am|pm))?\s*(am|pm)?/i);
	if (rangeMatch) {
		const start = rangeMatch[1];
		const startSuffix = rangeMatch[2];
		const end = rangeMatch[3];
		const endSuffix = rangeMatch[4];
		const trailingSuffix = rangeMatch[5];

		// Determine the suffix to use
		let suffix = startSuffix || endSuffix || trailingSuffix;

		// If no suffix at all, reject as ambiguous
		if (!suffix) {
			return { error: `Time range "${timeStr}" is ambiguous. Please specify am or pm, e.g., "3:00am to 5:00pm"` };
		}

		// Build the result with appropriate suffixes
		const startTime = startSuffix ? start + startSuffix : start + suffix;
		const endTime = endSuffix ? end + endSuffix : end + suffix;

		return { start: startTime, end: endTime };
	}

	// Single time like "9:00pm" — MUST have am/pm
	const single = timeStr.match(/(\d{1,2}(?::\d{2})?)\s*(am|pm)/i);
	if (single) {
		return { start: single[1] + single[2], end: null };
	}

	// Reject bare time like "3:30" without am/pm
	const bareTime = timeStr.match(/^\d{1,2}(?::\d{2})?$/);
	if (bareTime) {
		return { error: `Time "${timeStr}" is ambiguous. Please specify am or pm, e.g., "${timeStr}pm"` };
	}

	// Reject ambiguous range like "3-5" without am/pm
	const bareRange = timeStr.match(/^\d{1,2}\s*-\s*\d{1,2}$/);
	if (bareRange) {
		return { error: `Time range "${timeStr}" is ambiguous. Please specify am or pm, e.g., "3:00am to 5:00pm"` };
	}

	// Unrecognized format
	return { error: `Could not parse time "${timeStr}". Please use format like "3:00pm" or "3:00am to 5:00pm"` };
}

// ---------------------------------------------------------------------------
// AM/PM inference
// ---------------------------------------------------------------------------
// Gemini is one inference path (see the prompt in gemini.ts): it sees the whole
// email and can add an am/pm suffix when subtle prose makes it clear. The
// functions below are the DETERMINISTIC layer that runs on every event Gemini
// leaves bare. Its rule set is tuned to this product's domain — newsletters and
// announcements (school bulletins, community calendars, church bulletins, camp
// flyers) — where a bare "1"–"6 o'clock" time is PM in essentially every real
// case and a bare "12:00" means noon. Those resolutions are treated as plain
// reformatting, not guesses: confidence stays "high" and NO inference note is
// attached, so the report's ⚠ note line does not fire for them (the time is
// still visibly labelled "(inferred from context)"). Only a genuinely
// un-disambiguatable time (a bare 7–11 o'clock with no keyword) is left bare,
// and parseTime() then rejects it downstream with the hard ⚠️ "please specify
// am or pm" error — never silently defaulted.

const MERIDIEM_RE = /(a\.?m\.?|p\.?m\.?)/i;

/**
 * If `timeStr` is an explicit 24-hour time (a start hour of 0 or 13–23 appears),
 * rewrite it to a 12-hour string with am/pm suffixes. "15:30" -> "3:30pm",
 * "08:00-17:00" -> "8:00am-5:00pm". This is NOT inference — the sender stated the
 * exact time — so callers keep TimeConfidence "high" and add no inference note.
 * Returns null if the string is not a 24-hour time.
 */
export function normalize24Hour(timeStr: string): string | null {
	if (MERIDIEM_RE.test(timeStr)) return null;
	const tokens = [...timeStr.matchAll(/(\d{1,2})(?::(\d{2}))?/g)];
	if (tokens.length === 0) return null;
	const hours = tokens.map((t) => parseInt(t[1], 10));
	// Only treat as 24-hour when at least one hour is unambiguously 24-hour (0 with
	// a leading zero, or 13–23). Otherwise "3-5" is a bare 12-hour range, not 24h.
	const looks24h = tokens.some((t, i) => hours[i] >= 13 && hours[i] <= 23) || /\b0\d:/.test(timeStr);
	if (!looks24h) return null;

	let out = timeStr;
	// Replace each H or H:MM token, longest-first by position, with 12-hour + suffix.
	out = out.replace(/(\d{1,2})(?::(\d{2}))?/g, (_m, h: string, mm: string | undefined) => {
		let hh = parseInt(h, 10);
		if (hh < 0 || hh > 23) return _m;
		const suffix = hh >= 12 ? 'pm' : 'am';
		if (hh === 0) hh = 12;
		else if (hh > 12) hh -= 12;
		return mm ? `${hh}:${mm}${suffix}` : `${hh}${suffix}`;
	});
	return out;
}

export interface TimeInferenceContext {
	subject?: string;
	body?: string;
	title?: string;
	description?: string;
}

export interface InferAmPmResult {
	time: string;
	/**
	 * Almost always "". The deterministic rules below treat their resolutions as
	 * plain reformatting, not guesses, so they attach no note (the report then
	 * shows no ⚠ line for them). The field is kept because a caller MAY carry a
	 * Gemini-supplied note through the same shape.
	 */
	note: string;
	confidence: 'high' | 'low';
}

/**
 * Deterministic am/pm resolution for the newsletter / announcement domain.
 * Returns a resolved time (+ empty note), or null if the rules genuinely cannot
 * decide (caller then leaves the time bare -> parseTime rejects it with the hard
 * ⚠️ error).
 *
 * RULES, in priority order (first match wins):
 *   R0. Explicit 24-hour time — start hour 0 / leading-zero ("08:00"), or 13–23
 *       ("15:30")                                  -> reformat to 12-hour, "high", no note.
 *   R1. Bare "12" / "12:xx" (hour 12, no am/pm)    -> PM (noon), "high", no note.
 *   R2. AM keyword in context: "breakfast", "before school", "drop-off" /
 *       "drop off" / "dropoff", "morning", "assembly", or an explicit
 *       "a.m." / "am" token                        -> AM, "high", no note.
 *   R3. Bare time, EVERY hour token in 1–6 inclusive, and R2 did not fire
 *                                                  -> PM, "high", no note.
 *   R4. Evening keyword: "dinner", "evening", "tonight", "after work"
 *                                                  -> PM, "high", no note (covers hours 7–11).
 *   R5. Afterschool keyword: "afterschool" / "after school", "dismissal",
 *       "pickup" / "pick up" / "pick-up", "practice", "rehearsal"
 *                                                  -> PM, "high", no note.
 *   Otherwise (bare 7–11 o'clock, no keyword)      -> null (stays ambiguous).
 *
 * Ranges ("3-5", "3:30-5:00"): R3 fires when ALL hour tokens are 1–6, so both
 * ends resolve to PM. The suffix is appended once at the end; parseTime() then
 * propagates it to both ends of a range.
 */
export function inferAmPm(timeStr: string | null | undefined, context: TimeInferenceContext = {}): InferAmPmResult | null {
	if (!timeStr || !timeStr.trim()) return null;
	const raw = timeStr.trim();

	// Already carries an explicit am/pm — nothing to infer.
	if (MERIDIEM_RE.test(raw)) return null;

	// R0: explicit 24-hour time — honour it exactly, just reformat. Not a guess,
	// so no inference note and confidence stays "high".
	const as24h = normalize24Hour(raw);
	if (as24h) return { time: as24h, note: '', confidence: 'high' };

	// Hour of every "H" / "H:MM" token (minute digits ignored) so range forms
	// like "3-5" / "3:30-5:00" can be judged as a whole.
	const hourMatches = [...raw.matchAll(/(\d{1,2})(?::\d{2})?/g)];
	if (hourMatches.length === 0) return null;
	const hours = hourMatches.map((m) => parseInt(m[1], 10));
	const startHour = hours[0];

	// All deterministic resolutions are plain reformatting: high confidence, NO note.
	const pm = (): InferAmPmResult => ({ time: `${raw}pm`, note: '', confidence: 'high' });
	const am = (): InferAmPmResult => ({ time: `${raw}am`, note: '', confidence: 'high' });

	// R1: a bare "12" / "12:xx" is noon. Nobody writes a midnight event as a bare
	// "12:00" in a newsletter.
	if (startHour === 12) return pm();

	const ctx = [context.subject, context.body, context.title, context.description]
		.filter(Boolean)
		.join(' ')
		.toLowerCase();

	// R2: an explicit AM signal in the surrounding prose wins over the bare-hour
	// rule below — e.g. "breakfast at 6" is 6 AM, not 6 PM.
	const AM_KEYWORDS = /\b(breakfast|before school|drop[\s-]?off|morning|assembly)\b/;
	const AM_TOKEN = /\bam\b|\ba\.m\.?/;
	if (AM_KEYWORDS.test(ctx) || AM_TOKEN.test(ctx)) return am();

	// R3: broadened newsletter-domain rule. A bare time whose every hour is 1–6
	// is PM. The domain here is school bulletins, community calendars, church
	// bulletins and camp flyers — nobody advertises a 1–6 *AM* event in a
	// newsletter, and genuinely late-night venues always write the "am"/"pm"
	// suffix explicitly. So a bare "3:30" or "1-6" is safely PM with no warning.
	if (hours.every((h) => h >= 1 && h <= 6)) return pm();

	// R4: evening language -> PM, including the 7–11 o'clock hours R3 does not cover.
	if (/\b(dinner|evening|tonight|after work)\b/.test(ctx)) return pm();

	// R5: afterschool / activity language -> PM (dismissal, pickup, practice and
	// rehearsal all land in the afternoon or evening).
	if (/\b(afterschool|after school|dismissal|pick[\s-]?up|practice|rehearsal)\b/.test(ctx)) return pm();

	// Bare 7–11 o'clock with no disambiguating keyword: leave it bare so
	// parseTime() emits the hard "please specify am or pm" error downstream.
	return null;
}

/**
 * Walks the events Gemini returned and, for any event whose Time still lacks an
 * am/pm, runs the deterministic domain rules (inferAmPm) using the email context.
 * Mutates each event in place: sets Time (with suffix), TimeInferred,
 * TimeInferenceNote, TimeConfidence. Called once in the production pipeline
 * (index.ts) before the report is built, so both the report email and the
 * calendar URL read the same resolved Time.
 *
 * TimeInferred is set whenever a suffix was added that the sender did not write
 * (by these rules OR by Gemini) — that is the flag the report uses to append the
 * "(inferred from context)" label. TimeInferenceNote is set ONLY when there is a
 * sentence worth surfacing on the ⚠ line; the deterministic rules never set it,
 * so the ⚠ line does not fire for them.
 */
export function resolveEventTimes(events: ScoutEvent[], context: TimeInferenceContext = {}): void {
	for (const event of events) {
		const time = (event.Time || '').trim();
		if (!time) {
			event.TimeConfidence = event.TimeConfidence || 'high';
			continue;
		}

		// Gemini already inferred and explained it — trust that, don't re-run rules.
		if (event.TimeInferenceNote && event.TimeInferenceNote.trim()) {
			event.TimeConfidence = event.TimeConfidence || 'low';
			event.TimeInferred = true;
			continue;
		}

		// Explicit am/pm already present — high confidence, nothing to surface.
		if (MERIDIEM_RE.test(time)) {
			event.TimeConfidence = event.TimeConfidence || 'high';
			continue;
		}

		const inferred = inferAmPm(time, { ...context, title: event.Title, description: event.Description });
		if (inferred) {
			event.Time = inferred.time;
			event.TimeConfidence = inferred.confidence;
			event.TimeInferred = true;
			if (inferred.note) event.TimeInferenceNote = inferred.note;
		} else {
			// Could not resolve — leave Time bare. parseTime() will reject it and the
			// report shows the existing ⚠️ "please specify am or pm" error.
			event.TimeConfidence = 'low';
		}
	}
}

export function applyTime(dateObj: Date, timeStr: string): Date {
	// Applies a time string like "3:30pm" to a Date object using UTC-only methods
	// CRITICAL: Use setUTCHours() NOT setHours() to avoid timezone shifts
	const m = timeStr.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
	if (!m) return dateObj;
	let hours = parseInt(m[1], 10);
	const mins = parseInt(m[2] || '0', 10);
	const ampm = m[3].toLowerCase();
	if (ampm === 'pm' && hours !== 12) hours += 12;
	if (ampm === 'am' && hours === 12) hours = 0;
	dateObj.setUTCHours(hours, mins, 0, 0);
	return dateObj;
}

export function parseDateRange(dateStr: string): { start: Date; end: Date } | { error: string } | null {
	// Handles "August 10 - August 20, 2026" or "Aug 10-20, 2026"
	// STRICT: Requires explicit year in at least one date to avoid ambiguity
	const m = dateStr.match(/^(.+?)\s*[-–]\s*(.+)$/);
	if (!m) return null;

	const endDStr = m[2].trim();
	const startDStr = m[1].trim();

	// Check if end date has an explicit year
	const endD = new Date(endDStr);
	if (isNaN(endD.getTime())) {
		return { error: `End date "${endDStr}" could not be parsed. Please include the year, e.g., "Aug 10, 2026"` };
	}

	// If end date is valid, try start date as-is first
	let startD = new Date(startDStr);
	if (isNaN(startD.getTime())) {
		// Try adding end date's year
		startD = new Date(startDStr + ', ' + endD.getUTCFullYear());
	}

	if (isNaN(startD.getTime())) {
		return { error: `Start date "${startDStr}" could not be parsed. Please include the year, e.g., "Aug 10, 2026"` };
	}

	return { start: startD, end: endD };
}

// Appended to every generated event's description, after the real event
// content — this shows up for anyone who views or is invited to the event
// (not just the person who forwarded the original email), which is the point:
// it's attribution on the artifact itself, not a one-time "welcome" message.
const ATTRIBUTION_FOOTER = '(Added via sendtoschedule.com)';

/**
 * Formats a date and optional time range into a friendly description line.
 * If time is available, shows: "Weekday, Mon DD, YYYY · HHpm to HHpm"
 * Otherwise: "Weekday, Mon DD, YYYY (all-day)"
 */
function formatDateTimeForDescription(date: Date, endDate: Date, timeStr: string | undefined, allDay: boolean): string {
	// CRITICAL: Use UTC explicitly (see formatDateCleanly() comment above).
	// This function is called by createCalendarUrl() to build event descriptions.
	const month = date.getUTCMonth() + 1;
	const day = date.getUTCDate();
	const year = date.getUTCFullYear();
	const monthStr = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][month - 1];
	const dayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][date.getUTCDay()];
	const dateStr = `${dayOfWeek}, ${monthStr} ${day}, ${year}`;

	if (allDay || !timeStr) {
		return `${dateStr} (all-day)`;
	}

	const times = parseTime(timeStr);
	if (!times || 'error' in times || !times.start) {
		return `${dateStr} (all-day)`;
	}

	// Format time range: "6:30pm to 8:00pm"
	let timeDisplay = times.start;
	if (times.end && times.end !== times.start) {
		timeDisplay += ` to ${times.end}`;
	}

	return `${dateStr} · ${timeDisplay}`;
}

export function createCalendarUrl(event: ScoutEvent, _subject: string, _receivedDate: string): string | { error: string } {
	const baseUrl = 'https://www.google.com/calendar/render?action=TEMPLATE';
	const title = event.Title || 'Scouted Event';
	let startD = new Date();
	let endD = new Date();
	let allDay = true;

	try {
		const dateStr = String(event.Date);

		// Check for a date range first (e.g. "August 10 - August 20, 2026")
		const range = parseDateRange(dateStr);
		if (range && 'error' in range) {
			return range;
		}
		if (range) {
			startD = range.start;
			endD = range.end;
			// allDay stays true; time parsing below will override if time exists
		} else {
			startD = new Date(dateStr);
			endD = new Date(dateStr);
			if (isNaN(startD.getTime())) {
				return { error: `Could not parse date "${dateStr}". Please use format like "Aug 10, 2026"` };
			}
		}

		const times = parseTime(event.Time || '');
		if (times && 'error' in times) {
			return times;
		}
		if (times && times.start) {
			allDay = false;
			applyTime(startD, times.start);
			if (times.end) {
				applyTime(endD, times.end);
			} else {
				endD = new Date(startD.getTime() + 60 * 60 * 1000); // default 1hr
			}
		}
	} catch (e) {
		return { error: `Error parsing event: ${String(e)}` };
	}

	// Build description with date/time, location, and footer
	const descriptionParts: string[] = [];

	// Add formatted date and time
	const dateTimeStr = formatDateTimeForDescription(startD, endD, event.Time, allDay);
	if (dateTimeStr) {
		descriptionParts.push(dateTimeStr);
	}

	// Add location
	if (event.Location) {
		descriptionParts.push('Location: ' + event.Location);
	}

	// Add original description/details
	if (event.Description) {
		descriptionParts.push(event.Description);
	}

	// Add footer with blank line separator
	descriptionParts.push(''); // blank line
	descriptionParts.push(ATTRIBUTION_FOOTER);

	const description = descriptionParts.join('\n');

	let dateParam: string;
	if (allDay) {
		const s = startD.toISOString().split('T')[0].replace(/-/g, '');
		const eNext = new Date(endD);
		eNext.setUTCDate(eNext.getUTCDate() + 1);
		const e = eNext.toISOString().split('T')[0].replace(/-/g, '');
		dateParam = `${s}/${e}`;
	} else {
		const fmt = (d: Date) => d.toISOString().replace(/-|:|\.\d{3}Z/g, '');
		dateParam = `${fmt(startD)}/${fmt(endD)}`;
	}

	return `${baseUrl}&text=${encodeURIComponent(title)}&dates=${dateParam}&details=${encodeURIComponent(description)}&location=${encodeURIComponent(
		event.Location || ''
	)}`;
}

/**
 * Creates a calendar URL with ONLY the summary line as the description.
 * This is used for email reports where the summary line has already been displayed,
 * and the calendar event should be clean (just the summary, not full details).
 */
export function createCalendarUrlWithSummary(event: ScoutEvent, summaryLine: string): string | { error: string } {
	const baseUrl = 'https://www.google.com/calendar/render?action=TEMPLATE';
	const title = event.Title || 'Scouted Event';
	let startD = new Date();
	let endD = new Date();
	let allDay = true;

	try {
		const dateStr = String(event.Date);

		// Check for a date range first (e.g. "August 10 - August 20, 2026")
		const range = parseDateRange(dateStr);
		if (range && 'error' in range) {
			return range;
		}
		if (range) {
			startD = range.start;
			endD = range.end;
			// allDay stays true; time parsing below will override if time exists
		} else {
			startD = new Date(dateStr);
			endD = new Date(dateStr);
			if (isNaN(startD.getTime())) {
				return { error: `Could not parse date "${dateStr}". Please use format like "Aug 10, 2026"` };
			}
		}

		const times = parseTime(event.Time || '');
		if (times && 'error' in times) {
			return times;
		}
		if (times && times.start) {
			allDay = false;
			applyTime(startD, times.start);
			if (times.end) {
				applyTime(endD, times.end);
			} else {
				endD = new Date(startD.getTime() + 60 * 60 * 1000); // default 1hr
			}
		}
	} catch (e) {
		return { error: `Error parsing event: ${String(e)}` };
	}

	// Build description with ONLY the summary line and footer
	const descriptionParts: string[] = [];
	descriptionParts.push(summaryLine);
	descriptionParts.push(''); // blank line
	descriptionParts.push(ATTRIBUTION_FOOTER);

	const description = descriptionParts.join('\n');

	let dateParam: string;
	if (allDay) {
		const s = startD.toISOString().split('T')[0].replace(/-/g, '');
		const eNext = new Date(endD);
		eNext.setUTCDate(eNext.getUTCDate() + 1);
		const e = eNext.toISOString().split('T')[0].replace(/-/g, '');
		dateParam = `${s}/${e}`;
	} else {
		const fmt = (d: Date) => d.toISOString().replace(/-|:|\.\d{3}Z/g, '');
		dateParam = `${fmt(startD)}/${fmt(endD)}`;
	}

	return `${baseUrl}&text=${encodeURIComponent(title)}&dates=${dateParam}&details=${encodeURIComponent(description)}&location=${encodeURIComponent(
		event.Location || ''
	)}`;
}
