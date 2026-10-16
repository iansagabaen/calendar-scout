---
name: Hero banner with the "before" newsletter image - copy options, layout spec, prompts P7-P10 and F4, live preview (2026-10-16)
description: New hero direction for the Calendar Scout homepage - lead with the overwhelming "before" newsletter, explain the promise in live text beside it. Six headline + subhead pairs with a recommendation, a plain-language layout spec with measured contrast ratios, Nano Banana prompts P7-P10, a Figma prompt F4, and a real no-AI HTML preview (two variants, desktop and mobile).
type: marketing
---

# Calendar Scout hero banner: lead with the "before" newsletter

**What changed.** The 2026-10-15 pack (`2026-10-15-homepage-hero-mockup-prompts.md`) put the
clean "after" Scout Report in the hero. Ian's new direction: the hero is a *banner*, so it should
show the **overwhelming wall of text first** (the pain), with a line of words that says the
promise: take your really long newsletters, full of dates, and get them in a form that is easy to
add to your calendar. The clean "after" image Ian made in Google AI Studio moves to a later section.

**The three ideas this whole document is built on** (explained plainly, because they drive every choice):

1. **The headline is live text, never baked into the picture.** AI image tools misspell words,
   search engines and screen readers cannot read words that are painted into a picture, and a
   picture cannot re-wrap itself on a phone. So every image prompt below asks for *empty space*
   where the live words will sit.
2. **Say only what the product really does.** You forward an email to an `@sendtoschedule.com`
   address; you get back a Scout Report with each event on its own card; each card has an
   "Add to Calendar" button that opens a pre-filled Google Calendar event (it does not add anything
   automatically); it is free and needs no account. It does not sync, read photos or PDFs (coming
   soon), or have an app or dashboard. Nothing in the hero may suggest otherwise.
3. **The picture is the pain, the words are the promise, the button is the next step.** The wall of
   text should feel heavy at a glance. The headline explains what to do about it. The button points
   at the "forward it" card just below.

---

## 1. What I saw in the existing assets, and one important finding

I opened each file and looked at it. Sizes are in pixels.

| File | Size | Ratio | What it looks like | Verdict for a hero banner |
|---|---|---|---|---|
| `hero-phone-before-screen@3x.png` | 1170 x 2532 | 390:844 (about 1:2.16) | Phone status strip, back-arrow header, subject, sender, then the navy "The Grove Gazette" banner, a "Note from Our Principal" heading with ONE short sentence, an "Upcoming Happenings" heading and ONE paragraph with Oct 22 readable, then the start of the Harvest Carnival paragraph fading out | Reads as "a newsletter", but it is **not a wall of text**. It is about three short paragraphs with big headings. The navy banner is the loudest thing and competes with a headline. |
| `hero-phone-before-tile@3x.png` | 1170 x 1560 | 3:4 | Same, cropped to a rounded-top tile: subject, sender, navy banner, one heading, one paragraph fading | Even less text. Nicer shape, but the wall-of-text feeling is gone. |
| `hero-bare-before-wide@3x.png` | 2340 x 1560 | 3:2 | Bare email (no app frame): navy banner, two headings, two paragraphs, fades | Clean and readable, but sparse. Not "overwhelming". |
| `hero-desktop-before-window@3x.png` | 2340 x 1560 | 3:2 | Desktop window with soft shadow and rounded corners: title bar, toolbar, subject, sender, navy banner, "Upcoming Happenings", one paragraph | Beautiful window, but only about four lines of body text. |
| `hero-desktop-before-screen@3x.png` | 2400 x 1500 | 16:10 | Edge-to-edge desktop screen: title bar, toolbar, subject, sender, navy banner, one heading, one paragraph | Same: sparse. |
| `landing/public/images/hero-graphic.png` (live site) | 1200 x 790 | about 3:2 (1.52:1) | Peach/terracotta/sage collage: a Riverdale newsletter with a mascot-wolf picture, a "forward" yellow box, a grey-card report, three hand-lettered headings, a "Free! No account creation required" badge | This is the current hero. Its text is baked into the picture (the three headings and the badges). It also shows a stand-in report, not the real email. |
| `scout-mascot-reference.png` | 1200 x 1200 | 1:1 | Friendly scout kid with binoculars and a pennant, sage and khaki, on an off-white square | Good as a small friendly accent. The off-white square background needs the same multiply/brightness trick the live page already uses. |

**The finding.** All the "hero-scaled" before images were deliberately enlarged about 1.4x so they
stay readable, and the price is that they show only a few lines. For a *banner whose job is to make
you feel the overwhelm*, that is too gentle. The 1:1 phone render (`phone-before-1x@3x.png`) is
denser, but its first screen shows only the principal's note, with **no dates visible at all**.

**What I did about it.** I scrolled the real newsletter down to its "Upcoming Happenings" stretch,
where all four dates live, and cropped it, keeping the real phone header on top (so it still reads
"an email on a phone"), and fading out at the bottom. Nothing is redrawn; it is a pixel crop of the
real rendered newsletter (script: `marketing/hero/source/make-dense-crops.py`). Two new files:

| New file | Size | Ratio | What it shows |
|---|---|---|---|
| `marketing/hero/hero-phone-before-dense@3x.png` | 1170 x 2532 | 390:844 | Phone header, then a solid wall of small black text: end of the lunch-menu paragraph, "Upcoming Happenings", the Picture Day paragraph (**Thursday, Oct 22**, 8:30am to 11:30am), the Harvest Carnival paragraph (**Friday, Oct 30**, 5:30pm to 8:00pm), the yellow PTA fundraiser box, the conferences paragraph (**Tuesday, Nov 10**) and the early-release sentence (**Wednesday, Nov 18**), fading to white at the very bottom. Dates are present and readable but not highlighted, buried in sentences, exactly the problem Calendar Scout solves. |
| `marketing/hero/hero-wide-before-dense@2x.png` | 1320 x 960 | 11:8 (1.375) | The same stretch at desktop width (no phone header), top cut mid-scroll, fading out at the bottom. |

**Which crop I recommend for the hero.**
- **Desktop:** the dense phone (`hero-phone-before-dense@3x.png`), tilted a few degrees, running off the bottom of the banner and fading into it. A phone is a tall shape, which pairs with text on the left, and its text is dense enough to feel like "too much". The wide crop is the runner-up when the picture goes *below* the headline instead of beside it.
- **Mobile (342 px image width):** the same dense phone, cropped to about 262 x 300 px visible. The wide crop does **not** work on mobile: shrunk to 342 px its text becomes about 6 px tall, unreadable mush (the dates would vanish). So mobile should always get the phone art, even when desktop uses the wide art (in code that is a `<picture>` element, a small change).

