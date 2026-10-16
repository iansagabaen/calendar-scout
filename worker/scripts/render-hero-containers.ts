// Dev tool: build the HTML sources for the hero "email container" composites.
//
// Wraps the two hero artifacts (the fictional "before" newsletter and the REAL "after" Scout Report
// from buildReportEmail) in a GENERIC, UNBRANDED email-client frame (neutral grays, plain glyphs, no
// look-alike of any real mail app), in a phone variant and a desktop-window variant, each in a
// 1:1 flavor and a HERO-SCALED flavor (type and UI scaled up ~1.4x, simpler, fades out at the bottom).
//
// Writes HTML into marketing/hero/source/. The PNGs are rasterized from these with headless Chrome
// (see the shell loop at the bottom of this comment).
//
// Usage (from worker/):
//   npx esbuild scripts/render-hero-containers.ts --bundle --platform=node --format=esm --outfile=../marketing/hero/source/.build.mjs && node ../marketing/hero/source/.build.mjs; rm ../marketing/hero/source/.build.mjs
// Then, from marketing/hero/, for each line printed ("<name> <w> <h> <scale>") run:
//   "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --hide-scrollbars \
//     --default-background-color=00000000 --window-size=<w>,<h> --force-device-scale-factor=<scale> \
//     --screenshot=$PWD/<name>.png file://$PWD/source/<name>.html
// (Chrome headless has a minimum window width, so the phone pages pad themselves; see PAGE_W below.)
//
// All names are fictional. Facts must stay in sync with render-hero-email.ts and
// marketing/hero/hero-newsletter-before.html (same four events, same dates/times/locations).

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { buildReportEmail } from '../src/email-templates.ts';
import { resolveEventTimes } from '../src/calendar-utils.ts';
import type { ScoutEvent } from '../src/types.ts';

const HERO = join(process.cwd(), '..', 'marketing', 'hero');
const SRC = join(HERO, 'source');
mkdirSync(SRC, { recursive: true });

// ---------------------------------------------------------------------------------------------
// 1. The real "after" markup (same four fictional events as render-hero-email.ts)
// ---------------------------------------------------------------------------------------------
const events: ScoutEvent[] = [
	{ Title: 'Fall Picture Day', Date: 'Oct 22, 2026', Time: '8:30am-11:30am', Location: 'Maple Grove Elementary Gym', Description: 'Individual portraits by grade. Order forms go home the week before.', DateConfidence: 'high' },
	{ Title: 'Harvest Carnival', Date: 'Oct 30, 2026', Time: '5:30pm-8:00pm', Location: 'Maple Grove Elementary Playground', Description: 'Games, a cake walk, and a chili supper. Costumes welcome.', DateConfidence: 'high' },
	{ Title: 'Parent-Teacher Conferences', Date: 'Nov 10, 2026', Time: '3:00pm-7:00pm', Location: 'Maple Grove Elementary Classrooms', Description: 'Fifteen-minute slots with your child’s teacher.', DateConfidence: 'high' },
	{ Title: 'Early Release Day', Date: 'Nov 18, 2026', Time: '12:30pm', Location: 'Maple Grove Elementary', Description: 'Students are dismissed at 12:30pm for teacher planning.', DateConfidence: 'high' },
];
const FWD_SUBJECT = 'Fwd: Maple Grove Elementary: October Newsletter';
resolveEventTimes(events, { subject: FWD_SUBJECT, body: 'Maple Grove Elementary October newsletter.' });
const noDesc = events.map((e) => ({ ...e, Description: '' }));

const full = buildReportEmail(events, FWD_SUBJECT, 'Oct 15, 2026', false, '');
const slim = buildReportEmail(noDesc, FWD_SUBJECT, 'Oct 15, 2026', false, '');
const REPORT_SUBJECT = full.subject; // real format: Scout Report: "<cleaned forwarded subject>"

