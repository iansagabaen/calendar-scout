// Test endpoint for verifying time parsing and calendar URL generation.
//
// Accepts POST /test with a JSON event payload:
// {
//   "Title": "Event Name",
//   "Date": "August 10, 2026",
//   "Time": "5:00–7:00pm",  // Can use em-dash, en-dash, or regular hyphen
//   "Location": "Optional location",
//   "Description": "Optional description"
// }
//
// Returns a preview of:
// - Original input (Title, Date, Time)
// - Parsed times (start and end times extracted by parseTime())
// - Generated calendar URL and what it represents
//
// This endpoint is for manual testing and verification, NOT for production use.

import type { ScoutEvent } from './types';
import { parseTime, createCalendarUrl, formatDateCleanly } from './calendar-utils';

interface TestRequest {
	Title?: string;
	Date?: string;
	Time?: string;
	Location?: string;
	Description?: string;
}

interface ParsedTimeResult {
	raw: string | null;
	start: string | null;
	end: string | null;
	parsed: boolean;
}

interface TestResponse {
	status: 'ok' | 'error';
	error?: string;
	input?: {
		Title: string;
		Date: string;
		Time: string | null;
		Location: string | null;
		Description: string | null;
	};
	parsed?: ParsedTimeResult;
	preview?: {
		title: string;
		date: string;
		time: string | null;
		location: string | null;
		description: string | null;
	};
	calendarUrl?: string;
	calendarPreview?: {
		summary: string;
		startTime: string;
		endTime: string;
		allDay: boolean;
	};
}

export async function handleTestRequest(request: Request): Promise<Response> {
	if (request.method !== 'POST') {
		return new Response(JSON.stringify({ status: 'error', error: 'Only POST is supported' }), {
			status: 405,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	let payload: TestRequest;
	try {
		payload = (await request.json()) as TestRequest;
	} catch (e: any) {
		return new Response(
			JSON.stringify({
				status: 'error',
				error: `Invalid JSON: ${e?.message || String(e)}`,
			}),
			{ status: 400, headers: { 'Content-Type': 'application/json' } }
		);
	}

	// Validate required fields
	if (!payload.Title || !payload.Date) {
		return new Response(
			JSON.stringify({
				status: 'error',
				error: 'Missing required fields: Title and Date are required',
			}),
			{ status: 400, headers: { 'Content-Type': 'application/json' } }
		);
	}

	try {
		const event: ScoutEvent = {
			Title: payload.Title,
			Date: payload.Date,
			Time: payload.Time || undefined,
			Location: payload.Location || undefined,
			Description: payload.Description || undefined,
		};

		// Parse the time using the fixed parseTime() function
		const parsedTimeResult = parseTime(event.Time || null);
		let parsedTime: any = null;
		let parseTimeError: string | null = null;
		if (parsedTimeResult && 'error' in parsedTimeResult) {
			parseTimeError = parsedTimeResult.error;
		} else {
			parsedTime = parsedTimeResult;
		}

		// Generate calendar URL
		const calendarUrlResult = createCalendarUrl(event, event.Title, formatDateCleanly(new Date()));
		let calendarUrl: string | null = null;
		let calendarUrlError: string | null = null;
		if (typeof calendarUrlResult === 'string') {
			calendarUrl = calendarUrlResult;
		} else {
			calendarUrlError = calendarUrlResult.error;
		}

		// Build response
		const response: TestResponse = {
			status: calendarUrlError ? 'error' : 'ok',
			error: calendarUrlError || parseTimeError,
			input: {
				Title: event.Title,
				Date: event.Date,
				Time: event.Time || null,
				Location: event.Location || null,
				Description: event.Description || null,
			},
			parsed: {
				raw: event.Time || null,
				start: parsedTime?.start || null,
				end: parsedTime?.end || null,
				parsed: parsedTime !== null,
			},
			preview: {
				title: event.Title,
				date: event.Date,
				time: parsedTime ? `${parsedTime.start}${parsedTime.end ? ` to ${parsedTime.end}` : ''}` : '(all-day)',
				location: event.Location || null,
				description: event.Description || null,
			},
			calendarUrl: calendarUrl || undefined,
			calendarPreview: {
				summary: event.Title,
				startTime: parsedTime?.start || '(all-day)',
				endTime: parsedTime?.end || '(1-hour default)',
				allDay: !parsedTime || !parsedTime.start,
			},
		};

		return new Response(JSON.stringify(response, null, 2), {
			status: calendarUrlError ? 400 : 200,
			headers: { 'Content-Type': 'application/json' },
		});
	} catch (e: any) {
		const errorMsg = e?.toString?.() || String(e);
		return new Response(
			JSON.stringify({
				status: 'error',
				error: `Processing failed: ${errorMsg}`,
			}),
			{ status: 500, headers: { 'Content-Type': 'application/json' } }
		);
	}
}