**Ian's Google AI Studio image: not found.** I looked for new or untracked images in `projects/calendar-scout/` (the only untracked item is `.wrangler/`, a Cloudflare tool folder) and searched all of `/Users/ian/my-projects/` for pictures saved after the last commit. Nothing. So I have not seen it and have not described it. When you save it, drop it in `projects/calendar-scout/marketing/hero/` (for example `ai-studio-phone-after.png`) so it can be placed in the later "what you get back" section.

---

## 2. Hero copy options (the words)

Voice check: Calendar Scout speaks warmly and calmly, in the first person, with small, concrete
promises ("I'm scouting through your message right now", "your calendar scout", "I am not always
perfect, so please check my work"). These lines keep that: plain words, no hype, no
"never miss anything", no "automatic".

Targets: headline of about 8 words or fewer so it sits on two lines at 52 to 72 px; subhead of about
20 words so it takes two lines at 20 px *when it has room* (in the narrower left column of
variant A it wraps to three lines; that is fine).

### Option 1: the literal version of Ian's sentence (my recommendation)

- **Headline:** Turn long newsletters into easy calendar events
- **Subhead:** Forward the one full of dates. Get back each event on its own card, with a one-tap Add to Calendar button.
- **Why:** It is Ian's own sentence cleaned up: long newsletters in, easy-to-add events out. It names the product's job in the headline (good for people and for search: "newsletters", "calendar"), and the picture beside it proves the "long newsletters" half.
- **Truthfulness check:** ✓ Each event does get its own card with an Add to Calendar button; "easy to add" is true (the button opens a pre-filled Google Calendar event); nothing says automatic. "Calendar events" means the cards, not events already placed in your calendar.

### Option 2: pain first

- **Headline:** Another long newsletter full of dates?
- **Subhead:** Forward it to Calendar Scout. You'll get back each event on its own card, with a one-tap Add to Calendar button.
- **Why:** Starts with the exact moment a parent recognises and lets the wall-of-text picture answer the question before the words do. Weaker at saying what the product is until the second line.
- **Truthfulness check:** ✓ A question plus a plain instruction. Nothing claimed beyond the cards and the button.

### Option 3: the dates are buried

- **Headline:** Your dates are buried in paragraph nine
- **Subhead:** Calendar Scout digs them out. Forward it and get each event on its own card with an Add to Calendar button.
- **Why:** The most visual and a little playful: the image literally shows dates hidden inside paragraphs. A touch more personality, a touch less clear about the product, and "paragraph nine" is a joke about a typical newsletter, not a claim about yours.
- **Truthfulness check:** ✓ "Digs them out" describes finding the dates; it does not say it is perfect (the email footer already asks people to check its work).

### Option 4: plain instruction

- **Headline:** Forward it. Tap to add each date.
- **Subhead:** Send Calendar Scout any long email full of dates and get back each event on its own card, easy to add.
- **Why:** Two steps, no metaphor. It tells a first-time visitor exactly what to do, and it matches the numbered "forward it" card below it. Least emotional.
- **Truthfulness check:** ✓ You forward, then tap a card's button for each date you want; that is what happens. ("Any long email" is true for text emails; the site says photos and PDFs are coming soon.)

### Option 5: time and relief

- **Headline:** Skip the scrolling. Keep the dates.
- **Subhead:** Forward a long newsletter. In about a minute, get back just the events, each with a one-tap Add to Calendar button.
- **Why:** Sells the relief of not hunting through paragraphs. It is the only option that mentions time.
- **Truthfulness check:** ✓ "About a minute" matches the sender name the product sends ("Calendar Scout · report in ~1 min"). **Heads-up:** the live page's step 3 says "Wait a few seconds for a reply". Those two should agree; "about a minute" is the safer promise.

### Option 6: keep the current headline, add a newsletter-pain subhead

- **Headline:** From inbox to calendar in one tap *(the existing H1, unchanged)*
- **Subhead:** Got a long newsletter full of dates? Forward it and get each event back on its own card, ready to add.
- **Why:** Lowest risk; nothing about the page's voice changes, and the subhead ties it to the newsletter picture. The headline is broader and says nothing about newsletters, so the image has to do more work.
- **Truthfulness check:** ✓ with one honest caveat: "one tap" is true of the Add to Calendar button, but the pre-filled Google Calendar event still needs a save tap inside Google Calendar. It is the existing line, so I kept it, but Options 1 to 5 are a little more careful.

### My recommendation: Option 1

**Turn long newsletters into easy calendar events** / *Forward the one full of dates. Get back each event on its own card, with a one-tap Add to Calendar button.*

Why: it is Ian's idea in clean words; the headline says the whole job (long newsletters, calendar events); the picture beside it supplies the pain so the headline does not have to; and it carries the two words people search for. Option 2 is the runner-up if Ian wants the first thing a visitor reads to be the pain. I would **not** split-test them: the site has no proven outside traffic yet (see `projects.md`, Calendar Scout status), so a test would never reach a meaningful number. Pick one and ship.

### CTA button label (points at the "forward it" card)

- **Primary:** *Try it with one newsletter* (with a small down-arrow). It sets a low bar (just one) and says what to bring. It scrolls down to the "1. Find an email in your inbox / 2. Forward it to:" card.
- Other fits: "Forward one newsletter" or "See how to forward one".
- **Small line under the button:** *Free. No account. Opens a pre-filled Google Calendar event.* This is the honest answer to "will it do something I didn't ask for?" and it quietly tells Apple Calendar and Outlook people what to expect (the product only makes Google Calendar links).

### Alt text for the before image

> A school newsletter on a phone: long paragraphs of small text, with dates like Oct 22 and Oct 30 buried inside them, and more below.

(Short, true, says what is in the picture. The wide-image version: "A school newsletter on a laptop: dense paragraphs with dates such as Oct 22 and Oct 30 buried in the text, fading out because it keeps going.")

---

## 3. Layout spec (plain language)

I built this as a real page you can look at (section 6), and the numbers below are the ones used there.

### Desktop (1440 wide, 1024 content column)

**Recommended: Variant A, text on the left, phone on the right, inside one soft rounded "banner".**

- **The banner:** one box, 1024 wide by 600 tall, `rounded-[2.5rem]` (40 px corners, the same as the "forward it" card), a soft shadow in forest-tinted grey, and a very quiet background: sage mist `#F3F7F3` with a hint of pale sage at the top-left and a hint of blush `#FDE3D8` at the bottom-right (these are the colours already in the site's palette and the old hero art). A 1 px sage border `#E0E7E0`.
- **Left (about 540 px wide, vertically centred, 56 px from the edge):** headline, subhead, button, small trust line.
- **Right:** the dense before phone, about 350 px wide, tilted 3 degrees, starting about 34 px from the top and **running off the bottom edge**. The bottom third fades into the banner colour. That "runs off the bottom and fades" is the visual way of saying "and it goes on and on".
- **Image shape:** about 350 x 757 px of phone, with roughly 650 px of it visible. The file is 390:844.
- **Mascot:** leave it out of the banner (it would fight the phone and the headline). It goes back in as a small accent later in the page, or stays in Variant B's heading row.
- **The existing "forward it" card:** stays exactly as it is, 32 px below the banner (the same `mb-8` gap it has now). The button's job is to scroll to it.

**Variant B (the smallest change from today): text above, wide before image below.** Keep the existing heading row (headline left, mascot right), add the subhead and button under the headline, and replace the old `hero-graphic.png` slot with the wide dense crop (`hero-wide-before-dense@2x.png`) in a window frame (a thin grey title bar with three dots) inside the same `rounded-3xl overflow-hidden shadow-2xl` wrapper the site uses, 1024 wide by 620 tall, with a white fade over the bottom 150 px. Then the "forward it" card.

### Mobile (390 wide, 342 content width)

- **Order, top to bottom:** headline, subhead, full-width button, the trust line, then the picture, then the "forward it" card.
- **Variant A mobile:** the banner shrinks to 358 wide, 32 px corners, with the same sage-and-blush background. The picture is a 262 px wide phone, tilted 3 degrees, only the top 300 px visible, fading out. Text left-aligned inside 22 px padding.
- **Variant B mobile:** mascot centred above the headline (132 px, like the live page does now), then headline, subhead, button, then the **phone** picture (not the wide one) in a 342 px wide rounded card, 400 px tall, with a 130 px fade.
- **Never** show the wide picture on mobile (text shrinks to about 6 px).

### Type sizes

| Element | Desktop A | Desktop B | Mobile | Font |
|---|---|---|---|---|
| Headline | 52 px, line-height 1.08 | 68 px, line-height 1.06 (the live site uses 72) | 36 px, line-height 1.1 | Cormorant Garamond Medium |
| Subhead | 20 px, line-height 1.5 | 20 px | 18 px | Inter Regular |
| Button | 18 px semibold | 18 px | 17 px | Inter |
| Trust line | 14 px | 14 px | 14 px | Inter |

Headline tracking slightly tight (-0.015em), as the site does. On mobile let the browser balance the lines (`text-wrap: balance`) so it breaks "Turn long / newsletters into / easy calendar events" instead of leaving "events" alone.

### Spacing

Banner padding 56 px (desktop), 22 px (mobile). Headline to subhead 22 px, subhead to button 30 px, button to trust line 14 px. Banner to "forward it" card 32 px.

### Contrast (WCAG AA = 4.5:1 for normal text, 3:1 for large text), calculated

I computed these with the standard WCAG formula.

| Text on background | Ratio | Passes AA? |
|---|---|---|
| Forest `#2E4A2E` on white `#FFFFFF` | **9.84 : 1** | Yes, and AAA |
| Forest on sage mist `#F3F7F3` | **9.09 : 1** | Yes, and AAA |
| Forest on blush `#FDE3D8` | **8.03 : 1** | Yes, and AAA |
| White on Forest (the button) | **9.84 : 1** | Yes, and AAA |
| Olive `#556B55` on white | **5.80 : 1** | Yes |
| Olive on sage mist | **5.36 : 1** | Yes (used for the trust line) |
| Olive on blush | **4.74 : 1** | Yes, just |
| Subhead colour I used, `#3E5A3E` (Forest at about 85%) on white / sage mist / blush | **7.67 : 1** / **7.09 : 1** / **6.27 : 1** | Yes |
| **Forest at 70% opacity** on white (the site's current `text-forest/70` style) | **4.23 : 1** | **No** for 20 px regular text |
| Forest at 70% on sage mist / on blush | 4.05 / 3.82 | No |
| Forest at 50% on white (the site's nav tagline and the small caption under "Add to Contacts") | **2.61 : 1** | **No** |

So: **do not use `text-forest/70` for the new subhead.** Use a solid colour at about 85% Forest (`#3E5A3E`) or full Olive. (The existing 70% and 50% text elsewhere on the site also fall below 4.5:1; I did not touch them, but they are worth a later pass.)

**Text on the image: none, on purpose.** All words sit on the plain banner background, never over the picture, so there is no "text over a busy photo" case to check. If you ever put a caption over the bottom fade, only do it where the fade is at least 90% white, where Forest gives the full 9.84 : 1.

### Keeping the before image from competing with the headline

The headline must win the first half-second; the picture must win the second.
- **Scale and crop:** the phone is about a third of the banner width, and its text is about 11 px, so it reads as texture first and detail only when you look.
- **No navy banner:** the dense crop skips the loud navy "The Grove Gazette" banner and the yellow header line (those are the highest-contrast colour blocks in the newsletter), leaving mostly black text on white.
- **Tilt 3 degrees** and a soft, forest-tinted shadow, so it feels like an object sitting in the scene, not a screenshot pasted into a column.
- **Fade the bottom** into the banner colour so it has no hard bottom edge to pull the eye down.
- **Do not lower the picture's opacity or desaturate it** to make it "quieter": below about 92% it looks dirty and the dates become hard to read. Size, crop and fade do the job.

### How this relates to the existing 3:2 slot, and what code change comes later

- **Today:** the page has a heading row (H1 left, 320 px mascot right), then `hero-graphic.png` (3:2) in a `rounded-3xl overflow-hidden shadow-2xl` wrapper, then the "forward it" card.
- **Variant A** replaces the heading row *and* the 3:2 slot with the one banner. The 3:2 ratio is no longer the rule; the banner is 1024 x 600 (about 1.7:1).
- **Variant B** keeps the heading row and swaps only the image; the slot becomes about 1024 x 620 (1.65:1), a little less tall than 3:2.
- **Later code changes (not made now):** (1) in `landing/src/App.tsx`, replace the heading row and `{/* Hero Graphic */}` block with a new hero block (live H1, subhead, button, phone image); (2) add `id="forward-it"` and `scroll-mt-6` to the CTA card so the button can jump to it, and fire the existing `posthog.capture('calendar_scout_cta_clicked', { action: 'hero_try_cta' })` on click; (3) put the new image files in `landing/public/images/` as WebP (about 250 KB budget), with a `<picture>` that serves the phone art on small screens; (4) update the alt text; (5) move `hero-graphic.png` and Ian's AI Studio "after" image into a new "what you get back" section lower on the page. Check there is still exactly one `<h1>` on the page.

---

## 4. Image-generation prompts

**How to use any of these in Google AI Studio (Nano Banana) or Gemini:** attach the file(s) named
under "Attach" first, then paste the full prompt, set the aspect ratio if the app has a control, and
ask for one image. These follow the same rules as P1 (the one that worked for the "after" phone):
treat the attached screenshot as a placed photograph, do not redraw it, add no text.

**Which attached file, and why I changed it from the plan:** the plan said to attach
`hero-phone-before-screen@3x.png`. Having looked at it (section 1), that screen shows only a few
short paragraphs, which will not look like a wall of text. I therefore attach the new
`hero-phone-before-dense@3x.png` instead. If Ian prefers the original, swap the filename and in the
prompt replace "dense paragraphs of small black text under a blue heading ..." with "a navy
newsletter banner reading The Grove Gazette, then a heading and short paragraphs"; everything else stays.

**The hero slot (for the aspect ratio):** the banner on the desktop page is 1024 x 600 (about 17:10).
AI Studio offers 16:9 (1.78:1), which is the closest wide shape, so generate at **16:9** and let the
page crop a sliver off the sides (`object-fit: cover` trims less than 5%). Keep everything important
inside the middle 90% of the width. For the **mobile** version, generate a second image at **4:5**
(or reuse the live CSS phone; see the note after P7).

### P7. Before image, phone, empty space on the left for live text (recommended)

- **Purpose:** the main hero picture: the dense newsletter on a phone, with a calm empty left side for the headline.
- **Aspect ratio / size:** **16:9** landscape, 2K (about 2048 x 1152). Page crop: 1024 x 600.
- **Attach:** `marketing/hero/hero-phone-before-dense@3x.png` (1170 x 2532, the phone header plus the dense "Upcoming Happenings" stretch of the real fictional newsletter). Attach nothing else.

```
Use the attached image as the exact content of the phone's screen. It is a screenshot of an email inside a plain, generic email app: a thin status strip with a clock, a header with a back arrow and four small icons, and below that a very dense wall of small black paragraph text with one blue heading ("Upcoming Happenings"), a pale yellow note box, and more paragraphs, softly fading to white at the bottom. It must be reproduced pixel-for-pixel, edge to edge, including that header: do not redraw it, re-type it, rephrase it, re-colour it, translate it, shorten it, sharpen it, enlarge the text, tidy the layout, or add any extra text, icons, status bar, clock, notification, overlay, highlight, circle, underline or arrow beyond what is already in the attached image. Do NOT highlight, circle or colour any date or any word. Treat the screen as a placed photograph. The text is intentionally dense and small and must stay that way; the bottom fade to white must stay exactly as it is.

Create a clean, soft, studio-style product image, wide landscape 16:9. One plain modern smartphone (slim dark bezels, no logo, no brand mark, no camera-bump branding) in portrait orientation, shown whole and uncropped, standing in the RIGHT half of the frame, filling about 85% of the image height, tilted about 4 degrees clockwise. The screen faces the viewer almost straight on, so the text is as sharp as in the attached image. The screen shows the attached image edge to edge, with the top of the email (the status strip) at the top of the screen. A soft, gentle shadow falls below and slightly to the right of the phone.

Composition, very important: the LEFT 45% of the frame is deliberately EMPTY. It is a smooth, clean, calm area of the backdrop with no objects, no shapes, no shadow, no texture, no props, no text and no symbols, because live text will be placed there later. Do not put anything in it.

Backdrop: a smooth soft gradient from pale sage mist (#F3F7F3) on the left to warm blush (#FDE3D8) in the lower right, with very subtle paper grain. Near the phone only, add two or three very large, very soft, low-contrast overlapping organic shapes in light sage (#D5E3DB) and blush (#FCDDCB). Tiny touches of deep forest green (#2E4A2E) are allowed. At most one very small terracotta (#9B3B22) accent. No shapes in the left 45%.

Mood: busy but calm; the phone looks heavy with text, like a newsletter you would rather not read. Soft even light, no harsh glare on the screen.

Do NOT: change, blur, crop, enlarge or recolour the screen content; add any text, numbers, captions, labels, logos or watermarks anywhere in the image; highlight or mark any date; add real brand logos or real app interfaces (no Gmail, Apple Mail, Google or Outlook look-alikes, and no extra status bar or notification on top of the attached screen); add hands, faces or people; add extra phones, floating icons or UI elements; put anything in the left 45% of the frame; invent gibberish text.
```

**A good result looks like:** a calm sage-to-blush backdrop, one tilted phone on the right whose screen is a solid wall of black text matching your attachment (you can still make out "Upcoming Happenings" in blue and the yellow note box), and a big clean empty area on the left.
**Do NOT list (short):** don't let it redraw or highlight the screen; nothing in the left 45%; no logos; no extra text.
**Iteration tips:**
- *Something creeps into the left side (a shape, a shadow, a plant):* "Same image, but the left 45% of the frame must be completely empty smooth backdrop."
- *Screen text is garbled or tidied up:* "Keep everything, but replace the phone screen with the attached image again, exactly, and do not alter its text." If it drifts after two tries, use the fallback paragraph at the end of this section.
- *The model highlights or circles dates:* "Same image, remove every highlight, circle or mark on the screen. The screen is exactly the attached image."
- *Phone too big or too small:* "Same image, make the phone 15% smaller / larger."
- *Too busy or too pink:* "Same image, rebalance the backdrop to mostly sage with only a hint of blush in the bottom right corner."
- **Mobile version (4:5):** after you have a keeper, say "Same scene, now 4:5 portrait: the phone centred in the lower 60% of the frame, the top 35% of the frame completely empty." Or skip this: the live CSS phone in the preview already does it with no AI.

---

### P8. Before image, laptop variant (empty space on the left)

- **Purpose:** the same idea on a laptop, for a "works on desktop too" look or for Variant B if a wide picture is wanted.
- **Aspect ratio / size:** **16:9** landscape, 2K.
- **Attach:** `marketing/hero/hero-desktop-before-screen@3x.png` (2400 x 1500, 16:10, the generic desktop email window: pale-grey title bar with three dots, a Reply / Forward / Archive / Delete toolbar, subject, sender, then the newsletter). **Honest caveat:** this screen is the sparse one (navy banner, one heading, one paragraph); it will say "newsletter" but not "wall of text". For a denser look, attach `hero-wide-before-dense@2x.png` (1320 x 960, 11:8) instead and, in the prompt below, change "in its original 16:10 shape" to "in its original 11:8 shape" and delete the words "including that generic window bar" (that crop has no window bar).

```
Use the attached image as the exact content of the laptop's screen. It is a screenshot of an email inside a plain, generic desktop email window (a pale-grey title bar with three grey dots, a small Reply / Forward / Archive / Delete toolbar, a bold subject line, a sender row, then a school newsletter with a navy header banner and paragraphs of black text, softly fading to white at the bottom). It must be reproduced pixel-for-pixel, including that generic window bar: do not redraw it, re-type it, rephrase it, re-colour it, translate it, shorten it, or add any extra text, icons, menu bar, dock, browser tabs, cursor, highlight, circle or overlay to it. Do NOT highlight, circle or colour any date. Treat the screen as a placed photograph, edge to edge, in its original 16:10 shape. The text is intentionally large and the bottom fade to white must stay exactly as it is.

Create a clean, soft, studio-style product image, wide landscape 16:9. One plain modern laptop (no logo, no brand mark, thin aluminium-look body in neutral silver, plain keyboard with no readable key legends) stands open, shown from the front with the screen facing the viewer almost straight on (a very slight angle, under 8 degrees), in the RIGHT 58% of the frame, with the whole laptop visible. A soft, gentle shadow sits under it.

Composition, very important: the LEFT 40% of the frame is deliberately EMPTY: a smooth, clean, calm area of backdrop with no objects, no shapes, no shadow, no texture, no props, no text and no symbols, because live text will be placed there later.

Backdrop: a smooth soft gradient from pale sage mist (#F3F7F3) on the left to warm blush (#FDE3D8) in the lower right, with very subtle paper grain, and two or three very large, very soft, low-contrast overlapping organic shapes in light sage (#D5E3DB) behind the laptop only. Tiny touches of deep forest green (#2E4A2E) are allowed; at most one very small terracotta (#9B3B22) accent.

Mood: calm, orderly, but the screen looks heavy with text. Soft even light, no glare on the screen.

Do NOT: change, blur, crop, stretch or recolour the screen content; add any text, numbers, captions, logos or watermarks anywhere else; highlight or mark any date; add real brand logos or real app interfaces (no Gmail, Apple Mail, Google, Outlook or Windows look-alikes, no browser tabs, no address bar, no menu bar or dock); add hands, faces or people; add mugs, plants, notebooks or other props; put anything in the left 40% of the frame; invent gibberish text.
```

**A good result looks like:** an open laptop on the right whose screen matches your attachment, the window bar and toolbar included, and clean empty backdrop on the left.
**Iteration tips:**
- *Screen stretched or cropped:* "Keep the screen's original proportions; do not stretch or crop the screenshot."
- *It added a browser window, menu bar or dock:* "Same image, remove everything on the screen that is not in the attached image."
- *Laptop looks like a specific brand:* "Same image, make the laptop generic, no logo, no brand-specific design."
- *Left side not empty:* "Same image, the left 40% must be empty smooth backdrop."
- *Garbled screen:* use the fallback paragraph below.

---

### P9. Before to after teaser (big "before" in front, small "after" peeking behind)

- **Purpose:** for Ian if he wants the promise visible in the hero itself instead of waiting for a later section. The newsletter still dominates (it is the pain); the clean Scout Report is smaller and calmer, a hint of the answer.
- **Aspect ratio / size:** **16:9** landscape, 2K.
- **Attach (in this order):**
  1. `marketing/hero/hero-phone-before-dense@3x.png` (the big "before" phone)
  2. `marketing/hero/hero-phone-after-screen@3x.png` (1170 x 2532, the real Scout Report in a generic email-app frame, the small "after" phone)

```
I am attaching two screenshots. Each is a screenshot of an email inside a plain, generic email app (a thin status strip, a header with a back arrow and four icons). Image 1 is a dense school newsletter: a wall of small black paragraph text with one blue heading and a pale yellow note box. Image 2 is a clean "Scout Report" email: a pale green background with white event cards and dark green "Add to Calendar" buttons. Use image 1 as the exact content of the LARGE front phone's screen and image 2 as the exact content of the SMALL back phone's screen. Reproduce each screen pixel-for-pixel, edge to edge, top of the email at the top of the screen: do not redraw, re-type, rephrase, re-colour, crop, enlarge or sharpen them, and do not add any text, icons, extra status bar, highlight, circle or overlay to either screen beyond what is already in the attached images. Do NOT highlight, circle or colour any date.

Create a clean, soft, studio-style image, wide landscape 16:9, with two identical generic smartphones (slim dark bezels, no logo, no brand mark), both upright and whole. The LARGE front phone (image 1, the newsletter) stands in the right-centre of the frame, filling about 85% of the image height, tilted about 4 degrees clockwise, with a soft shadow. The SMALL back phone (image 2, the Scout Report) stands partly behind it, peeking out from behind its right side and slightly higher, about 70% of the front phone's size, tilted about 4 degrees counter-clockwise, with its screen clearly visible and readable. The front phone overlaps the back phone by roughly a quarter of the back phone's width. The back phone looks calm and light; the front phone looks busy and heavy.

Composition, very important: the LEFT 40% of the frame is deliberately EMPTY: a smooth, clean, calm area of backdrop with no objects, no shapes, no shadow, no texture, no text and no symbols, because live text will be placed there later. No arrow, no label, no icon anywhere.

Backdrop: smooth soft gradient from pale sage mist (#F3F7F3) on the left to warm blush (#FDE3D8) in the lower right, very subtle paper grain, a few very large, very soft, low-contrast overlapping organic shapes in light sage (#D5E3DB) and blush (#FCDDCB) behind the phones only. Tiny touches of deep forest green (#2E4A2E); at most one very small terracotta (#9B3B22) accent.

Mood: calm, relieved, friendly, "heavy to light".

Do NOT: change anything on either screen; swap or blend the two screens; add any text, captions, labels such as "before" or "after", numbers, arrows, logos or watermarks anywhere; highlight or mark any date; add real brand logos or real app interfaces (no Gmail, Apple Mail, Google or Outlook look-alikes); add hands, faces or people; put anything in the left 40% of the frame; invent gibberish text.
```

**A good result looks like:** a large tilted newsletter phone in front, a smaller pale-green report phone peeking out behind it, and empty space on the left.
**Iteration tips:**
- *The two screens are swapped or blended:* "Keep everything, but the LARGE front phone must show image 1 (dense black text, blue heading, yellow box) and the SMALL back phone image 2 (white cards, dark green buttons)."
- *The back phone is hidden or too small to read the cards:* "Same image, move the back phone further to the right so its first card and button are visible."
- *It adds an arrow or the words "before" and "after":* "Same image, remove every arrow, label and word outside the phone screens." (Add labels later in the page in live text, if wanted.)
- *Screen text drifts:* fallback paragraph below.
- *Truthfulness note:* this picture shows the *same* newsletter turning into the *same* report, which is exactly what the product does. It does not show anything being added to a calendar, which would not be true.

---

### P10. "Pile-up" concept (text-free, an alternative to the screenshot)

- **Purpose:** if Ian wants the hero to say "so many newsletters" rather than show one real one. A calm illustration of a heap of overlapping paper newsletters and flyers with unreadable text-lines. Because it has **no real words or dates**, it carries no risk of garbled text and no truthfulness risk, but it is also the least specific picture of the product.
- **Aspect ratio / size:** **16:9** landscape, 2K.
- **Attach:** nothing. (Optional, style only: `landing/public/images/hero-graphic.png`, adding the final line at the bottom of the prompt.)

```
Create a calm, text-free editorial illustration, wide landscape 16:9, in a gentle flat paper-cut style with soft watercolour texture, subtle paper grain and clean organic shapes.

Subject: a loose, overlapping pile of paper school newsletters and flyers, heaped slightly untidily and spilling a little, in the RIGHT half of the frame, as if a busy parent's inbox had been printed out. About eight to twelve sheets, each a different size and slight rotation. The text on every sheet is shown ONLY as rows of soft grey-brown horizontal lines and small rounded blocks that look like paragraphs, bullet points, headings and photo boxes at a distance, with NO readable letters, NO numbers, NO words and NO symbols that resemble writing. A few sheets have a coloured header band (soft navy, pale yellow, sage). One or two sheets curl at a corner. Soft contact shadows between the sheets. A few paper-clips and one small pennant-shaped flag poke out as friendly, quiet details.

Composition, very important: the LEFT 45% of the frame is deliberately EMPTY: a smooth, clean, calm backdrop with no objects, no shapes, no shadows, no texture and no text, because live text will be placed there later. The pile is anchored low in the right half and rises to about 75% of the image height, with a few sheets drifting up and to the right.

Palette: backdrop fading from pale sage mist (#F3F7F3) on the left to warm blush (#FDE3D8) at the lower right; sheets in white and off-white; headers in soft navy, pale yellow and sage; tiny touches of deep forest green (#2E4A2E); at most one very small terracotta (#9B3B22) accent. Soft, even light; no hard shadows.

Mood: calm and a little overwhelmed, friendly, "there is a lot here, but it is manageable".

Do NOT: include ANY readable text, letters, numbers, dates, words or symbols that look like writing (all text must be abstract lines and blocks); include people, hands or faces; include logos, real brand marks, real school names, or app interfaces; include a phone, laptop or screen; add watermarks; add anything in the left 45% of the frame; use neon or dark moody colours.
```
*Optional last line if you attached the old hero graphic:* "Use the attached image only as a loose reference for colour and softness; do not copy any of its content and do not include any text from it."

**A good result looks like:** a gentle heap of papers on the right with only grey line-textures on them, calm sage-to-blush backdrop, and a clean empty left side.
**Iteration tips:**
- *Words, numbers or dates appear on the paper:* "Same image, replace every piece of lettering on the papers with plain grey lines. There must be no letters or numbers."
- *Too busy:* "Same image, reduce the pile to about six sheets."
- *Anything in the left 45%:* "Same image, the left 45% must be empty backdrop."
- *Too cartoonish or too photographic:* "Same image, keep it flat paper-cut with soft watercolour texture, not photographic."
- *Truthfulness note:* fine to use; it shows "a lot of newsletters", which is true. It says nothing about the product, so the headline carries the whole message.

---

### F4. Figma prompt: the whole hero, with the recommended copy and a swappable before image

- **Purpose:** an editable rebuild of the new hero (nav, banner with live text, before-image slot, CTA, the "forward it" card), desktop and mobile frames, where the before image is a swappable image fill.
- **Place afterwards (the image fills):** `marketing/hero/hero-phone-before-dense@3x.png` into the layer named "Before phone - IMAGE FILL" (scale mode Fill, aligned top), or your finished P7 image into the layer named "Backdrop image - OPTIONAL" if you used AI. Mascot: `marketing/hero/scout-mascot-reference.png`.
- **A note on names.** In the earlier pack I could only confirm two Figma AI features by name: **First Draft** (prompt to editable designs) and **Figma Make** (prompt to a working web app). I have not checked for newer features and I am not asserting any. Use whichever prompt-to-design option in your Figma produces editable frames. If it only offers Figma Make, paste the same prompt and expect a coded preview; copy the values into a Figma design file after.

```
Design the hero section of a calm, friendly landing page for a free micro-product called "Calendar Scout" (for busy parents who get long school newsletters). Create two frames: Desktop (1440 wide) and Mobile (390 wide). Use Auto Layout everywhere, with named layers, and make the frames responsive (children set to Fill container or Hug as appropriate). Light mode only, on a white page background (#FFFFFF).

DESIGN TOKENS (create as local variables/styles):
Colours: Forest #2E4A2E (headings, buttons, main text); Olive #556B55 (secondary text, small captions); Sage mist #F3F7F3 (banner and card backgrounds); Sage border #E0E7E0 (outlines); Blush #FDE3D8 and Light sage #D5E3DB (soft background glows only); White #FFFFFF. Subhead colour #3E5A3E (about Forest at 85%). Do NOT use Forest at 70% or 50% opacity for any text (too low contrast). Soft shadow colour = Forest at 18%.
Fonts: headings in Cormorant Garamond (Medium, slightly tight tracking, line-height about 1.08); body text and buttons in Inter. Italic Cormorant Garamond for the numbered steps.
Radii: banner and cards 40px; phone body 48px; phone screen 39px; buttons 16px.

STRUCTURE (Desktop, content column max width 1024, centred):
1. NAV BAR: left aligned. A 32 x 32 Forest circle containing a small white "calendar-check" line icon, then a vertical stack: "Calendar Scout" (Cormorant Garamond, 18, semibold) and under it "sendtoschedule.com" (Inter, 12, Olive). Padding 24.
2. HERO BANNER named "Hero banner": 1024 x 600, corner radius 40, clip content, 1px Sage border, fill Sage mist #F3F7F3 with a soft radial glow of Light sage at the top-left and a soft radial glow of Blush at the bottom-right, drop shadow (0, 25, 50, -12) Forest at 18%. Inside, two areas side by side:
   LEFT (vertical Auto Layout, vertically centred, 56px from the left edge, width 540, gap 0, with these children and spacing):
   - Headline, exactly: "Turn long newsletters into easy calendar events" (Cormorant Garamond Medium, 52/56, Forest, break the line after "newsletters"). Two lines.
   - 22px space, then the subhead, exactly: "Forward the one full of dates. Get back each event on its own card, with a one-tap Add to Calendar button." (Inter Regular, 20/30, colour #3E5A3E, max width 470)
   - 30px space, then a primary button named "CTA - scroll to forward-it card": Forest #2E4A2E fill, white Inter Semibold 18 text exactly "Try it with one newsletter" followed by a small white down-arrow icon, padding 18 x 28, radius 16, soft Forest shadow.
   - 14px space, then a small line (Inter, 14, Olive #556B55), exactly: "Free. No account. Opens a pre-filled Google Calendar event."
   RIGHT: a phone named "Before phone", 350 wide, rotated 3 degrees, starting about 34px from the top and 40px from the right edge, running OFF the bottom edge of the banner (clipped by the banner). Phone body: rounded rectangle, corner radius 48, near-black #1C1C1C, 9px bezel; screen: a rectangle named "Before phone - IMAGE FILL" with aspect ratio locked at 390:844, corner radius 39, filled with a flat Sage mist placeholder and a dashed Sage border. I will place my own image as the fill (scale mode Fill, aligned TOP). Do NOT generate any imagery or text on the screen. Add a layer mask or a gradient overlay so the bottom 35% of the phone fades into the banner background. Soft shadow (0, 30, 60, -15) Forest at 35%.
   OPTIONAL: a full-banner rectangle named "Backdrop image - OPTIONAL" at the very back, hidden by default, for a generated backdrop image.
3. "FORWARD IT" CARD named "Forward-it card" (vertical Auto Layout, 32px below the banner, max width 672, centred, padding 40, gap 16, background Sage mist, 1px Sage border, corner radius 40, soft shadow Forest at 5%): 
   - "1. Find an email in your inbox" (Cormorant Garamond Italic, 30, Forest at 90%)
   - "2. Forward it to:" (same style)
   - A primary button, Forest fill, white Inter Semibold 18 text "forward@sendtoschedule.com", padding 20 x 32, radius 16.
   - "3. Wait a few seconds for a reply" (same style)
   - "That's it!" (Cormorant Garamond Italic, 30, Olive #556B55, bold)

MOBILE (390 wide, 16px side padding around a banner 358 wide): the banner becomes a vertical Auto Layout, corner radius 32, padding 34 22 0 22, stacking: headline (Cormorant Garamond Medium 36/40, same words, no forced line break, left aligned), subhead (Inter 18/27, same words), the button full width (Inter Semibold 17, padding 17 x 20), the small Olive line centred, then the phone: 262 wide, rotated 3 degrees, centred, 30px above it, showing only its top 300px (clipped), with the bottom 45% fading into the banner background, no drop shadow. Then the Forward-it card below, 32px gap, padding 24, steps at 24px, button full width at 16px text.

OPTIONAL SECOND DESKTOP FRAME ("Variant B"): same nav; a heading row with the same headline, subhead and button on the left (headline 68/72) and a 260 x 260 mascot frame named "Mascot" on the right (placeholder fill); below it a 1024 x 620 frame named "Before image - IMAGE FILL" with corner radius 24, a thin grey title bar with three grey dots on top, a fill placeholder, a white-to-transparent fade over the last 150px, and a large soft shadow; then the Forward-it card.

STYLE: warm, calm, generous whitespace, no stock photography, no gradients on buttons, no extra icons, no extra text beyond what is listed. Keep all copy EXACTLY as written above. Name every layer.
```

**A good result looks like:** two frames with auto layout; the banner with the exact words above, the phone on the right with an empty fill ready for your PNG, and the card below. Check the headline reads exactly "Turn long newsletters into easy calendar events".
**Iteration tips:**
- If it invents extra copy: "Remove all text that is not listed in the brief."
- If it paints a fake screenshot into the phone: delete it and apply your PNG as an image fill (scale mode Fill, aligned top).
- If fonts fall back, set Cormorant Garamond and Inter manually.
- If text looks grey: check it uses #3E5A3E or Olive, not Forest at reduced opacity.
- To fade the phone: add a rectangle on top with a vertical gradient from the banner colour at 0% opacity to 100% opacity, or use a layer mask.

---

### If AI Studio garbles the screen text (all of P7 to P9)

Do not argue with it for ten rounds. Switch to the compositing method from **P2 in the earlier
document** (`2026-10-15-homepage-hero-mockup-prompts.md`, section C): generate the scene with a flat
magenta (#FF00FF) phone screen and the same empty-left-side composition, then lay the real PNG over
the magenta in Figma or Canva (step-by-step is in P2). The product text is then guaranteed correct
because the AI never touched it. And there is an even simpler no-AI fallback that already exists:
the **live preview in section 6 is exactly this picture built from real parts**. A CSS phone frame
around `hero-phone-before-dense@3x.png`, a soft shadow, a 3-degree tilt and a fade. It can be used
as is, or exported from the browser as a PNG.

---

## 5. Placement and export notes (short)

- **Export:** the phone art over a plain backdrop as WebP at about quality 80, under 250 KB; keep a PNG backup. 2048 x 1152 for a baked image; if the phone is composed live in CSS (as in the preview), the only file is the 1170 x 2532 phone PNG, which is about 520 KB and should be re-compressed to WebP (about 150 to 200 KB).
- **Do not bake the headline, subhead, button or trust line into any image.** Live text only (principle 1).
- **QA for every generated image** (the earlier doc's section F still applies; here are the extras):
  1. The left 40 to 45% is truly empty (no props, no shadow, no texture).
  2. The screen text matches the attachment word for word at 200% zoom. The dates "Thursday, Oct 22", "Friday, Oct 30", "Tuesday, Nov 10", "Wednesday, Nov 18" are present and **not highlighted**.
  3. No added words, labels or arrows anywhere.
  4. No real brand logos or real app interfaces.
  5. Nothing suggests automatic adding, syncing, an app, a dashboard, photos or PDFs.
  6. At 342 px wide (mobile) the phone is still the obvious subject and the page still reads as "a lot of text".

---

## 6. The real, no-AI preview (what it looks like, and how it differs from the real page)

Made so Ian can see the recommended copy and the before picture working together *without*
any AI. All files are in `projects/calendar-scout/marketing/hero/preview/`. Open either HTML file in
Chrome (they use the site's real colours, radii, shadows and fonts; the fonts load from Google Fonts and fall
back to Georgia or the system font offline). Images are in `preview/assets/`, so each page is
self-contained. The PNGs below were rendered with the Chrome already on the Mac (headless), and I
looked at each one and fixed what was off.

| File | Pixels | What it is |
|---|---|---|
| `hero-A-text-left-phone-right.html` | (open in a browser) | Variant A, responsive (switches layout at 700 px) |
| `hero-A-desktop-1440.png` | 1440 x 1010 | Variant A at desktop |
| `hero-A-mobile-390@2x.png` | 780 x 1760 (390 x 880 at 2x) | Variant A at mobile |
| `hero-B-text-above-wide-image-below.html` | (open in a browser) | Variant B, responsive |
| `hero-B-desktop-1440.png` | 1440 x 1250 | Variant B at desktop |
| `hero-B-mobile-390@2x.png` | 780 x 2080 (390 x 1040 at 2x) | Variant B at mobile |

**Variant A (text left, phone right).** One soft sage-and-blush banner. On the left, the headline on two lines, the subhead on three, a
dark green "Try it with one newsletter" button and the small "Free. No account..." line. On the right, a tilted phone showing the dense
newsletter, running off the bottom and fading out. On mobile: text first, the button full width, then the phone peeking up from the bottom of the banner.

**Variant B (text above, wide image below).** The page's existing structure: headline left and the scout-kid mascot right, then subhead and button, then the
wide dense newsletter in a laptop-style window frame with a fade at the bottom, then the "forward it" card. On mobile the mascot sits above the
headline (as on the live page) and the picture switches to the phone art, because the wide art would shrink to unreadable text.

**What I fixed after viewing the renders:**
- A desktop: the second headline line ran into the phone (the "s" touched the bezel). I narrowed the type to 52 px, moved the phone 10 px right and made the column wider, so there is now clear space between them.
- Mobile (both): the first mobile renders looked cut off on the right. That was my test setup, because Chrome's headless window has a minimum width, so I rendered the pages inside a 390 px wide frame and cropped. After that the layout was right.
- Mobile headline: it broke into four lines with "events" alone. I removed the forced line break on mobile and balanced the lines, and added the missing space that caused "newslettersinto" to run together for a moment.
- A mobile: a faint rectangle showed behind the phone (the soft shadow being clipped by the mask). I removed the shadow on mobile. I also reduced the picture's inner corner radius so the clock text is not clipped by the rounded corner.
- B: the mascot's off-white square showed on the white page, so I applied the same `brightness` and `contrast` filter the live page uses.
- The two crops: the first wide crop cut a line of text in half at the top and faded out before the Nov 10 date, so I shifted and enlarged it.

**How the preview differs from the real page:**
- The "forward it" card is a **short stub** (steps 1 and 2 and the email button), not the full card with step 3, "That's it!" and the Add to Contacts button.
- Variant A has **no mascot** (it would fight the phone and the headline); Variant B has it.
- There is no scroll, animation (the live page fades items in with a stagger), copy button, toast, PostHog tracking, or the sections below the hero.
- The CTA button is a plain link to `#forward-it`, which the stub card has; the real page does not have that id yet.
- The phone and window frames are drawn in HTML and CSS for the preview; on the real page they would be either the same CSS or a generated image.
- Navigation shows only the logo and domain, as the live page does.

**Which variant I would pick: A.** Reasons: the tall phone is the better shape for "a wall of text that goes on forever", because it can run off the bottom and fade; the headline gets a calm panel of its own with room to breathe; it reads at a glance on desktop and on mobile, and the mobile layout is a natural vertical stack. Variant B is the safest drop-in: it changes the least code (it keeps the heading row and the mascot, replacing only the image), but the wide crop is the most readable of all the pictures, which makes it feel like a document rather than a heap, and it cannot be reused on mobile. If Ian wants the smallest first step, ship B; if he wants the stronger hero, ship A.

---

## 7. How this was made (for the record)

- The dense crops come from `marketing/hero/source/make-dense-crops.py`, which crops the already-rendered 1:1 newsletter PNGs (`hero-newsletter-before.png`, `hero-newsletter-before-desktop@2x.png`) and the real phone header from `phone-before-1x@3x.png`, adding only a white bottom fade. Run from `marketing/hero/` with `python3 source/make-dense-crops.py` (needs Pillow, already installed).
- The preview pages are hand-written static HTML with inline CSS. The PNGs were taken with headless Chrome (`--headless=new`, screenshot to a PNG); the mobile ones are screenshots of a 390 px wide frame, then cropped.
- Contrast ratios were computed with the WCAG 2.x relative-luminance formula in Python; partial-opacity colours were mixed over the background first.
- Nothing in the live landing page source was changed.