// 1:1 body = the full real email, exactly as the template emits it (incl. signature + footer).
const reportFull = full.html;
// Hero-scaled body = the same real markup, minus signature/footer, minus the "Your events from ..."
// heading (the container's subject line already says it), descriptions dropped, paddings tightened.
const shellStart = slim.html.indexOf('<div style="background-color: #F3F7F3');
const shellEnd = slim.html.indexOf('<p>your calendar scout</p>');
if (shellStart < 0 || shellEnd < 0) throw new Error('Report markup changed; update render-hero-containers.ts');
const reportScaled =
	'<div style="font-family: Georgia, serif; color: #333; line-height: 1.6;">' +
	slim.html
		.slice(shellStart, shellEnd)
		.replace(/<h3[^>]*>[\s\S]*?<\/h3>/, '')
		.replace('padding: 24px; border-radius: 24px;', 'padding: 14px; border-radius: 22px;')
		.replace(/padding: 20px; margin-bottom: 16px;/g, 'padding: 16px; margin-bottom: 12px;') +
	'</div>';

// ---------------------------------------------------------------------------------------------
// 2. The fictional "before" newsletter markup
// ---------------------------------------------------------------------------------------------
const nlFile = readFileSync(join(HERO, 'hero-newsletter-before.html'), 'utf8');
const nlMatch = nlFile.match(/<div class="wrap">([\s\S]*)<\/div><\/body>/);
if (!nlMatch) throw new Error('Newsletter markup changed; update render-hero-containers.ts');
const newsletterFull = `<div class="nl">${nlMatch[1].replace(/<div class="meta">[\s\S]*?<\/div>/, '')}</div>`;

// Hero-scaled newsletter: an abridged excerpt. Every sentence is copied verbatim from the 1:1 newsletter;
// sections are trimmed/re-ordered so two buried date phrases are legible without any highlighting.
const newsletterScaledOf = (withNote: boolean) => `<div class="nl scaled">
<div class="banner"><div class="school">Maple Grove Elementary School</div><div class="title">The Grove Gazette</div><div class="ed">October Newsletter &middot; News for Maple Grove Families</div></div>
<div class="content">
${withNote ? '<h2>A Note from Our Principal</h2>\n<p>What a wonderful start to the school year it has been!</p>\n' : ''}<h2>Upcoming Happenings</h2>
<p>We have a busy few weeks ahead, so here is what is coming up. Picture day is next Thursday, Oct 22, and will take place in the gym from 8:30am to 11:30am. Individual portraits will be taken by grade, and order forms will go home with students the week before.</p>
<p>Our PTA is thrilled to announce the return of the Harvest Carnival on Friday, Oct 30, from 5:30pm to 8:00pm on the playground. There will be games, a cake walk and a chili supper, and costumes are welcome (no masks that cover the whole face, please).</p>
</div></div>`;
const newsletterScaled = newsletterScaledOf(true);
const newsletterScaledTile = newsletterScaledOf(false);

const NL_CSS = `
.nl{font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.5;color:#2b2b2b}
.nl .banner{background:#1f3f73;color:#fff;padding:22px 16px 16px;text-align:center;border-bottom:5px solid #e0a526}
.nl .banner .school{font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#f3d98b}
.nl .banner .title{font-family:Georgia,serif;font-size:27px;font-weight:bold;margin:4px 0 2px;line-height:1.15}
.nl .banner .ed{font-size:12px;color:#d6e0f2}
.nl .content{padding:14px 16px 18px}
.nl h2{font-size:15px;margin:16px 0 5px;color:#1f3f73;border-bottom:2px solid #f3d98b;padding-bottom:2px}
.nl p{margin:0 0 9px}
.nl ul{margin:0 0 9px;padding-left:19px}
.nl li{margin-bottom:5px}
.nl .box{background:#fff6dc;border:1px solid #e8cf84;padding:9px 11px;margin:10px 0;font-size:12.5px}
.nl .small{font-size:11px;color:#666}
.nl .sign{margin-top:12px}
.nl .foot{background:#eef1f6;color:#666;font-size:10.5px;padding:10px 16px;text-align:center;line-height:1.5}
.nl.scaled .banner{padding:12px 10px 9px}
.nl.scaled .banner .school{font-size:9.5px;letter-spacing:1.5px}
.nl.scaled .banner .title{font-size:25px}
.nl.scaled .banner .ed{font-size:11px}
.nl.scaled .content{padding:10px 14px 18px}
.nl.scaled h2{margin:12px 0 4px}
`;

