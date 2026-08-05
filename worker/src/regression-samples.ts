// Fixed sample inputs for the nightly automated parsing regression test (see
// regression-test.ts and the scheduled() export in index.ts).
//
// Design choice, per the agreed plan in projects.md's Calendar Scout backlog
// ("Nightly automated parsing regression test"): a small FIXED set of saved
// sample newsletters, re-tested every night, beats dynamically "finding" a new
// real newsletter each run — same regression-catching value (did the Gemini
// pipeline silently stop extracting events?), far less fragile (no dependency
// on a live inbox having fresh mail every night).
//
// Two cases, matching the two real input shapes the live email() handler sees:
//   1. TEXT_SAMPLE — a plain-text forwarded newsletter body, no attachments.
//   2. IMAGE_SAMPLE — an attachment-only forward (empty body), exercising the
//      Gemini Vision code path (mediaParts) rather than the plain-text path.

import type { MediaPart } from './types';

export interface RegressionCase {
	/** Short machine-readable id, used in logs/alerts to say which case failed. */
	id: string;
	/** Human label for alert emails. */
	label: string;
	subject: string;
	body: string;
	mediaParts: MediaPart[];
	/** Minimum number of events Gemini must return for this case to count as a pass. */
	minExpectedEvents: number;
};

// --- Case 1: text-only ------------------------------------------------------
//
// A synthetic (not a real captured email) newsletter, but deliberately messy
// in the ways real forwarded school/community newsletters actually are —
// unlike the old cleanly-bulleted version, this one buries events mid-
// paragraph, mixes date formats ("9/14" vs "September 17th" vs "next
// Tuesday"), rambles in an informal front-office voice, and mixes unrelated
// event types (fundraiser, book fair, picture day, sports, PTA meeting,
// themed spirit week) in one email — patterns confirmed via research into
// real PTA/school-newsletter formatting conventions (events are commonly
// buried in running prose rather than cleanly bulleted, and multiple
// unrelated event types get crammed into one weekly send). All names/orgs
// are invented; not a copy of any real newsletter.
//
// The "next Tuesday" soccer game deliberately has no fixed calendar date and
// no locked-in time, to exercise the low DateConfidence / DateNote path in
// callGeminiVisionAI's prompt (see gemini.ts) the same way an ambiguous real
// newsletter line would.
const TEXT_SAMPLE: RegressionCase = {
	id: 'text-only',
	label: 'Text-only newsletter (Pinecrest Elementary sample)',
	subject: 'Fwd: Pinecrest Panthers Weekly Update',
	body: `Hi Pinecrest families, hope everyone had a good weekend! Busy few weeks coming up so grab a coffee and read through this one, lots going on. First off huge thank you to everyone who signed up to bring snacks for the teacher appreciation cart, we are still short a few slots for the week of 9/14 so if you can help even one day please email Mrs. Delgado in the front office. Speaking of 9/14, that's also when our Fall Book Fair kicks off in the library, it'll run all week through Friday the 18th, doors open at 7:45am before school and again 3:00-5:30pm after dismissal, cash and card both work now which is nice. Don't forget Picture Day is coming up too - that's September 17th, order forms went home in Friday folders last week (I know, I know, another form) and if you lost yours there are extras on the table outside the office.

In sports news the 4th/5th grade soccer team has their first home game next Tuesday against Cedar Valley, everyone's welcome to come cheer them on, I don't have the exact kickoff time locked down yet but it's usually right after school lets out. Also a heads up that our PTA is holding its first general meeting of the year on Thursday, September 24 at 6:30pm in the cafeteria - free pizza for anyone who shows up (bribery works). And last but not least, Spirit Week is happening the week of 9/28: Monday is pajama day, Tuesday is twin day, Wednesday is career day (wear something related to a job you want!), Thursday is decades day, and Friday is Panther pride day, wear your green and gold.

That's a lot, I know! As always thanks for everything you do for our Pinecrest kiddos.
Mrs. Delgado, Pinecrest Elementary Front Office`,
	mediaParts: [],
	// At least 5 distinct dated events are present (Book Fair, Picture Day,
	// soccer game, PTA meeting, Spirit Week) plus a non-event distractor (the
	// snack-cart ask, which has no real date of its own). Require at least 3 so
	// the test isn't flaky if the model reasonably merges Spirit Week's themed
	// days into fewer entries or drops a borderline one.
	minExpectedEvents: 3,
};

