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
	const rangeMatch = timeStr.match(/(\d{1,2}(?::\d{2})?)\s*(?:to|-)\s*(\d{1,2}(?::\d{2})?)\s*(am|pm)?/i);
	if (rangeMatch) {
		const suffix = rangeMatch[3];
		// If suffix exists, use it for both; otherwise reject (ambiguous without am/pm)
		if (!suffix) {
			return { error: `Time range "${timeStr}" is ambiguous. Please specify am or pm, e.g., "3:00am to 5:00pm"` };
		}
		return { start: rangeMatch[1] + suffix, end: rangeMatch[2] + suffix };
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
