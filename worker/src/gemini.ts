// Ported from Code.js callGeminiVisionAI() / looksLikeEvent().
// UrlFetchApp.fetch -> native fetch(). Model fallback chain, prompt text, and
// JSON-fence stripping preserved exactly.

import type { GeminiResult, MediaPart } from './types';

// Fallback chain, primary first. Kept to current, non-deprecated models: on
// 2026-09-02 a real user's forward failed because BOTH former fallbacks
// (`gemini-2.0-flash-001`, `gemini-2.0-flash-lite`) had been retired by Google
// and returned 404 — with the primary also hiccupping on that one email, the
// whole chain was dead. See research/2026-09-02-covington-got-talent-processing-failure.md.
export const MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite'];

/**
 * Parse a model's response text into an object. Tolerant of the small
 * malformations Gemini can still produce: a ```json fence, leading/trailing
 * prose around the object, or a trailing comma before a closing brace/bracket.
 * Throws if the text cannot be recovered into valid JSON.
 */
export function extractJson(raw: string): unknown {
	const stripped = raw.replace(/```json|```/g, '').trim();
	try {
		return JSON.parse(stripped);
	} catch {
		// fall through to recovery
	}
	const start = stripped.indexOf('{');
	const end = stripped.lastIndexOf('}');
	if (start === -1 || end === -1 || end <= start) {
		throw new SyntaxError('No JSON object found in model response');
	}
	const candidate = stripped.slice(start, end + 1).replace(/,(\s*[}\]])/g, '$1');
	return JSON.parse(candidate);
}

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
- Time: the event's start (and end) clock time if one is actually stated, e.g. "3:30pm" or "3:30-5:00pm"; otherwise "". This value must ALWAYS be either a real clock time containing digits (e.g. "3:30", "3:30pm", "15:00", "3:30-5:00pm") or an empty string "" — it must NEVER be a bare "am"/"pm"/"AM"/"PM" and never a meridiem with no digits. If the source names no specific clock time — even if it clearly implies morning, afternoon or evening — set Time to "" and TimeConfidence to "high" (an all-day event); do not invent a time and do not answer with just "am" or "pm". Only when an actual clock time IS present but written without am/pm (e.g. "3:30", "6 o'clock", "dinner at 6"), and the surrounding text makes the meaning unmistakable, add the correct am/pm to that clock time. Use cues like "afterschool", "pickup", "dismissal", "practice", "rehearsal", "dinner", "evening", "tonight", "after work" (PM) and "breakfast", "drop-off", "morning", "before school", "assembly" (AM). If the context does NOT make it clear, leave the clock time exactly as written with no am/pm — never guess blindly. Respect an explicit 24-hour time (e.g. "15:30") as written.
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
	const source = options.source || 'unknown';

	let lastFailure = 'no models attempted';
	for (const modelName of modelsToTry) {
		// Up to two attempts per model. A 200 whose body will not parse is retried
		// once — Gemini is nondeterministic and a second call almost always returns
		// clean JSON. A non-200 (e.g. a deprecated-model 404) or a thrown fetch is
		// NOT retried; we move straight to the next model.
		for (let attempt = 1; attempt <= 2; attempt++) {
			const outcome = await callOneModel(apiKey, modelName, prompt, mediaParts, source);
			if (outcome.status === 'ok') return outcome.result;
			if (outcome.status === 'dead') {
				lastFailure = `${modelName}: no usable response`;
				break;
			}
			lastFailure = `${modelName}: response was not valid JSON (attempt ${attempt}/2)`;
		}
	}

	// Every model failed. Do NOT masquerade this as a clean "no events in this
	// email" (summary only) — that is exactly how the 2026-09-02 Covington
	// failure hid for hours with no alert. Return an explicit `error` so the
	// caller logs it as ERROR, alerts, and tells the user extraction failed.
	console.log('AI Error: all models exhausted — ' + lastFailure);
	return {
		events: [],
		summary:
			"I couldn't read that email this time — my text-extraction step didn't return a usable result. This is usually temporary: try forwarding it again in a few minutes, and if it keeps happening, paste the key dates into a plain email.",
		error: 'all Gemini models failed: ' + lastFailure,
	};
}

type ModelAttempt =
	| { status: 'ok'; result: GeminiResult }
	| { status: 'retryable' } // 200 received but body unusable — a retry may succeed
	| { status: 'dead' }; // non-200 or fetch threw — move to the next model

/**
 * One request to one model. Logs the same `gemini_usage` / `gemini_error` /
 * `AI Error:` lines the inline loop used to, and never throws.
 */
async function callOneModel(
	apiKey: string,
	modelName: string,
	prompt: string,
	mediaParts: MediaPart[],
	source: string
): Promise<ModelAttempt> {
	try {
		const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
		const payload = {
			contents: [{ parts: [{ text: prompt }, ...mediaParts] }],
			// Constrain decoding to syntactically valid JSON. Without this, Gemini
			// occasionally emits an unescaped `"` inside a verbatim-copy field
			// (DateContext / Description) and JSON.parse throws — the 2026-09-02
			// Covington "Got Talent" failure on a quote-dense newsletter.
			generationConfig: { responseMimeType: 'application/json' },
		};
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
					source,
					model: modelName,
					promptTokenCount: usage.promptTokenCount ?? null,
					candidatesTokenCount: usage.candidatesTokenCount ?? null,
					totalTokenCount: usage.totalTokenCount ?? null,
					hadMediaParts: mediaParts.length > 0,
				})
			);

			const aiText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
			if (typeof aiText !== 'string' || !aiText.trim()) {
				console.log(`AI Error: 200 response from ${modelName} had no text candidate`);
				return { status: 'retryable' };
			}
			try {
				return { status: 'ok', result: extractJson(aiText) as GeminiResult };
			} catch (parseErr) {
				console.log('AI Error: ' + String(parseErr));
				return { status: 'retryable' };
			}
		}

		// Non-200: previously silent (fell through to the next model with no
		// trace of why). That made a real failure -- the API key being blocked,
		// or a model being deprecated -- indistinguishable from "just trying the
		// next model down," discovered the hard way testing this exact function.
		// Body is truncated since error payloads can occasionally echo back parts
		// of the request.
		const bodyText = await response.text();
		console.log(
			JSON.stringify({
				type: 'gemini_error',
				timestamp: new Date().toISOString(),
				source,
				model: modelName,
				status: response.status,
				body: bodyText.slice(0, 300),
			})
		);
		return { status: 'dead' };
	} catch (e) {
		console.log('AI Error: ' + String(e));
		return { status: 'dead' };
	}
}