// --- Case 2: image-only (PDF flyer) -----------------------------------------
//
// Real image/PDF bytes are needed to meaningfully exercise Gemini Vision (a
// text description of "there's a flyer" doesn't touch that code path at all).
// Rather than depending on a captured real-world photo (which would need
// periodic replacement as formats/phones change and risks containing someone
// else's PII), this is a hand-built single-page PDF using standard base-14
// PDF fonts (Helvetica / Helvetica-Bold / Helvetica-Oblique /
// Helvetica-BoldOblique — always available, no font embedding needed),
// generated with a Node script (no image libraries available in this
// environment: checked again for this revision — still no PIL/Pillow, no
// `canvas` native build, no ImageMagick, no pdf-lib in package.json). Since
// true photographic imperfections (blur, uneven lighting, real camera skew)
// aren't achievable without those tools, this version leans on what raw PDF
// drawing CAN do to move away from the old pristine single-font, single-size,
// perfectly-aligned layout:
//   - mixed font sizes/weights across header, body, and footer for visual
//     hierarchy instead of uniform lines
//   - inconsistent left-margin alignment between sections (as if added at
//     different times, the way real flyers often are)
//   - the header block and one line rotated a couple degrees via the PDF text
//     matrix (Tm), approximating a slightly off-axis photographed page
//   - a rotated "stamped" rain-date addendum in the corner with an
//     intentionally vague relative date ("the Sat. after"), to exercise the
//     low DateConfidence / DateNote path the same way a hand-added flyer note
//     would
//   - two faint dashed light-gray lines across the sheet approximating
//     scan/photo noise
// This is a meaningful step up in visual clutter/realism from the old
// pristine version, but it is still a cleanly-rendered vector PDF, not a
// photorealistic photo — true photo imperfections remain out of reach without
// image-processing tooling in this environment. It renders as a cluttered,
// informal one-event flyer:
//
//   FOUNDERS PARK / COMMUNITY POTLUCK / & Yard Sale   (three-line header,
//     each line independently rotated/offset)
//   Saturday, Aug 8th, 2026 · 11am til whenever
//   Founders Park Pavilion (by the tennis courts)
//   Bring a dish to share if you can! We'll have burgers on the grill
//     either way. BYO chair -- we never have enough seating for everyone.
//   [boxed] YARD SALE TABLES: free if you reserve one -- text Dana at
//     555-0148 to grab one
//   Questions? Ask any Founders Park Neighborhood Assoc. board member.
//   [rotated stamp] RAIN DATE: THE SAT. AFTER
//
// A human-viewable copy is checked in at assets/nightly-regression-sample-flyer.pdf
// so Ian can open it directly to see exactly what's being tested.
const IMAGE_SAMPLE_PDF_BASE64 =
	'JVBERi0xLjQKMSAwIG9iago8PCAvVHlwZSAvQ2F0YWxvZyAvUGFnZXMgMiAwIFIgPj4KZW5kb2JqCjIgMCBvYmoKPDwgL1R5cGUgL1BhZ2VzIC9LaWRzIFszIDAgUl0gL0NvdW50IDEgPj4KZW5kb2JqCjMgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCAyIDAgUiAvTWVkaWFCb3ggWzAgMCA0MDAgNTAwXSAvUmVzb3VyY2VzIDw8IC9Gb250IDw8IC9GMSA0IDAgUiAvRjIgNSAwIFIgL0YzIDYgMCBSIC9GNCA3IDAgUiA+PiA+PiAvQ29udGVudHMgOCAwIFIgPj4KZW5kb2JqCjQgMCBvYmoKPDwgL1R5cGUgL0ZvbnQgL1N1YnR5cGUgL1R5cGUxIC9CYXNlRm9udCAvSGVsdmV0aWNhLUJvbGQgPj4KZW5kb2JqCjUgMCBvYmoKPDwgL1R5cGUgL0ZvbnQgL1N1YnR5cGUgL1R5cGUxIC9CYXNlRm9udCAvSGVsdmV0aWNhID4+CmVuZG9iago2IDAgb2JqCjw8IC9UeXBlIC9Gb250IC9TdWJ0eXBlIC9UeXBlMSAvQmFzZUZvbnQgL0hlbHZldGljYS1PYmxpcXVlID4+CmVuZG9iago3IDAgb2JqCjw8IC9UeXBlIC9Gb250IC9TdWJ0eXBlIC9UeXBlMSAvQmFzZUZvbnQgL0hlbHZldGljYS1Cb2xkT2JsaXF1ZSA+PgplbmRvYmoKOCAwIG9iago8PCAvTGVuZ3RoIDEwODAgPj4Kc3RyZWFtCnEKMC44MiAwLjgyIDAuODIgUkcgMC43NSB3IFsyIDJdIDAgZAoxNSA0NzAgbSAzODUgNDY2IGwgUwoyMCA1NSBtIDM5MCA2MCBsIFMKW10gMCBkCjAgMCAwIHJnIEJUIC9GMSAyOCBUZgowLjk5OTcgMC4wMjYyIC0wLjAyNjIgMC45OTk3IDI2IDQ1MiBUbQooRk9VTkRFUlMgUEFSSykgVGogRVQKQlQgL0YxIDIyIFRmCjAuOTk5NyAwLjAyNjIgLTAuMDI2MiAwLjk5OTcgMjIgNDIwIFRtCihDT01NVU5JVFkgUE9UTFVDSykgVGogRVQKQlQgL0Y0IDE4IFRmCjAuOTk5OCAtMC4wMTc1IDAuMDE3NSAwLjk5OTggNTUgMzg4IFRtCigmIFlhcmQgU2FsZSkgVGogRVQKQlQgL0YyIDE1IFRmIDEgMCAwIDEgMjAgMzUyIFRtCihTYXR1cmRheSwgQXVnIDh0aCwgMjAyNiAgtyAgMTFhbSB0aWwgd2hlbmV2ZXIpIFRqIEVUCkJUIC9GMiAxMyBUZiAxIDAgMCAxIDIwIDMyOCBUbQooRm91bmRlcnMgUGFyayBQYXZpbGlvbiBcKGJ5IHRoZSB0ZW5uaXMgY291cnRzXCkpIFRqIEVUCkJUIC9GMiAxMSBUZiAxIDAgMCAxIDIwIDI5OCBUbQooQnJpbmcgYSBkaXNoIHRvIHNoYXJlIGlmIHlvdSBjYW4hIFdlJ2xsIGhhdmUpIFRqCjAgLTE0IFRkCihidXJnZXJzIG9uIHRoZSBncmlsbCBlaXRoZXIgd2F5LiBCWU8gY2hhaXIgLS0pIFRqCjAgLTE0IFRkCih3ZSBuZXZlciBoYXZlIGVub3VnaCBzZWF0aW5nIGZvciBldmVyeW9uZS4pIFRqIEVUCjAgMCAwIFJHIDEgdyBbXSAwIGQKMjQgMjA4IDM0NCAzNCByZSBTCkJUIC9GMSAxMiBUZiAxIDAgMCAxIDMyIDIyOCBUbQooWUFSRCBTQUxFIFRBQkxFUzogZnJlZSBpZiB5b3UgcmVzZXJ2ZSBvbmUgLS0pIFRqIEVUCkJUIC9GMiAxMiBUZiAxIDAgMCAxIDMyIDIxNCBUbQoodGV4dCBEYW5hIGF0IDU1NS0wMTQ4IHRvIGdyYWIgb25lKSBUaiBFVApCVCAvRjMgOSBUZiAxIDAgMCAxIDE4IDE3NiBUbQooUXVlc3Rpb25zPyBBc2sgYW55IEZvdW5kZXJzIFBhcmsgTmVpZ2hib3Job29kIEFzc29jLiBib2FyZCBtZW1iZXIuKSBUaiBFVApCVCAvRjQgMTYgVGYKMC45NzgxIC0wLjIwNzkgMC4yMDc5IDAuOTc4MSAxOTAgMTIwIFRtCihSQUlOIERBVEU6IFRIRSBTQVQuIEFGVEVSKSBUaiBFVApRCgplbmRzdHJlYW0KZW5kb2JqCnhyZWYKMCA5CjAwMDAwMDAwMDAgNjU1MzUgZiAKMDAwMDAwMDAwOSAwMDAwMCBuIAowMDAwMDAwMDU4IDAwMDAwIG4gCjAwMDAwMDAxMTUgMDAwMDAgbiAKMDAwMDAwMDI3MSAwMDAwMCBuIAowMDAwMDAwMzQ2IDAwMDAwIG4gCjAwMDAwMDA0MTYgMDAwMDAgbiAKMDAwMDAwMDQ5NCAwMDAwMCBuIAowMDAwMDAwNTc2IDAwMDAwIG4gCnRyYWlsZXIKPDwgL1NpemUgOSAvUm9vdCAxIDAgUiA+PgpzdGFydHhyZWYKMTcwOAolJUVPRg==';

const IMAGE_SAMPLE: RegressionCase = {
	id: 'image-only',
	label: 'Image/PDF-only flyer (synthetic Founders Park Potluck sample)',
	subject: 'Fwd: flyer',
	body: '', // attachment-only forward — no usable text body, mirrors a real photo forward
	mediaParts: [
		{
			inline_data: {
				mime_type: 'application/pdf',
				data: IMAGE_SAMPLE_PDF_BASE64,
			},
		},
	],
	minExpectedEvents: 1,
};

export const REGRESSION_CASES: RegressionCase[] = [TEXT_SAMPLE, IMAGE_SAMPLE];
