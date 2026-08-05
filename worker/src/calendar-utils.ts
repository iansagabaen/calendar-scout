// Ported near-verbatim from Code.js — none of this depended on Apps Script APIs,
// it's plain date math and string building for a Google Calendar "render" template URL.

import type { ScoutEvent } from './types';

export function formatDateCleanly(dateInput: Date | string | null | undefined): string {
	if (!dateInput) return 'Date not specified';
	const d = new Date(dateInput);
	return isNaN(d.getTime())
		? String(dateInput)
		: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatDateWithDay(dateInput: string | null | undefined): string {
	if (!dateInput) return 'Date not specified';
	const d = new Date(dateInput);
	if (isNaN(d.getTime())) return String(dateInput);
	return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
}

export function parseTime(timeStr: string | null | undefined): { start: string; end: string | null } | null {
	// Parses strings like "3:30-5:30pm", "4:00pm", "9:00pm", "3:30-10:00pm"
	if (!timeStr) return null;
	const match = timeStr.match(/(\d{1,2}(?::\d{2})?)\s*(?:-|to)\s*(\d{1,2}(?::\d{2})?)\s*(am|pm)?/i);
	if (!match) {
		// Single time like "9:00pm"
		const single = timeStr.match(/(\d{1,2}(?::\d{2})?)\s*(am|pm)/i);
		if (single) return { start: single[1] + single[2], end: null };
		return null;
	}
	const suffix = match[3] || 'pm';
	return { start: match[1] + suffix, end: match[2] + suffix };
}

export function applyTime(dateObj: Date, timeStr: string): Date {
	// Applies a time string like "3:30pm" to a Date object
	const m = timeStr.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
	if (!m) return dateObj;
	let hours = parseInt(m[1], 10);
	const mins = parseInt(m[2] || '0', 10);
	const ampm = m[3].toLowerCase();
	if (ampm === 'pm' && hours !== 12) hours += 12;
	if (ampm === 'am' && hours === 12) hours = 0;
	dateObj.setHours(hours, mins, 0, 0);
	return dateObj;
}

export function parseDateRange(dateStr: string): { start: Date; end: Date } | null {
	// Handles "August 10 - August 20, 2026" or "Aug 10-20, 2026"
	const m = dateStr.match(/^(.+?)\s*[-–]\s*(.+)$/);
	if (!m) return null;
	const endD = new Date(m[2].trim());
	if (isNaN(endD.getTime())) return null;
	let startD = new Date(m[1].trim());
	if (isNaN(startD.getTime())) startD = new Date(m[1].trim() + ', ' + endD.getFullYear());
	if (isNaN(startD.getTime())) return null;
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
	const dateStr = date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });

	if (allDay || !timeStr) {
		return `${dateStr} (all-day)`;
	}

	const times = parseTime(timeStr);
	if (!times || !times.start) {
		return `${dateStr} (all-day)`;
	}

	// Format time range: "6:30pm to 8:00pm"
	let timeDisplay = times.start;
	if (times.end && times.end !== times.start) {
		timeDisplay += ` to ${times.end}`;
	}

	return `${dateStr} · ${timeDisplay}`;
}

export function createCalendarUrl(event: ScoutEvent, _subject: string, _receivedDate: string): string {
	const baseUrl = 'https://www.google.com/calendar/render?action=TEMPLATE';
	const title = event.Title || 'Scouted Event';
	let startD = new Date();
	let endD = new Date();
	let allDay = true;

	try {
		const dateStr = String(event.Date);

		// Check for a date range first (e.g. "August 10 - August 20, 2026")
		const range = parseDateRange(dateStr);
		if (range) {
			startD = range.start;
			endD = range.end;
			// allDay stays true; time parsing below will override if time exists
		} else {
			startD = new Date(dateStr);
			endD = new Date(dateStr);
			if (isNaN(startD.getTime())) {
				startD = new Date();
				endD = new Date();
			}
		}

		const times = parseTime(event.Time || '');
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
		startD = new Date();
		endD = new Date();
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
		eNext.setDate(eNext.getDate() + 1);
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
export function createCalendarUrlWithSummary(event: ScoutEvent, summaryLine: string): string {
	const baseUrl = 'https://www.google.com/calendar/render?action=TEMPLATE';
	const title = event.Title || 'Scouted Event';
	let startD = new Date();
	let endD = new Date();
	let allDay = true;

	try {
		const dateStr = String(event.Date);

		// Check for a date range first (e.g. "August 10 - August 20, 2026")
		const range = parseDateRange(dateStr);
		if (range) {
			startD = range.start;
			endD = range.end;
			// allDay stays true; time parsing below will override if time exists
		} else {
			startD = new Date(dateStr);
			endD = new Date(dateStr);
			if (isNaN(startD.getTime())) {
				startD = new Date();
				endD = new Date();
			}
		}

		const times = parseTime(event.Time || '');
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
		startD = new Date();
		endD = new Date();
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
		eNext.setDate(eNext.getDate() + 1);
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