// ---------------------------------------------------------------------------------------------
// 3. Generic, unbranded email-client chrome
// ---------------------------------------------------------------------------------------------
type Kind = 'before' | 'after';
const WHO: Record<Kind, { initial: string; name: string; addr: string; subject: string; time: string }> = {
	before: { initial: 'M', name: 'Maple Grove Elementary', addr: 'newsletter@maplegrove-elementary.example', subject: 'Maple Grove Elementary: October Newsletter', time: 'Oct 15, 7:42 AM' },
	// Display name is the real DISPLAY_NAME from wrangler.jsonc; address is the real FROM_EMAIL.
	after: { initial: 'C', name: 'Calendar Scout · report in ~1 min', addr: 'scout@sendtoschedule.com', subject: REPORT_SUBJECT, time: 'Oct 15, 7:43 AM' },
};

const svg = (d: string, size = 22) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const ICON = {
	back: svg('<path d="M15 5l-7 7 7 7"/>'),
	reply: svg('<path d="M9 7L4 12l5 5"/><path d="M4 12h10a6 6 0 0 1 6 6v1"/>'),
	forward: svg('<path d="M15 7l5 5-5 5"/><path d="M20 12H10a6 6 0 0 0-6 6v1"/>'),
	archive: svg('<rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v11h14V8"/><path d="M10 12h4"/>'),
	trash: svg('<path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/><path d="M10 11v6M14 11v6"/>'),
	more: svg('<circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/>'),
};

const CSS = `
*{box-sizing:border-box}
html,body{margin:0;padding:0;background:transparent;-webkit-font-smoothing:antialiased}
body{font-family:Arial,Helvetica,sans-serif;color:#222}
.glyph{color:#5d6368;display:inline-flex;align-items:center}
.avatar{border-radius:50%;background:#d3d7da;color:#454b50;font-weight:bold;display:flex;align-items:center;justify-content:center;flex:none}
.name{font-weight:bold;color:#222}
.addr,.muted{color:#6b7177}
${NL_CSS}
/* phone */
.screen{background:#fff;overflow:hidden;position:relative}
.status{display:flex;justify-content:space-between;align-items:center;height:26px;padding:0 18px;font-size:12px;font-weight:bold;color:#222}
.status .r{display:flex;gap:6px;align-items:center}
.bars{display:flex;gap:2px;align-items:flex-end;height:11px}.bars i{display:block;width:3px;background:#222;border-radius:1px}
.batt{width:22px;height:11px;border:1.5px solid #222;border-radius:3px;padding:1px}.batt i{display:block;height:100%;width:70%;background:#222;border-radius:1px}
.appbar{display:flex;align-items:center;justify-content:space-between;height:44px;padding:0 12px;border-bottom:1px solid #e3e6e8}
.appbar .acts{display:flex;gap:18px}
.phead{padding:12px 14px 10px}
.subj{font-size:19px;font-weight:bold;line-height:1.25;color:#1d1f21;margin:0 0 10px}
.srow{display:flex;gap:10px;align-items:center}
.srow .meta{flex:1;min-width:0;line-height:1.35}
.srow .meta .name{font-size:13.5px}
.srow .meta .addr{font-size:11.5px;white-space:nowrap}
.srow .meta .to{font-size:11.5px;color:#6b7177;display:flex;justify-content:space-between}
.srow .when{font-size:11px;color:#6b7177;text-align:right;white-space:nowrap}
.pbody{border-top:1px solid #eceef0}
/* desktop */
.win{background:#fff;overflow:hidden;position:relative}
.titlebar{height:34px;background:#ececee;border-bottom:1px solid #d8dbde;display:flex;align-items:center;padding:0 14px;position:relative}
.titlebar .dots{display:flex;gap:7px}.titlebar .dots i{display:block;width:11px;height:11px;border-radius:50%;background:#c4c8cc}
.titlebar .t{position:absolute;left:0;right:0;text-align:center;font-size:12px;color:#777}
.toolbar{display:flex;gap:22px;align-items:center;height:44px;padding:0 18px;border-bottom:1px solid #e3e6e8;background:#fafafb}
.toolbar .b{display:flex;gap:6px;align-items:center;font-size:12px;color:#5d6368}
.dhead{padding:16px 24px 12px}
.dsubj{font-size:22px;font-weight:bold;line-height:1.25;margin:0 0 12px;color:#1d1f21}
.dbody{border-top:1px solid #eceef0}
.dcol{margin:0 auto}
`;

