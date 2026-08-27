// Ported from Code.js callGeminiVisionAI() / looksLikeEvent().
// UrlFetchApp.fetch -> native fetch(). Model fallback chain, prompt text, and
// JSON-fence stripping preserved exactly.

import type { GeminiResult, MediaPart } from './types';

export const MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash-001', 'gemini-2.0-flash-lite'];

export function looksLikeEvent(body: string, subject: string, mediaParts: MediaPart[]): boolean {
	// Always process if there's an image or PDF attachment (could be a flyer)
	if (mediaParts && mediaParts.length > 0) return true;

	const combined = (subject + ' ' + body).toLowerCase();
	const dateWords =
		/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|\d{1,2}\/\d{1,2}|monday|tuesday|wednesday|thursday|friday|saturday|sunday|tonight|tomorrow|next week|pm|am|:\d{2})\b/;
	const eventWords =
		/\b(event|party|meeting|appointment|join|register|rsvp|invite|invited|conference|workshop|webinar|class|game|concert|show|dinner|lunch|visit|trip|due|deadline|reminder)\b/;

	return dateWords.test(combined) || eventWords.test(combined);
}

interface CallOptions {
	/** Skip the fallback chain and only try this one model. For cheap plumbing
	 * checks (the manual smoke-test endpoint) where response quality doesn't
	 * matter, only that the round-trip works. Never set this for the
	 * production email path or the nightly regression test -- both need the
	 * real fallback chain to test/serve what production actually does. */
	forceModel?: string;
	/** Tags the usage-log line so cost can be attributed to what triggered the
	 * call (production email vs nightly regression vs manual smoke test) --
	 * see the console.log below. Gemini's API already returns token counts in
	 * usageMetadata on every response; this just stops discarding them. */
	source?: string;
}

export async function callGeminiVisionAI(
	apiKey: string,
	text: string,
	mediaParts: MediaPart[],
	emailDate: string,
	options: CallOptions = {}
): Promise<GeminiResult> {
	const currentYear = new Date().getFullYear();
	const dateContext = emailDate
		? `This email was received on ${emailDate}. Use this to resolve relative dates like "tomorrow", "next Monday", "this Friday", etc.`
		: '';
	const prompt = `${dateContext}

Extract events from this content into a JSON array "events". For each event include:
- Title: short event name
- Date: full date in "Mmm D, YYYY" format (e.g. "Aug 10, 2026"). Use ${currentYear} if no year is specified. For date ranges use "Aug 10, 2026 - Aug 20, 2026".
- Time: start and end time if mentioned, otherwise "". If a time is written without am/pm (e.g. "3:30", "6 o'clock", "dinner at 6") but the surrounding text makes the meaning unmistakable, add the correct am/pm to this value. Use cues like "afterschool", "pickup", "dismissal", "practice", "rehearsal", "dinner", "evening", "tonight", "after work" (PM) and "breakfast", "drop-off", "morning", "before school", "assembly" (AM). If the context does NOT make it clear, leave the time exactly as written with no am/pm — never guess blindly. Respect an explicit 24-hour time (e.g. "15:30") as written.
- TimeConfidence: "high" if the start time's am/pm was explicitly written OR is unmistakable from context; "low" ONLY for the borderline case described under TimeInferenceNote. Use "high" when there is no time at all.
- TimeInferenceNote: the app runs its own deterministic pass AFTER you, and it already resolves the common cases on its own — explicit 24-hour times, a bare "12:00" (treated as noon), ANY bare 1-6 o'clock time (treated as PM), and the obvious AM/PM keywords listed above. Leave TimeInferenceNote as "" for every one of those; do not explain them. Set it to one short sentence ONLY when you inferred an am/pm from genuinely subtle prose that those simple rules would miss (e.g. a narrative that clearly implies the evening with none of the keywords), naming the time and why you chose am or pm (e.g. 'Read "8" as PM because the passage describes families arriving after sunset'). Otherwise "".
- Location: physical location if mentioned, otherwise ""
- Description: 1-2 sentence summary of what the event is and anything attendees need to know (bring, do, sign up for, etc.)
- RequiredItems: any items to bring
- DateConfidence: "high" if the date is explicitly stated; "low" if inferred from vague language like "this week", "soon", "next month", or if no specific day was found
- DateNote: if DateConfidence is "low", one short sentence explaining why (e.g. "Email says 'this week' but no specific day is mentioned"). Otherwise "".
- DateContext: the 1-2 sentences from the email that reference this event's date, copied verbatim. Otherwise "".

Important rules:
- If a single named event repeats on consecutive days at the same specific time (e.g. "Monday-Thursday 4:15-8pm"), create one entry per day and append "(1 of 4)", "(2 of 4)" etc. to that event's title only. Do not number events that do not repeat at a specific time each day.
- A multi-day event or festival (e.g. "May 1-3") is NOT a repeating event — keep it as one entry with a date range. Do not split it into individual days and do not number it.
- If there are multiple time slots on the same day for different groups, create a separate entry for each slot. Do not number these unless they also repeat across days.
- Use the exact date for each individual day, not a range, when expanding truly recurring events.
- For Description: only include genuinely useful information (what to bring, what to expect, who it's for). If there is nothing useful to add, leave Description as "".

Return ONLY valid JSON with keys: is_relevant, events, summary.
For "summary": one sentence identifying the source (e.g. "From the Covington 6th Grade Newsletter, May 12") and the 2-3 most notable events. This helps the reader remember why they forwarded the email.

Content: ${text}`;

	const modelsToTry = options.forceModel ? [options.forceModel] : MODELS;

	for (const modelName of modelsToTry) {
		try {
			const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
			const payload = { contents: [{ parts: [{ text: prompt }, ...mediaParts] }] };
			const response = await fetch(url, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload),
			});

			if (response.status === 200) {
				const data = (await response.json()) as any;

				// Every Gemini response includes real token counts -- log them instead
				// of discarding them, so cost is attributable to what triggered the
				// call without needing GCP-side per-request logging (which this key
				// doesn't have enabled). Cheap: one structured line into the same
				// Workers Logs sink logExecution() already writes to.
				const usage = data.usageMetadata || {};
				console.log(
					JSON.stringify({
						type: 'gemini_usage',
						timestamp: new Date().toISOString(),
						source: options.source || 'unknown',
						model: modelName,
						promptTokenCount: usage.promptTokenCount ?? null,
						candidatesTokenCount: usage.candidatesTokenCount ?? null,
						totalTokenCount: usage.totalTokenCount ?? null,
						hadMediaParts: mediaParts.length > 0,
					})
				);

				let aiText = data.candidates[0].content.parts[0].text;
				let cleanJson = aiText.replace(/```json|```/g, '').trim();
				return JSON.parse(cleanJson);
			}

			// Non-200: previously silent (fell through to the next model with no
			// trace of why). That made a real failure -- the API key being blocked --
			// indistinguishable from "just trying the next model down," discovered
			// the hard way testing this exact function. Body is truncated since
			// error payloads can occasionally echo back parts of the request.
			const bodyText = await response.text();
			console.log(
				JSON.stringify({
					type: 'gemini_error',
					timestamp: new Date().toISOString(),
					source: options.source || 'unknown',
					model: modelName,
					status: response.status,
					body: bodyText.slice(0, 300),
				})
			);
		} catch (e) {
			console.log('AI Error: ' + String(e));
		}
	}
	return { events: [], summary: 'I hit a snag.' };
}