function statusBar(): string {
	return `<div class="status"><span>10:08</span><span class="r"><span class="bars"><i style="height:4px"></i><i style="height:6px"></i><i style="height:8px"></i><i style="height:11px"></i></span><span class="batt"><i></i></span></span></div>`;
}
function senderRow(k: Kind, avatar: number, nameSize?: number): string {
	const w = WHO[k];
	return `<div class="srow"><div class="avatar" style="width:${avatar}px;height:${avatar}px;font-size:${Math.round(avatar * 0.45)}px">${w.initial}</div>
<div class="meta"><div class="name"${nameSize ? ` style="font-size:${nameSize}px"` : ''}>${w.name}</div><div class="addr">&lt;${w.addr}&gt;</div><div class="to"><span>to me</span><span class="when">${w.time}</span></div></div></div>`;
}
function phoneChrome(k: Kind, zoom: number, compact = false): string {
	const w = WHO[k];
	return `<div style="zoom:${zoom}">${compact ? '' : statusBar()}
${compact ? '' : `<div class="appbar"><span class="glyph">${ICON.back}</span><span class="acts"><span class="glyph">${ICON.archive}</span><span class="glyph">${ICON.trash}</span><span class="glyph">${ICON.reply}</span><span class="glyph">${ICON.forward}</span></span></div>`}
<div class="phead"><h1 class="subj">${w.subject}</h1>${senderRow(k, 34)}</div></div>`;
}
function desktopChrome(k: Kind, zoom: number): string {
	const w = WHO[k];
	return `<div style="zoom:${zoom}"><div class="titlebar"><span class="dots"><i></i><i></i><i></i></span><span class="t">Message</span></div>
<div class="toolbar"><span class="b"><span class="glyph">${ICON.reply}</span>Reply</span><span class="b"><span class="glyph">${ICON.forward}</span>Forward</span><span class="b"><span class="glyph">${ICON.archive}</span>Archive</span><span class="b"><span class="glyph">${ICON.trash}</span>Delete</span></div>
<div class="dhead"><h1 class="dsubj">${w.subject}</h1>${senderRow(k, 40, 14.5)}</div></div>`;
}
function bodyOf(k: Kind, scaled: boolean): string {
	return k === 'before' ? (scaled ? newsletterScaled : newsletterFull) : scaled ? reportScaled : reportFull;
}

// ---------------------------------------------------------------------------------------------
// 4. Page builders
// ---------------------------------------------------------------------------------------------
const manifest: string[] = [];
function emit(name: string, w: number, h: number, scale: number, title: string, bodyHtml: string, extraCss = '') {
	const html = `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><title>${title}</title><style>${CSS}${extraCss}</style></head><body>${bodyHtml}</body></html>\n`;
	writeFileSync(join(SRC, `${name}.html`), html, 'utf8');
	manifest.push(`${name} ${w} ${h} ${scale}`);
}

// Phone screen, edge to edge (opaque). scaled: body zoomed up, white fade at the bottom.
function phoneScreen(k: Kind, scaled: boolean, name: string, scale: number) {
	const H = 844;
	const bz = scaled ? 1.4 : 1;
	const cz = 1;
	const body = `<div class="pbody"><div style="zoom:${bz};padding:${k === 'after' ? (scaled ? '6px 6px 0' : '12px 12px 0') : '0'}">${bodyOf(k, scaled)}</div></div>`;
	const fade = scaled ? `<div style="position:absolute;left:0;right:0;bottom:0;height:170px;background:linear-gradient(to bottom,rgba(255,255,255,0),#fff 94%)"></div>` : '';
	emit(name, 390, H, scale, name, `<div class="screen" style="width:390px;height:${H}px">${phoneChrome(k, cz)}${body}${fade}</div>`);
}

// Phone tile: 3:4 (390 x 520), transparent, rounded-top screen that bleeds off the bottom and fades out.
// Two tiles side by side = 780 x 520 = 3:2 = the hero image slot.
function phoneTile(k: Kind, name: string, scale: number) {
	const tileBody = k === 'before' ? newsletterScaledTile : reportScaled;
	const body = `<div class="pbody"><div style="zoom:1.3;padding:${k === 'after' ? '6px 6px 0' : '0'}">${tileBody}</div></div>`;
	emit(
		name, 390, 520, scale, name,
		`<div class="tile"><div class="screen scr" style="width:360px;height:600px">${phoneChrome(k, 0.85, true)}${body}</div></div>`,
		`.tile{width:390px;height:520px;position:relative;overflow:hidden;-webkit-mask-image:linear-gradient(to bottom,#000 84%,transparent 100%);mask-image:linear-gradient(to bottom,#000 84%,transparent 100%)}
.scr{position:absolute;left:15px;top:14px;border-radius:26px 26px 0 0;border:1px solid #c9cdd1;box-shadow:0 6px 16px rgba(0,0,0,.16)}`
	);
}

// Desktop window. mode 'window' = rounded corners + soft shadow on a transparent canvas;
// mode 'screen' = edge-to-edge opaque rectangle (for putting inside a laptop screen).
function desktop(k: Kind, scaled: boolean, mode: 'window' | 'screen', name: string, cw: number, ch: number, scale: number) {
	const bz = scaled ? 1.4 : 1;
	const colW = scaled ? 440 : 600;
	const body = `<div class="dbody" style="padding:${scaled ? '12px' : '20px'} 0 0"><div class="dcol" style="zoom:${bz};width:${colW}px">${scaled && k === 'before' ? newsletterScaledTile : bodyOf(k, scaled)}</div></div>`;
	if (mode === 'screen') {
		emit(name, cw, ch, scale, name, `<div class="win" style="width:${cw}px;height:${ch}px">${desktopChrome(k, scaled ? 0.8 : 1)}${body}${scaled ? `<div style="position:absolute;left:0;right:0;bottom:0;height:150px;background:linear-gradient(to bottom,rgba(255,255,255,0),#fff 92%)"></div>` : ''}</div>`);
		return;
	}
	const pad = scaled ? 20 : 20;
	const fadeMask = scaled
		? `-webkit-mask-image:linear-gradient(to bottom,#000 80%,transparent 100%);mask-image:linear-gradient(to bottom,#000 80%,transparent 100%);`
		: '';
	emit(
		name, cw, ch, scale, name,
		`<div style="width:${cw}px;height:${ch}px;position:relative;overflow:hidden;${fadeMask}"><div class="win" style="position:absolute;left:${pad}px;top:${pad - 4}px;width:${cw - pad * 2}px;height:${scaled ? ch * 2 : ch - pad * 2 + 4}px;border-radius:12px;border:1px solid #cdd1d4;box-shadow:0 12px 36px rgba(0,0,0,.2)">${desktopChrome(k, scaled ? 0.8 : 1)}${body}</div></div>`
	);
}

// Bare artifact (no container) in the hero-scaled flavor: 3:4 tile and 3:2 wide, transparent, fading out.
function bare(k: Kind, shape: 'tile' | 'wide', name: string, scale: number) {
	const w = shape === 'tile' ? 390 : 780;
	const h = 520;
	const inner = shape === 'tile' ? 358 : 560;
	const bz = 1.4;
	const card = k === 'before' ? 'background:#fff;border:1px solid #d6dade;border-radius:14px;overflow:hidden;' : '';
	emit(
		name, w, h, scale, name,
		`<div style="width:${w}px;height:${h}px;position:relative;overflow:hidden;-webkit-mask-image:linear-gradient(to bottom,#000 68%,transparent 100%);mask-image:linear-gradient(to bottom,#000 68%,transparent 100%)"><div style="position:absolute;left:${(w - inner * 1) / 2}px;top:14px;width:${inner}px;${card}"><div style="zoom:${bz}">${bodyOf(k, true)}</div></div></div>`
	);
}

for (const k of ['before', 'after'] as Kind[]) {
	// 1:1 flavor
	phoneScreen(k, false, `phone-${k}-1x@3x`, 3);
	desktop(k, false, 'window', `desktop-${k}-1x@2x`, 1040, 680, 2);
	// hero-scaled flavor
	phoneScreen(k, true, `hero-phone-${k}-screen@3x`, 3);
	phoneTile(k, `hero-phone-${k}-tile@3x`, 3);
	desktop(k, true, 'window', `hero-desktop-${k}-window@3x`, 780, 520, 3);
	desktop(k, true, 'screen', `hero-desktop-${k}-screen@3x`, 800, 500, 3);
	bare(k, 'tile', `hero-bare-${k}-tile@3x`, 3);
	bare(k, 'wide', `hero-bare-${k}-wide@3x`, 3);
}
writeFileSync(join(SRC, 'manifest.txt'), manifest.join('\n') + '\n', 'utf8');
console.log(manifest.join('\n'));
console.log('Report subject (real format): ' + REPORT_SUBJECT);
