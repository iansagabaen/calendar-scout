---
name: Homepage hero mockup - Nano Banana + Figma prompt pack (2026-10-15)
description: Real, pixel-accurate "before" newsletter and "after" Scout Report screenshots (rendered from the product's own email template), plus six copy-paste Nano Banana prompts (P1-P6) and three Figma AI prompts (F1-F3) for putting them in the Calendar Scout homepage hero without garbled text or invented features.
type: marketing
---

# Calendar Scout homepage hero: mockup prompt pack

**Goal.** Put an actual picture of the product working into the homepage hero, so a busy
parent understands in two seconds what Calendar Scout does: a long school newsletter goes in,
a clean list of event cards with "Add to Calendar" buttons comes back.

**The one big idea.** Image-generating AI is good at *scenes* (a hand, a phone, soft light)
and bad at *small text* (event titles, dates, button labels come out as scrambled
look-alike letters). So we do not ask the AI to invent the product screen. We made the real
screen ourselves, from the product's own code, and the prompts below tell the AI to build the
world *around* it.

---

## 0. What exists now (files you can use today)

Everything lives in `projects/calendar-scout/marketing/hero/` (sources in `marketing/hero/source/`).
The size and flavor words in the file names mean this:

- **1x** = a faithful 1:1 render (same size the real email would be on a phone or in a window).
- **hero-** = the **hero-scaled** flavor. The UI is *deliberately scaled up about 1.4x* and simplified so it is readable at hero size (the hero image displays at about 342px wide on a phone, so
  tiny text would be mush). Same palette, same Georgia serif, same 16px card and 12px button corners, same real strings; only size and quantity change (descriptions dropped, footer cut, fades out softly at the bottom to say "there is more below").
- **bare** = just the email, no email-app frame around it. **phone / desktop** = the email shown inside a generic email-app frame.
- **@3x / @2x** = pixel density (3x or 2x the CSS size). PNGs with soft shadows or fades have a transparent background.

**The generic email-app container (unbranded on purpose).** Neutral greys and plain line glyphs only: no Gmail, Apple Mail or Outlook look-alike, no logos, no real brand colours.
- *Phone version:* a thin status strip (a clock, signal bars, a battery, all drawn as plain shapes), a back-arrow header with four plain glyphs (archive, trash, reply, forward), a big subject line, a round avatar with an initial, sender name and address, "to me", a timestamp, then the email.
- *Desktop version:* a window with a pale-grey title bar and three plain grey dots, a small toolbar (Reply, Forward, Archive, Delete) with simple glyphs, then the same subject/sender block and the email. Rounded corners and a soft shadow on the window version.
- *BEFORE container:* from "Maple Grove Elementary" `<newsletter@maplegrove-elementary.example>`, subject "Maple Grove Elementary: October Newsletter", Oct 15, 7:42 AM.
- *AFTER container:* from "Calendar Scout · report in ~1 min" `<scout@sendtoschedule.com>` (that display name and address are the real ones the product sends from), subject in the **real** format the code builds: `Scout Report: "Maple Grove Elementary: October Newsletter"`, Oct 15, 7:43 AM.
- *Why the BEFORE subject is not "Maple Grove Weekly Newsletter":* the Scout Report's subject quotes the forwarded email's subject, so for the story to be believable the two must match.

**Hero image slot ratio: 3:2** (the current art is 1200 x 790, 1.52:1). Two phone tiles are each 3:4 so that **side by side they make exactly 3:2**. The desktop windows are 3:2 each.

#### A. Bare artifacts (use as reference images for Nano Banana and Figma)

| File | Size (px) | What it is |
|---|---|---|
| `hero-newsletter-before.png` | 1170 x 7335 | BEFORE, whole newsletter at phone width, 1:1 |
| `hero-newsletter-before-phone-screen@3x.png` | 1170 x 2532 | BEFORE, first phone screen, 1:1 |
| `hero-newsletter-before-desktop@2x.png` | 1520 x 3580 | BEFORE, whole newsletter at desktop width, 1:1 |
| `hero-email-phone@3x.png` | 1170 x 4335 | AFTER, whole Scout Report at phone width, 1:1 |
| `hero-email-phone-screen@3x.png` | 1170 x 2532 | AFTER, first phone screen, 1:1 |
| `hero-email-desktop@2x.png` | 1520 x 2688 | AFTER, whole report at desktop width, 1:1 |
| `hero-email-laptop-screen@2x.png` | 1520 x 950 | AFTER, 16:10 crop of the desktop render, 1:1 |
| `hero-bare-before-tile@3x.png` | 1170 x 1560 | BEFORE, hero-scaled, 3:4, fades out |
| `hero-bare-after-tile@3x.png` | 1170 x 1560 | AFTER, hero-scaled, 3:4, fades out |
| `hero-bare-before-wide@3x.png` | 2340 x 1560 | BEFORE, hero-scaled, 3:2, fades out |
| `hero-bare-after-wide@3x.png` | 2340 x 1560 | AFTER, hero-scaled, 3:2, fades out |

#### B. Inside the generic email-app container

| File | Size (px) | What it is |
|---|---|---|
| `phone-before-1x@3x.png` | 1170 x 2532 | BEFORE in the phone frame, 1:1, opaque phone-screen shape (390:844) |
| `phone-after-1x@3x.png` | 1170 x 2532 | AFTER in the phone frame, 1:1 |
| `desktop-before-1x@2x.png` | 2080 x 1360 | BEFORE in the desktop window, 1:1, soft shadow, transparent surround |
| `desktop-after-1x@2x.png` | 2080 x 1360 | AFTER in the desktop window, 1:1 |
| `hero-phone-before-screen@3x.png` | 1170 x 2532 | BEFORE, hero-scaled, phone frame, full phone-screen shape (390:844), opaque, white fade at bottom |
| `hero-phone-after-screen@3x.png` | 1170 x 2532 | AFTER, hero-scaled, same |
| `hero-phone-before-tile@3x.png` | 1170 x 1560 | BEFORE, hero-scaled phone, 3:4 tile (rounded top, fades out), transparent |
| `hero-phone-after-tile@3x.png` | 1170 x 1560 | AFTER, hero-scaled phone, 3:4 tile |
| `hero-desktop-before-window@3x.png` | 2340 x 1560 | BEFORE, hero-scaled desktop window, 3:2, rounded + soft shadow + fade, transparent |
| `hero-desktop-after-window@3x.png` | 2340 x 1560 | AFTER, same |
| `hero-desktop-before-screen@3x.png` | 2400 x 1500 | BEFORE, hero-scaled desktop, edge-to-edge 16:10 rectangle, opaque (for a laptop screen) |
| `hero-desktop-after-screen@3x.png` | 2400 x 1500 | AFTER, same |

#### C. Other

| File | Size (px) | What it is |
|---|---|---|
| `scout-mascot-reference.png` | 1200 x 1200 | the existing scout-kid mascot as a PNG (style reference only) |

**Sources (so anything can be re-made or edited):** `worker/scripts/render-hero-email.ts` (the "after" report, via the real `buildReportEmail`), `worker/scripts/render-hero-containers.ts` (builds every framed and hero-scaled page), `marketing/hero/hero-email-render.html`, `hero-email-render-desktop.html`, `hero-newsletter-before.html`, and `marketing/hero/source/*.html` + `source/rasterize.sh` (turns the HTML into the PNGs with the Chrome already on your Mac). All school, person and address names are invented. The 1:1 newsletter's footer says it is a fictional sample; crop that line out if you ever use the full-length image publicly.

Every PNG above was opened and checked after rendering: legible, uncropped (apart from the deliberate bottom fades), correct text. Two bugs were caught that way and fixed (a wrapping sender address, and a template mistake that printed code text in the phone header).

### Which file to attach to which prompt

| Prompt | Attach | Why |
|---|---|---|
| **P1** hand holding phone | `hero-phone-after-screen@3x.png` | hero-scaled, already phone-screen shaped, and includes the generic email-app header so it reads as "an email" instantly |
| **P2** blank-screen scene (then composite) | nothing to the AI. Composite later with `hero-phone-after-screen@3x.png` (or `hero-phone-before-screen@3x.png`) | the real screen goes on after |
| **P3** from scratch | nothing | no reference |
| **P4** before -> after | `hero-phone-before-screen@3x.png` then `hero-phone-after-screen@3x.png` (optional third: `hero-newsletter-before.png`) | both hero-scaled, so both are readable on the two phones |
| **P5** laptop | `hero-desktop-after-screen@3x.png` | edge-to-edge 16:10, includes generic window title bar and toolbar |
| **P6** text-free backdrop | optional: `scout-mascot-reference.png` and `landing/public/images/hero-graphic.png` | style and colour only |
| **F1** hero section (Figma) | place afterwards: `hero-phone-before-tile@3x.png` + `hero-phone-after-tile@3x.png` side by side (a ready-made 3:2) or your finished Nano Banana image; `scout-mascot-reference.png` | the image slot |
| **F2** phone component | place afterwards: `hero-phone-after-screen@3x.png` (and `hero-phone-before-screen@3x.png`) as the image fill | same 390:844 shape as the component's screen |
| **F3** before -> after | place afterwards: `hero-phone-before-screen@3x.png` and `hero-phone-after-screen@3x.png` (or the two `-tile` files); optional long scroll: `hero-newsletter-before.png` | matched pair |

**A no-AI shortcut that already works:** put `hero-phone-before-tile@3x.png` and `hero-phone-after-tile@3x.png` next to each other in Figma or Canva. Together they are exactly 3:2, have rounded tops and fade out at the bottom, and have a transparent background, so they can sit on the P6 backdrop or on a flat blush/sage fill straight away. Add an arrow and two short captions (see F3) and you have a believable before -> after hero with zero image-model risk.

**An honest note about "3 cards".** At roughly 1.4x scale, a 3:4 phone tile or a 3:2 window has room for the summary line and **one full card plus the top of a second card that fades out**, not three full cards. That is the price of big, readable type in a small slot. The summary line ("Found 4 events about ...") carries the "there are several" message. If you want three full cards in one image, use the 1:1 flavor in a taller crop, not the hero-scaled one.

### The facts match line by line

The four events in the Scout Report are exactly the four events buried in the newsletter.
The newsletter writes dates the way a human would ("next Thursday, Oct 22"); the Scout
Report uses the product's own format ("Thursday, Oct 22, 2026").

| Event | Newsletter says (buried in a paragraph) | Scout Report card says |
|---|---|---|
| Fall Picture Day | "Picture day is next Thursday, Oct 22 ... in the gym from 8:30am to 11:30am. Individual portraits will be taken by grade, and order forms will go home with students the week before." | Fall Picture Day / Thursday, Oct 22, 2026 · 8:30am-11:30am / at Maple Grove Elementary Gym / "Individual portraits by grade. Order forms go home the week before." |
| Harvest Carnival | "Harvest Carnival on Friday, Oct 30, from 5:30pm to 8:00pm on the playground. There will be games, a cake walk and a chili supper, and costumes are welcome" | Harvest Carnival / Friday, Oct 30, 2026 · 5:30pm-8:00pm / at Maple Grove Elementary Playground / "Games, a cake walk, and a chili supper. Costumes welcome." |
| Parent-Teacher Conferences | "on Tuesday, Nov 10, from 3:00pm to 7:00pm in your child's classroom. Conferences are fifteen minutes long" | Parent-Teacher Conferences / Tuesday, Nov 10, 2026 · 3:00pm-7:00pm / at Maple Grove Elementary Classrooms / "Fifteen-minute slots with your child's teacher." |
| Early Release Day | "on Wednesday, Nov 18, we will have an early release day so that teachers can plan together, and students will be dismissed at 12:30pm" | Early Release Day / Wednesday, Nov 18, 2026 · 12:30pm / at Maple Grove Elementary / "Students are dismissed at 12:30pm for teacher planning." |

**Hero-scaled pair, re-checked.** The hero-scaled files show only a subset, and it still matches line by line. The BEFORE newsletter excerpt keeps two buried passages word for word: "Picture day is next Thursday, Oct 22, and will take place in the gym from 8:30am to 11:30am" and "the Harvest Carnival on Friday, Oct 30, from 5:30pm to 8:00pm on the playground". The AFTER report shows the cards for exactly those two events: Fall Picture Day, Thursday, Oct 22, 2026 · 8:30am-11:30am, at Maple Grove Elementary Gym; Harvest Carnival, Friday, Oct 30, 2026 · 5:30pm-8:00pm, at Maple Grove Elementary Playground; and the summary line still says "Found 4 events about Fall Picture Day, Harvest Carnival, Parent-Teacher Conferences, and more" (all four events exist in the full newsletter). The hero-scaled newsletter is an abridged excerpt: sections are trimmed and re-ordered so the dates are visible without highlighting, and every sentence in it is copied from the full 1:1 newsletter.

Weekdays are correct for 2026 (Oct 22 is a Thursday, Oct 30 a Friday, Nov 10 a Tuesday,
Nov 18 a Wednesday). The newsletter has no other dates, weekdays or clock times, so the
Scout would find exactly these four events and no others. The only loose time phrase is
"by the end of the month" in the lost-and-found bullet; it has no real date, so it
would not become an event. The newsletter also carries plenty of noise (principal's note,
what the grades are learning, odds-and-ends bullets, lunch menu, a PTA fundraiser ask,
lost and found, reading tips, a sign-off).

---

## A. The short answer

**Use the real screenshot. Let the AI build the scene around it.** In order of preference:

1. **RECOMMENDED: give Nano Banana the real screenshot as a reference image** (prompts P1, P4,
   P5). You attach the PNG, and the prompt says "this exact image is the phone's screen;
   do not redraw it." Fastest path to a good-looking, believable photo. Risk: the model may
   still slightly re-draw small text. You check this in the QA list (section F). If it does,
   move to approach 2.
2. **Safest: generate the scene with a BLANK screen, then paste the real screenshot on
   top** (P2). Slightly more work in Canva/Figma/Keynote, but the product text is guaranteed
   perfect because the AI never touched it.
3. **Riskiest: let the AI draw the whole screen from scratch** (P3). Only use this when
   you want a quick sketch, and keep the on-screen text to a handful of big words.

**Where Figma fits.** Nano Banana makes a *photo-like picture* (flat image, not editable).
Figma AI makes an *editable layout* (real text, real buttons, real spacing) where the real
screenshot stays pixel-exact. Use Nano Banana for the mood and the hand-held-phone
"wow"; use Figma to build the clean, on-brand hero section or the before -> after diagram
around the real screenshots. Details in section G.

**An important thing I found.** The homepage already has a hero image, `landing/public/images/hero-graphic.png`
(1200 x 790): a before -> forward -> after collage on a peach, terracotta and sage background. Its "Scout
Report" is a hand-made stand-in that does *not* look like the real email (grey Gmail-style cards,
a bright green button, sans-serif type). The real email uses deep forest green buttons and
Georgia serif type. So a real-render screenshot is a genuine upgrade in honesty: what visitors see
is what lands in their inbox.

---

## B. Prompt anatomy, explained

A good image prompt is a short brief to a photographer. Each part below does a different job;
if a result looks wrong, you can usually fix it by changing just one part.

1. **Subject.** What is in the picture. "A parent's hand holding a plain smartphone."
   Be concrete about the one thing that matters, and say what is NOT there.
2. **Composition and framing.** Where things sit, how much empty space. For a hero, ask for
   calm empty space on one side and the phone large and sharp. Name the shape ("wide
   landscape, 3:2").
3. **Camera and lighting.** "Soft morning window light, shallow depth of field, shot at eye level
   like a lifestyle photo." This is what makes it feel warm instead of stocky.
4. **Palette with hex codes.** Models understand colour names better than codes, but codes
   keep colours on-brand. Give both: "deep forest green (#2E4A2E)".
5. **Typography.** Only needed when text is on a surface the AI draws. Say "elegant
   serif, like Georgia". When using the real screenshot, say "do not change any type".
6. **Exact on-screen text.** Put every word you want rendered in quotes, and say "no other
   text". The fewer words, the fewer mistakes.
7. **Aspect ratio and size.** Say it in words ("3:2 landscape") AND set the aspect-ratio
   control if the app has one. Ask for high resolution (2K) if offered.
8. **Negative constraints.** A "do NOT" list works better than hoping. Our standard guard:
   no real brand logos or app interfaces (no Gmail, Apple, Google), no watermark, no extra UI,
   no gibberish text.

**How to iterate (the habit that saves the most time):**
- Change **one thing** per round ("make the light warmer", "move the phone left").
- When you get a result you like, **keep it and ask for an edit** ("same image, but remove the
  second coffee cup") rather than regenerating from scratch. Re-rolling throws away what was
  already good.
- If the text on the screen is wrong, do not argue with the model for ten rounds. Switch to
  prompt P2 (blank screen) and paste the real screenshot in yourself.
- Save every keeper with a note of which prompt made it.

**Colours used in every prompt (pulled from the real site and email):**

| Name | Hex | Where it comes from |
|---|---|---|
| Forest green | `#2E4A2E` | site headings/buttons, email "Add to Calendar" button |
| Olive | `#556B55` | site secondary text and hover |
| Sage mist | `#F3F7F3` | site card background, email outer shell |
| Soft sage border | `#E0E7E0` | site and email card borders |
| White | `#FFFFFF` | page, email cards |
| Warm blush | `#FDE3D8` / `#FCDDCB` | existing hero art background |
| Light sage | `#D5E3DB` / `#C8D5C6` | existing hero art background |
| Terracotta accent | `#9B3B22` | existing hero art badges (use sparingly) |
| Amber (warnings only) | `#92600A` / `#FFFBF0` / `#F5C542` | email "review first" cards. Not used in the clean hero render |

Type: the **email** is set in **Georgia** (serif). The **homepage** headings are **Cormorant
Garamond** (an elegant serif) with **Inter** for body text and buttons. Both are serif/humanist, so
"warm elegant serif" is the right vibe for any text the AI draws.

---

## C. The prompts (copy-paste ready): Nano Banana

**How to use any of these in Nano Banana:** open it in Gemini or Google AI Studio, attach the
reference file(s) named under "Attach" *first*, paste the whole prompt, set the aspect ratio
to **3:2** if the app has the control, and ask for one image. If you are using the "Pro"
version, choose a higher resolution if offered; it also tends to render text better, but do
not rely on that.

**The hero slot (from the real homepage code):** the image sits full width inside a
1024px column (below the headline and mascot, above the "1. Find an email..." card), in a box
with `rounded-3xl` (24px corners), `shadow-2xl`, `w-full h-auto`. The current art is 1200 x 790,
about **3:2** (1.52:1). All landscape prompts below use **3:2**. On a 390px phone the image shows
only about 342px wide, so the phone in the picture must be big and the layout simple.

### P1. Phone in a hand, screen shows the REAL Scout Report (recommended)

- **Purpose:** the main hero image. A warm lifestyle photo whose phone screen is your real
  screenshot.
- **Aspect ratio / size:** 3:2 landscape, 2K (about 2048 x 1365). Final export 2048 x 1348 (see D).
- **Attach:** `marketing/hero/hero-phone-after-screen@3x.png` (1170 x 2532, the **hero-scaled** Scout Report inside a generic, unbranded email-app frame: status strip, back-arrow header, subject, sender, then the real report). The UI is deliberately scaled up about 1.4x so it stays readable at hero size. Attach nothing else.

```
Use the attached image as the exact content of the phone's screen. It is a screenshot of an email inside a plain, generic email app (a thin status strip with a clock, a header with a back arrow and four small icons, a bold subject line, a sender row, then a pale-green email with event cards). It must be reproduced pixel-for-pixel, including that generic header: do not redraw it, re-type it, rephrase it, re-colour it, translate it, shorten it, or add any extra text, icons, status bar, clock, notification or overlay beyond what is already in the attached image. Treat the screen as a placed photograph. The text in it is intentionally large and the bottom softly fades to white; keep both exactly.

Create a photorealistic, warm lifestyle photograph, wide landscape 3:2. A parent's hand (natural adult hand, five fingers, relaxed grip, no rings, neutral nails) holds a plain modern smartphone in portrait orientation, slightly right of centre, large and sharp, filling about 70% of the image height. The phone is generic: slim dark bezels, no logo, no brand mark, no camera-bump branding. The screen faces the viewer almost straight on (only a very slight tilt, under 10 degrees) so every line of text on it is easy to read. The screen shows the attached image edge to edge, with the top of the email at the top of the screen.

Setting: a bright, tidy kitchen table in soft morning window light, softly blurred background (shallow depth of field). In the blurred background only: a ceramic mug, a child's lunchbox, a few unreadable paper flyers, a green plant. Leave calm, uncluttered space on the left third of the image.

Colour palette for the scene (keep it calm and warm): warm cream, soft blush (#FDE3D8), light sage (#D5E3DB), with tiny touches of deep forest green (#2E4A2E). A very small terracotta (#9B3B22) accent is allowed (for example the mug). The screen's own colours (forest green #2E4A2E buttons, sage #F3F7F3 background, white cards) must stay exactly as in the attached image.

Mood: calm, relieved, family-friendly, "one less thing to worry about". Photographic realism, natural skin tones, gentle shadows, no harsh glare on the screen.

Do NOT: change, blur, crop or recolour the screen content; add any extra text or captions anywhere in the image; add any real brand logos or real app interfaces (no Gmail, Apple Mail, Google or Outlook look-alikes, and no extra status bar or notification banners on top of the attached screen); add watermarks; add extra UI elements or floating icons; invent gibberish text on flyers or signs (make background paper blurry and unreadable); show faces; distort the hand (no extra, fused or missing fingers).
```

**Do NOT list (short):** don't let it redraw the screen; no logos; no faces; no extra text.
**A good result looks like:** a calm kitchen photo, a convincing hand, and a phone screen you can read
with every line matching your attached screenshot, including "Fall Picture Day", "Thursday, Oct 22, 2026
· 8:30am-11:30am", and the dark green "Add to Calendar" buttons.
**Iteration tips:**
- *Screen text slightly different or garbled:* reply "Keep everything, but replace the phone screen with the attached
  image again, exactly, and do not alter its text." If it still drifts after two tries, switch to P2.
- *Wrong palette (too orange or too blue):* "Same image, shift the scene to warm cream, blush and sage. Do not change the screen."
- *Extra logos, a second status bar or notifications on the screen:* "Same image, remove anything on the screen that is not in the attached image; the screen shows only the attached image, with its own plain header."
- *Distorted hand:* "Same image, fix the hand so it has exactly five natural fingers and a relaxed grip." If still bad, ask for the phone resting on the table instead (see P2 wording).
- *Phone too small:* "Same image, make the phone 20% larger."

---

### P2. Same scene with a flat, empty screen (for pasting the real screenshot on top)

- **Purpose:** guaranteed-perfect screen text. The AI makes the photo with a screen of one flat colour; you
  then place the real screenshot over that colour.
- **Why magenta, not green:** the site is green, so a green "key" colour would bleed into the scene. Pure
  magenta (#FF00FF) does not appear anywhere in the brand palette, so it is easy to select and cannot be mistaken for scenery.
- **Aspect ratio / size:** 3:2 landscape, 2K.
- **Attach:** nothing. (Keep `hero-phone-after-screen@3x.png`, the hero-scaled Scout Report inside the generic email-app frame, handy for the compositing step. Use `hero-phone-before-screen@3x.png` if you want the newsletter on the phone instead. Both are exactly the phone-screen shape, 390:844.)

```
Create a photorealistic, warm lifestyle photograph, wide landscape 3:2. A plain modern smartphone in portrait orientation stands propped upright on a bright, tidy kitchen table (no hand holding it), slightly right of centre, large and sharp, filling about 70% of the image height. The phone is generic: slim dark bezels, no logo, no brand mark.

IMPORTANT, the phone is photographed perfectly head-on: the camera looks straight at the screen, with no tilt and no perspective, so the screen is a clean upright rectangle with softly rounded corners.

The phone's screen is a completely flat, uniform, solid magenta colour (#FF00FF), edge to edge, with absolutely NO content: no text, no icons, no status bar, no wallpaper, no notch cut-out, no gradient, no reflections, no glare, no shadows or highlights falling on the screen. It must read as a plain solid magenta rectangle.

Setting: soft morning window light, softly blurred background (shallow depth of field). In the blurred background only: a ceramic mug, a child's lunchbox, a few unreadable paper flyers, a green plant. Leave calm, uncluttered space on the left third of the image.

Colour palette for the scene: warm cream, soft blush (#FDE3D8), light sage (#D5E3DB), tiny touches of deep forest green (#2E4A2E), with at most one small terracotta (#9B3B22) accent. Do not use magenta or pink anywhere except the phone screen.

Mood: calm, relieved, family-friendly. Photographic realism, gentle shadows.

Do NOT: put any content, text or glare on the screen; use magenta anywhere except the screen; add real brand logos or app interfaces (no Gmail, Apple, Google); add watermarks; add extra UI elements; add any text anywhere in the image; invent gibberish text on flyers (keep them blurry and unreadable); show faces.
```

**A good result looks like:** a straight-on phone with a perfectly flat magenta rectangle for a screen and no
reflections across it.
**Iteration tips:**
- *Screen has glare or a gradient:* "Same image, make the screen one flat magenta (#FF00FF) with no reflection or light falling on it."
- *Phone is tilted:* "Same image, rotate the phone so it faces the camera exactly straight on."
- *Pink bleeding onto the table or phone edge:* "Same image, keep magenta only on the screen."
- *Prefer a hand holding it:* use P1's hand sentence, but you accept a slightly harder compositing step because fingers can overlap the screen edge.

**Compositing steps (pick the tool you already know; I have not run these in your tools, so treat the menu names as a guide):**

*Easiest, in Canva or Figma (recommended, and you will use Figma anyway):*
1. Open a new design at 2048 x 1348 (3:2). Drag in the P2 image and make it fill the page.
2. Drag in `hero-phone-after-screen@3x.png` (the real, hero-scaled screenshot inside the generic email-app frame). Resize it so it covers the magenta rectangle exactly; drag the corners until its edges line up with the screen edges. Temporarily set its opacity to about 50% to line it up, then back to 100%.
3. Round the screenshot's corners to match the phone screen (Canva: "Corner rounding"; Figma: set Corner radius, start around 40 and adjust until no magenta peeks out at the corners).
4. If a sliver of magenta still shows at an edge, make the screenshot 1-2% larger, then crop the overflow with a mask or frame the size of the screen.
5. Zoom to 200% and check the corners and edges, then export as PNG, then follow the export notes in section D.

*Alternative, with Mac's built-in Preview + Keynote:*
1. In Preview, open the P2 image, choose Markup -> Instant Alpha, click the magenta, and drag until the whole screen is selected, then delete it. Save as PNG (the screen is now see-through).
2. In Keynote, put the real screenshot on a slide, then place the see-through PNG on top and size the screenshot underneath so it shows through the screen hole.
3. Export the slide as an image at the largest size.

*Check afterwards:* nothing magenta is visible anywhere; the screenshot is not stretched (its proportions match the original 1170 x 2532).

---

### P3. Fully from-scratch mockup with exact text (fallback, no reference image)

- **Purpose:** only if you want no reference image, or want a quick rough comp. Text is kept to **16 words**,
  big and high-contrast, because that is the most a model can reliably spell.
- **Aspect ratio / size:** 3:2 landscape, 2K.
- **Attach:** nothing.

```
Create a clean, photorealistic product mockup, wide landscape 3:2. A plain modern smartphone (no logo, no brand mark, slim dark bezels) is held upright in a natural adult hand, slightly right of centre, large and sharp, filling about 70% of the image height, screen facing the camera almost straight on. Soft morning light, softly blurred warm kitchen background, calm empty space on the left third.

The phone's screen shows an email on a very pale sage background (#F3F7F3), with rounded corners. Inside it are exactly three stacked white cards (with a thin pale sage border #E0E7E0 and generously rounded corners, 16px style). Each card has a bold serif title in near-black (like Georgia Bold), and under it a full-width rounded dark forest green (#2E4A2E) button with bold white serif text.

The ONLY text anywhere on the screen, in this order, is exactly:
Card 1 title: "Fall Picture Day"  / button: "Add to Calendar"
Card 2 title: "Harvest Carnival"  / button: "Add to Calendar"
Card 3 title: "Parent-Teacher Conferences"  / button: "Add to Calendar"
Under each title, instead of any date or description text, draw one thin, soft grey-green rounded line (a plain bar with no letters in it).
That is 16 words in total. Spell every word exactly as written. Use no other words, numbers, letters or symbols anywhere in the image.

Palette: deep forest green #2E4A2E, sage mist #F3F7F3, soft sage border #E0E7E0, white #FFFFFF; scene tones warm cream and blush (#FDE3D8). Elegant serif typography (Georgia-like), calm, warm, parent-friendly.

Do NOT: invent any other text, dates, times, names or numbers; add real brand logos or app interfaces (no Gmail, Apple, Google, no status bar, no notification banners); add watermarks; add extra UI elements (no tabs, search bars, avatars, icons); show faces; distort the hand (five natural fingers).
```

**A good result looks like:** three cards, three exactly-spelled titles, three identical green buttons, no other lettering.
**Iteration tips:**
- *A title is misspelled:* "Same image. Fix only the title on card 2 to read exactly: Harvest Carnival." Fix one word per round.
- *It added extra small text:* "Same image, remove every piece of small text; the only words allowed are the three titles and the three 'Add to Calendar' buttons."
- *Cards look generic or wrong shade of green:* "Same image, make the buttons deep forest green #2E4A2E."
- *Still garbled after two fixes:* stop and use P1 or P2. This is the approach most likely to go wrong, and it is why it ranks third.
- *Want dates visible:* add them back one at a time, using the product's format: "Thursday, Oct 22, 2026 · 8:30am-11:30am". Every extra word raises the risk.

---

### P4. Before -> after: messy newsletter on the left, clean Scout Report on the right

- **Purpose:** show the transformation in one picture. Because both screens are real pixels, the story is
  literally true: the Scout Report cards are what that newsletter's text produces.
- **Aspect ratio / size:** 3:2 landscape, 2K.
- **Attach (in this order):**
  1. `marketing/hero/hero-phone-before-screen@3x.png` (1170 x 2532, "BEFORE": the fictional newsletter, hero-scaled, inside a generic email-app frame from "Maple Grove Elementary")
  2. `marketing/hero/hero-phone-after-screen@3x.png` (1170 x 2532, "AFTER": the real Scout Report, hero-scaled, inside a generic email-app frame from "Calendar Scout")
  Both are deliberately scaled up about 1.4x for legibility at hero size, and the two buried dates in the newsletter (Oct 22 and Oct 30) match the first two cards in the report.
  3. *(optional)* `marketing/hero/hero-newsletter-before.png` (the whole long newsletter), only if you want the "long scroll" effect described in the iteration tips.

```
I am attaching two screenshots. Each is a screenshot of an email inside a plain, generic email app (status strip, back-arrow header, subject line, sender row). Image 1 is a dense school newsletter email (navy header banner, big blocks of paragraph text). Image 2 is a clean "Scout Report" email with white event cards and dark green buttons. Use image 1 as the exact content of the LEFT phone's screen and image 2 as the exact content of the RIGHT phone's screen. Reproduce each screen pixel-for-pixel, edge to edge, top of the email at the top of the screen: do not redraw, re-type, rephrase, re-colour or crop them, and do not add any text, icons, extra status bar or overlay to either screen beyond what is already in the attached images.

Create a wide landscape 3:2 image with a clean before-and-after composition: two identical generic smartphones (slim dark bezels, no logo, no brand mark), standing upright side by side, both facing the camera straight on, each large and sharp, with a comfortable gap between them. The left phone (newsletter) is placed slightly lower and a touch smaller, looking busy and heavy. The right phone (Scout Report) is placed slightly higher and a touch larger, looking calm and light.

Between the phones, a single soft, hand-drawn style curved arrow in deep forest green (#2E4A2E) pointing from the left phone to the right phone. The arrow contains no text.

Background: a soft, calm, abstract backdrop of gentle overlapping organic shapes in warm blush (#FDE3D8 and #FCDDCB) fading into light sage (#D5E3DB and #C8D5C6), with a tiny amount of terracotta (#9B3B22) accent at most. Studio-soft lighting, a soft shadow under each phone. The left side of the backdrop can be a touch warmer and the right side a touch cooler and greener to suggest "tangled -> clear".

Mood: calm, relieved, friendly, parent-focused.

Do NOT: change anything on either screen; add any text, captions, labels like "before" or "after", numbers or words anywhere in the image (labels will be added later in a design tool); add real brand logos or real app interfaces (no Gmail, Apple Mail, Google or Outlook look-alikes); add watermarks; add extra UI elements or floating icons; show faces or hands; invent gibberish text.
```

**A good result looks like:** two sharp phones, the left one showing a navy-bannered wall of text, the right
one showing the pale-green cards with green buttons, a simple arrow between them, no words added.
**If you only built the "after" image:** do the same with just image 2 on the right phone, and leave the left phone
as a **blank screen** (flat magenta, as in P2) so you can paste a screenshot of a real newsletter there later.
**Iteration tips:**
- *The model blends the two screenshots or swaps them:* "Keep everything, but the LEFT phone must show image 1 (navy header, long paragraphs) and the RIGHT phone image 2 (white cards, green buttons)."
- *It adds "Before"/"After" words:* "Same image, remove all text outside the phone screens." Add labels yourself in Figma or Canva with a real font (see F3).
- *Text on either screen looks different from the attachment:* use P2's blank-screen approach twice (left and right) and composite both screenshots.
- *Want the "overwhelming length" feeling:* attach image 3 and add: "Behind the left phone, show a tall, faded, paper-white strip (image 3) running off the top and bottom edges, to suggest a very long email." Check that its text is unreadable-in-the-background and not mistaken for the main screen.

---

### P5. Wide desktop / laptop variant

- **Purpose:** a laptop on a desk, screen showing the real report. Good for a wider "works on desktop too" look.
  Note: the real product is an *email*, so this shows the report email open on a laptop, which is true.
- **Aspect ratio / size:** 3:2 landscape, 2K (matches the hero slot at 1200 x 790).
- **Attach:** `marketing/hero/hero-desktop-after-screen@3x.png` (2400 x 1500, 16:10: the hero-scaled Scout Report inside a generic, unbranded desktop email window with a pale-grey title bar, three plain grey dots, a Reply / Forward / Archive / Delete toolbar, subject and sender row). UI deliberately scaled up about 1.4x for legibility.

```
Use the attached image as the exact content of the laptop's screen. It is a screenshot of an email inside a plain, generic email window (pale-grey title bar with three grey dots, a small Reply / Forward / Archive / Delete toolbar, a bold subject line, a sender row, then a pale-green email with an event card). It must be reproduced pixel-for-pixel, including that generic window bar: do not redraw it, re-type it, rephrase it, re-colour it, or add any extra text, icons, menu bar, dock, browser tabs, cursor or overlay to it. Treat the screen as a placed photograph, edge to edge, in its original 16:10 shape. The text is intentionally large and the bottom softly fades to white; keep both exactly.

Create a photorealistic, warm lifestyle photograph, wide landscape 3:2. A plain modern laptop (no logo, no brand mark, thin aluminium-look body in neutral silver, plain keyboard with no readable key legends) sits open on a bright, tidy wooden kitchen or home-office table. It is shown from the front, slightly right of centre, with the screen facing the camera almost straight on (only a very slight angle, under 10 degrees) so every line of text on the screen is easy to read. The screen fills about 60% of the image width.

Setting: soft morning window light, softly blurred background (shallow depth of field). In the blurred background only: a ceramic mug, a notebook, a green plant, a child's drawing with no readable words. Leave calm space on the left third of the image.

Colour palette for the scene: warm cream, soft blush (#FDE3D8), light sage (#D5E3DB), tiny touches of deep forest green (#2E4A2E), at most one small terracotta (#9B3B22) accent. The screen's own colours must stay exactly as in the attached image.

Mood: calm, relieved, family-friendly. Photographic realism, gentle shadows, no glare on the screen.

Do NOT: change, blur, crop or recolour the screen content; add any text anywhere else in the image; add real brand logos or real app interfaces (no Gmail, Apple Mail, Google, Outlook or Windows look-alikes, no browser tabs, no address bar, no menu bar or dock beyond the generic window in the attached image); add watermarks; add extra UI elements; invent gibberish text; show faces.
```

**A good result looks like:** the laptop's screen matches your attachment: the generic window bar and toolbar, the pale-sage shell, the white "Fall Picture Day" card and the dark green "Add to Calendar" button fading out at the bottom.
**Iteration tips:**
- *The model adds a browser window, menu bar or other email-app chrome of its own:* "Same image, remove everything on the screen that is not in the attached image; keep only its own plain window bar and toolbar."
- *Screen shape distorts (stretched):* "Keep the screen's original 16:10 shape; do not stretch the screenshot."
- *Laptop looks like a specific brand:* "Same image, make the laptop generic with no logo and no brand-specific design."
- *Screen content wrong:* fall back to P2 wording with a laptop and a flat magenta screen, then composite.

---

### P6. Text-free soft backdrop (to sit behind the product shot)

- **Purpose:** a background layer in the site's style, to put behind a phone cut-out in Figma or Canva, so
  the hero matches the rest of the page. **No text at all.**
- **Aspect ratio / size:** 3:2 landscape, 2K.
- **Attach (optional):** `marketing/hero/scout-mascot-reference.png`, only as a *style* reference for the friendly
  scout-kid look; also optionally `landing/public/images/hero-graphic.png` as a *colour and shape* reference.
  If you attach them, add the line shown at the bottom of the prompt.

```
Create a soft, text-free decorative backdrop illustration, wide landscape 3:2, designed to sit BEHIND a product screenshot. Calm, warm and friendly, in a gentle flat paper-cut and soft watercolour style with clean organic shapes and subtle paper grain.

Composition: large, softly overlapping organic shapes spanning the whole frame, in warm blush (#FDE3D8 and #FCDDCB) on the left blending into light sage (#D5E3DB and #C8D5C6) on the right, with a very small terracotta (#9B3B22) accent shape in one corner. Keep the centre and right-of-centre fairly open and low-contrast (a calm area about 45% of the image width) where a phone will be placed later.

Small, quiet decorative motifs spread around the edges, drawn in simple outlined style in deep forest green (#2E4A2E) at low opacity: a few calendar pages with no numbers, a small paper plane, a few maple and oak leaves, a pair of binoculars and a small pennant flag (a nod to a friendly "scout"). Keep all motifs small, evenly spaced, and away from the open centre. The calendar pages must be blank: no numbers, letters or symbols.

Mood: calm, relieved, warm, family-friendly, "everything is under control". Soft, even light, no hard shadows, no photographic elements.

Do NOT: include ANY text, numbers, letters, logos or symbols that look like writing; include people, faces or hands; include real brand logos or app interfaces (no Gmail, Apple, Google, no phone or laptop); add watermarks; add extra UI elements; use bright neon or dark moody colours.
```
*If you attached the mascot/hero reference, add this final line:* "Use the attached images only as a loose reference for the friendly line-art style and the colour palette; do not copy the character, and do not include any text from them."

**A good result looks like:** a pastel peach-to-sage wash with quiet outlined leaves, plane and calendar doodles at the edges,
nothing legible, and a clear calm area in the middle.
**Iteration tips:**
- *Letters or numbers appear on the calendars:* "Same image, make every calendar page completely blank, with no numbers."
- *Too busy:* "Same image, remove half of the small motifs and keep only leaves and one paper plane."
- *Too pink or too green:* "Same image, rebalance to about 50% blush and 50% sage."
- *Wrong mood (dark, dramatic):* "Same image, lighter, softer, pastel."
- *Layering later:* export it, then put your phone cut-out (from P2's compositing, or a shadowed rounded rectangle from F2) on top in Figma.

---

## D. Placement and export notes

**Where it goes.** The hero is: logo bar -> a row with the headline "From inbox to calendar / in one tap" on the left and the
scout-kid mascot (320 x 320 on desktop, 160 x 160 on mobile) on the right -> **the product image** -> the
"1. Find an email in your inbox ..." card. The product image is the block marked `{/* Hero Graphic */}` in
`landing/src/App.tsx`, currently `<img src="/images/hero-graphic.png">` (file: `landing/public/images/hero-graphic.png`).
To swap it, replace that file (keep the same name) or change the `src`. Do not change `App.tsx`
as part of this task; this pack only produces the assets.

**Container details to match:** full width of a column that is at most 1024px wide (so it is about
342px wide on a 390px phone), `rounded-3xl` (24px corners), `shadow-2xl`, `w-full h-auto`, over a white page.
The surrounding page uses card corners of 24-40px and soft forest-tinted shadows.

**Because the wrapper already rounds the corners and adds the shadow:**
- If your image is a full rectangle (a scene with a background), **do not** bake rounded corners or a shadow into the file. The page will do it.
- If you ship a *transparent cut-out phone* instead, remove `overflow-hidden` and `shadow-2xl` from that wrapper in code
  and give the phone its own soft shadow in the file, otherwise you get a box shadow around an invisible rectangle.
- Make the scene's edges the same colour family as the page (soft blush or sage) so it does not look like a pasted rectangle.

**Export:**
- **Size:** 2048 x 1348 (3:2, 2x of the 1024px column). If you start at 2K from Nano Banana, resize rather than crop.
- **Format:** WebP at about quality 80 as the main file; keep a PNG copy as a backup. The current PNG is 706 KB.
  **Budget: under 250 KB for the WebP**, and under 700 KB for a PNG, so the hero does not slow the page.
  Squoosh (squoosh.app) or Figma's export panel with WebP both work.
- **Name:** something descriptive, for example `hero-scout-report-phone.webp`.

**Suggested alt text (describes what is true):** "A phone showing a Calendar Scout email: four school events found in a
newsletter, each on its own card with an Add to Calendar button."
For a before -> after image: "A long school newsletter on the left becomes four clear event cards, each with an Add to Calendar button, on the right."

**The ready-made pair (no AI at all):** `hero-phone-before-tile@3x.png` + `hero-phone-after-tile@3x.png` side by side are exactly 3:2 (2340 x 1560 together at 3x, so export at 2048 x 1365 or similar). They are deliberately scaled up, so they stay readable at the 342px mobile width better than a 1:1 screenshot would. `hero-desktop-before-window@3x.png` and `hero-desktop-after-window@3x.png` are each a full 3:2 hero image on their own.

**Test at mobile width:** in Chrome, open the page, press Cmd+Option+I, click the phone/tablet icon, choose a width of 390 (also
check 360 and 430). The image will be about 342px wide, so check that (1) the phone is still the clear subject, (2) the
largest words on the screen, like the event titles and the "Add to Calendar" button, are readable, and (3) nothing important
sits within about 10% of the left and right edges. If the small text is too tiny at that width (likely, with a 3:2 scene), the
better fix is a second, **portrait-cropped version** for mobile (for example 4:5), swapped in with an HTML
`<picture>` element. That is a small code change for a later task. Run the local site with `npm run dev` in `landing/` (it starts on port 3000).

---

## E. Truthfulness guardrail: what the picture may and may NOT show

Grounded in the real code (`worker/src/email-templates.ts`, `worker/src/calendar-utils.ts`, `worker/src/index.ts`) and the site copy.

**The mockup MAY depict:**
- A person forwarding an email (any event-packed email, school newsletters especially) to the Scout's address. The site shows
  `forward@sendtoschedule.com`; the reply actually comes **from** `scout@sendtoschedule.com`
  (shown as "Calendar Scout · report in ~1 min"). Any address ending `@sendtoschedule.com` reaches the Scout. If an address
  appears in an image, use the site's `forward@sendtoschedule.com` so the page and the picture agree.
- A reply email titled "Scout Report" containing a summary line ("Found 4 events about ..."), a header ("Your events from ..."),
  and **one card per event** with title, day/date/time, "at" location, a short description and a dark green **"Add to Calendar"** button.
- One tap on "Add to Calendar" opening a **pre-filled Google Calendar** event.
- The footer promises, which are real: free, experimental ("I am not always perfect, so please check my work"), "I process your text,
  find your dates, and don't store your data."
- Warm, calm, parent-focused imagery: school newsletters, family kitchens, a tidy calendar.

**The mockup must NOT depict or imply:**
- Events being **added automatically** to a calendar. The product only hands you a pre-filled link; you still tap and save in your calendar.
- **Apple Calendar, Outlook or other calendars** as options. The links are Google Calendar links only.
- An **app**, an app icon, an App Store or Google Play badge, a **login, account, profile or dashboard**. None exist: "No accounts to create, no apps to download."
- A **calendar view or sync** of any kind inside the product.
- **Photos, screenshots or PDFs being scanned.** Image/PDF newsletters are not supported yet (the code has this disabled; the site says "coming soon"). Show **text emails** only.
- **Real brand logos or interfaces**: Gmail, Apple Mail, Outlook, iOS/Android status bars, notification banners. Also no real school or person names.
- Claims not on the site: speed guarantees beyond "a few seconds / about a minute", accuracy claims ("100% accurate"), counts of users, awards, reviews, pricing other than free.
- The **"review first" amber cards, "fix the date" notices or errors** in the *hero*. They are real and honest, but the hero should show the clean case; don't invent additional warnings in the mockup.
- "Reads your whole inbox". It only reads emails the person chooses to forward.

---

## F. QA checklist for every generated image

Zoom to 200% and answer each one. Any "no" means fix or regenerate; do not ship.

1. **Legible?** Can you read every event title and the "Add to Calendar" buttons at normal size and at 342px wide?
2. **Screen content untouched?** Does the screen match the real screenshot word for word (titles, dates, times, locations)? Compare against `hero-phone-after-screen@3x.png` (or `hero-desktop-after-screen@3x.png` for the laptop). Note that the hero-scaled screens deliberately show less (one full card and the top of a second); that is expected.
3. **No gibberish?** No scrambled letters on flyers, signs, the screen edge, the keyboard, or the phone body.
4. **Palette right?** Deep forest green buttons (#2E4A2E), pale sage shell (#F3F7F3), white cards; scene in warm cream/blush/sage. No odd neon, no bright orange.
5. **No fake logos or app UI?** No Gmail/Apple/Google marks, no status bar, no notification, no brand on the phone or laptop.
6. **Hands and phone OK?** Five natural fingers, believable grip, phone has no brand, screen is rectangular with consistent rounded corners.
7. **Looks like the real product?** Georgia-style serif type, rounded cards, same card order and button label. No extra features pictured.
8. **Truthful?** Nothing from the "MUST NOT" list in section E.
9. **No extra text or watermark** anywhere (including tiny corner marks).
10. **Fits the slot?** 3:2, calm area where you want empty space, still reads when shrunk to 342px wide, edges blend with the page.
11. **Fictional names only?** "Maple Grove Elementary", no real school, person or business.

---

## G. Figma AI prompts (F1-F3)

### G.1 How these differ from the Nano Banana prompts, and when to use each

- **Nano Banana (P1-P6) makes a picture.** A photo-style image of a hand, a phone and a kitchen. It is flat (not
  editable), and the AI draws every pixel, which is exactly why we hand it the real screenshot and
  tell it not to touch it. Best when you want **a warm, photographic scene** around the product.
- **Figma AI (F1-F3) makes a layout.** Real, editable boxes, real text, spacing and colours you can click and change; nothing
  is "painted". The AI is good at *structure* (where things go, how they resize) and weak at *photography*. The real
  screenshot goes in as an **image fill**, so it stays exactly as rendered. Best when you want **an editable, on-brand hero
  or a clear before -> after diagram** that you can tweak and hand to a developer.
- **A simple rule:** want a *mood* image -> Nano Banana (P1, then P2 if the text drifts). Want *clean, accurate,
  and easy to change* -> Figma (F1-F3). They combine well: make P6 or P1 in Nano Banana, then drop it into the F1 frame.
- **Always place the screenshot yourself.** Figma AI features often generate placeholder images or redraw content. After it
  builds the layout, select the screen shape and set its fill to Image, then choose the real PNG from `marketing/hero/`.
  Do not trust an AI-drawn replacement.

### G.2 Which Figma AI tool? (verified as far as I could)

I ran a quick web search. What I could confirm, mostly from third-party reviews plus a Figma help-center page
(`help.figma.com`, "Use First Draft with Figma AI"): Figma has an in-canvas feature called **First Draft** that turns
a text prompt into editable designs, and a separate prompt-to-app tool called **Figma Make** (it builds a working web app
and its output cannot be pushed back into a Figma design file). Some 2026 articles also mention newer names such as
a Figma "Agent" and "Weave". **I could not verify Figma's current official feature names, plan limits or
where each lives in the interface, and they change often.** So please check what your Figma shows: look for the AI
or "Make" entries in the toolbar/menu, and use the prompt-to-design option that produces *editable frames* (not an app). If
only Figma Make is available, paste the same prompts, but expect it to generate a code app; use it for look-and-feel,
then rebuild or copy values into a Figma design file. The prompts below are written to work in either style.

*Fonts:* the live homepage uses **Cormorant Garamond** (headings) and **Inter** (body/buttons). Both are Google Fonts and
normally available in Figma. The email uses **Georgia**, which is a system font. If a prompt tool ignores the font, set it
manually afterwards.

### F1. Full homepage hero section (design brief)

- **Purpose:** an editable, on-brand rebuild of the hero (nav + headline + mascot + product image slot + the "forward it" card), with a
  clearly marked placeholder for the real screenshot or your Nano Banana image. The product image slot is 3:2, the same ratio as `hero-phone-before-tile@3x.png` + `hero-phone-after-tile@3x.png` placed side by side (the ready-made no-AI option), so those two files drop straight in.
- **Attach / place afterwards:** your finished hero image (a Nano Banana result or a P2-composited image) in the product-image frame;
  `marketing/hero/scout-mascot-reference.png` in the mascot frame (or the live mascot SVG at `landing/image2vector (1).svg`).
- **Note on copy:** the current live hero has **no separate subhead**. It goes straight from the headline to the image to the card. The prompt below
  keeps it that way; an optional subhead line is clearly marked.

```
Design the hero section of a calm, friendly landing page for a free micro-product called "Calendar Scout" (for busy parents who get long school newsletters). Create two frames: Desktop (1440 wide) and Mobile (390 wide). Use Auto Layout everywhere, with named layers, and make the frames responsive (children set to Fill container / Hug as appropriate). Use light mode only, on a white page background (#FFFFFF).

DESIGN TOKENS (create as local variables/styles):
Colours: Forest #2E4A2E (headings, buttons, main text); Olive #556B55 (secondary accent text); Sage mist #F3F7F3 (card backgrounds); Sage border #E0E7E0 (card outlines); White #FFFFFF. Text secondary = Forest at 50-70% opacity. Soft shadow colour = Forest at 5% opacity.
Fonts: headings in Cormorant Garamond (Medium, tight tracking, line-height about 1.1); body text and buttons in Inter. Italic Cormorant Garamond for the numbered steps.
Radii: cards 40px; large image frame 24px; buttons 16px; icon chips 8px.

STRUCTURE (Desktop, content column max width 1024, centred, 24px side padding):
1. NAV BAR: left aligned. A 32 x 32 Forest circle containing a small white "calendar-check" line icon, then a vertical stack: "Calendar Scout" (Cormorant Garamond, 18, semibold) and under it "sendtoschedule.com" (Inter, 12, Forest at 50%). Padding 24.
2. HEADLINE ROW (horizontal Auto Layout, gap 32, vertically centred, bottom margin 32): left, the H1 text exactly: "From inbox to calendar" then a line break then "in one tap" (Cormorant Garamond Medium, 72/79, Forest, fill remaining width). Right, a 320 x 320 square frame named "Mascot" with a placeholder image fill (a friendly illustrated scout kid with binoculars holding a pennant flag), content fit = contain.
3. PRODUCT IMAGE FRAME named "Hero image - REAL SCREENSHOT GOES HERE": width = fill container (1024), aspect ratio 3:2 (1024 x 674), corner radius 24, clip content, drop shadow (0, 25, 50, -12) at 25% black. Fill: a flat placeholder in light sage #D5E3DB. Do NOT generate any imagery or text inside it; I will place my own image fill. Add a small hidden annotation layer saying "Replace image fill".
4. "FORWARD IT" CARD (vertical Auto Layout, max width 672, centred, padding 40, gap 16, background Sage mist #F3F7F3, 1px Sage border #E0E7E0, corner radius 40, soft shadow Forest 5%): 
   - Line "1. Find an email in your inbox" (Cormorant Garamond Italic, 36, Forest at 90%)
   - Line "2. Forward it to:" (same style)
   - A primary button, Forest #2E4A2E fill, white Inter Semibold 20 text "forward@sendtoschedule.com", padding 20 x 32, radius 16, with a small 36 x 36 rounded chip (white at 10% opacity) at the right holding a white "copy" icon; soft Forest shadow.
   - Line "3. Wait a few seconds for a reply" (same style)
   - Line "That's it!" (Cormorant Garamond Italic, 36, Olive #556B55, bold)
   - A secondary button: white fill, 1px Sage border, Forest Inter Semibold 16 text "Add to Contacts" with a small "user-plus" icon in a Forest-at-10% rounded chip at the left; radius 16.
   - Under it, small caption (Inter, 12, Forest at 50%): "So the Scout's address is ready next time, no retyping or searching your inbox"
OPTIONAL (delete if not wanted): a single subhead under the H1, Inter 20, Forest at 70%: "Forward a school newsletter. Get back one-tap Add to Calendar links."

MOBILE (390 wide, 24px side padding): stack vertically: nav, then the mascot (160 x 160, centred) ABOVE the H1, H1 centred at 36/40; product image frame full width (342) keeping 3:2 (or 4:5 if you add a portrait variant); the "forward it" card padded 24 with steps in 24px and the forwarding button full width with 16px text.

STYLE: warm, calm, generous whitespace, no stock photography, no gradients on buttons, no extra icons, no extra text beyond what is listed. Names for every layer. Keep copy EXACTLY as written above.
```

**A good result looks like:** a tidy frame with auto-layout, the exact words above (check "From inbox to calendar in one tap"
and the three steps), the placeholder box ready for your image, and sensible stacking in the mobile frame.
**Iteration tips:** if it invents extra copy, say "remove all text not listed in the brief". If it paints a fake screenshot in the image frame, delete it and use an image fill with your PNG.
If fonts fall back, set Cormorant Garamond/Inter manually. If radii are off, adjust on the component, not by eye on each instance.

### F2. Phone-frame product shot component

- **Purpose:** a reusable "Phone" component that holds the real screenshot as an image fill, in a simple generic device frame (no brand).
- **Place afterwards:** `marketing/hero/hero-phone-after-screen@3x.png` (1170 x 2532, the real Scout Report, hero-scaled, inside a generic email-app frame) as the Screen's image fill. For the before version use `hero-phone-before-screen@3x.png` (same size and shape). These already carry their own generic status strip and header, so the component itself must NOT add one (the prompt below says so). If you would rather have the bare email with no email-app frame, use `hero-bare-after-tile@3x.png` or the 1:1 `hero-email-phone-screen@3x.png`.

```
Create a reusable Figma component named "Phone / Product shot" for placing a product screenshot inside a generic smartphone frame. No brand features: no logos, no home button, no camera bump, no status bar, no notch icons.

Structure (Auto Layout where it helps, all layers named):
- Outer body: a rounded rectangle 408 x 862, corner radius 56, solid near-black #1C1C1C, with a very subtle 1px inner stroke at 20% white for a soft edge highlight.
- Screen: a rectangle named "Screen - IMAGE FILL" exactly 390 x 844, centred in the body (9px bezel on every side), corner radius 47, clipped. Aspect ratio locked at 390:844 (that equals the 1170 x 2532 screenshot). Fill: a flat placeholder in Sage mist #F3F7F3 with a thin dashed outline in Sage border #E0E7E0. I will place my own PNG as an image fill with scale mode "Fill", aligned to the TOP, so the top of the email is always at the top of the screen. Do not generate any imagery or text in the screen.
- Soft shadow under the phone: Drop shadow (0, 30, 60, -15) in Forest #2E4A2E at 35% opacity, plus a very soft second shadow (0, 8, 16, 0) at 10% black.

Component properties / variants:
- Size: "Desktop" (width 320, height scales proportionally to about 677) and "Mobile" (width 240, height about 508). Use constraints so the screen scales with the body.
- Tilt: "Straight" (0 degrees) and "Slight" (rotated 4 degrees, with the shadow rotating consistently).
- A boolean "Show shadow" (default true).
- An instance-swap or image-fill property so I can swap the screenshot without detaching the component.

Keep the design minimal, symmetrical and flat, in light mode. Add no text anywhere.
```

**A good result looks like:** one component, two sizes, an empty screen with a fill you can swap. The screen's corner radius should be smaller than the body's.
**Iteration tips:** if the AI draws a notch or home bar, say "remove the notch, dynamic island and home indicator". If the screenshot gets stretched when placed,
switch the fill's scale mode to Fill and align to the top (or Crop and reposition), never "Stretch". Zoom to check the corners (no light edge peeking beyond the rounded screen).

### F3. Before -> after layout (newsletter on the left, report on the right)

- **Purpose:** an editable, accurate before -> after panel for the homepage (or social posts), responsive to mobile.
- **Place afterwards:** the left screen: `marketing/hero/hero-phone-before-screen@3x.png` (1170 x 2532, hero-scaled newsletter in a generic email-app frame; the buried Oct 22 and Oct 30 dates are readable). The right screen: `marketing/hero/hero-phone-after-screen@3x.png` (1170 x 2532, the matching real Scout Report). Alternative: the two 3:4 tiles `hero-phone-before-tile@3x.png` + `hero-phone-after-tile@3x.png`, which together are exactly 3:2. For a "very long email" effect on the left, `hero-newsletter-before.png` (1170 x 7335, the full 1:1 newsletter).
  Both are fictional ("Maple Grove Elementary"), and the four events match exactly.

```
Design a responsive "Before and after" section for the Calendar Scout landing page. Create two frames: Desktop (1024 content width, in a 1440 page) and Mobile (390 wide). Use Auto Layout, named layers, light mode, page background #FFFFFF. Use the Calendar Scout tokens: Forest #2E4A2E; Olive #556B55; Sage mist #F3F7F3; Sage border #E0E7E0; White #FFFFFF; headings Cormorant Garamond, body Inter.

SECTION CONTAINER: Sage mist #F3F7F3 background, 1px Sage border #E0E7E0, corner radius 40, padding 40 (24 on Mobile), soft shadow Forest at 5%.

DESKTOP LAYOUT (horizontal Auto Layout, items centred vertically, gap 24):
1. LEFT COLUMN (vertical Auto Layout, centred): 
   - A small label chip: text "Before" (Inter, 12, semibold, uppercase, letter-spacing 8%, Olive #556B55) on a pill with Sage border.
   - A phone component (use my "Phone / Product shot" component, Size = Desktop, Tilt = Slight, rotated -3 degrees) whose Screen shows my newsletter image fill, aligned to top, with a bottom white fade gradient overlay (white 0% to 100% over the last 25% of the screen) to suggest the email keeps going.
   - Caption (Inter, 16, Forest at 70%, centred, max width 280): "A long school newsletter with the dates buried in the text"
2. CENTRE CONNECTOR (vertical, fixed width 96): a smooth, slightly curved arrow pointing right, 2px Forest #2E4A2E line with a round arrowhead; a small 40 x 40 Forest circle badge sitting on the line holding a white "calendar-check" icon. No other text.
3. RIGHT COLUMN (vertical Auto Layout, centred):
   - A small label chip: text "After" (same style, but Forest text on a Sage mist fill with Forest border).
   - The same phone component (Size = Desktop, Tilt = Slight, rotated +3 degrees) whose Screen shows my Scout Report image fill, aligned to top.
   - Caption (Inter, 16, Forest at 70%, centred, max width 280): "Every event on its own card, with an Add to Calendar button"

MOBILE LAYOUT (vertical Auto Layout, centred, gap 16, section padding 24): the same three elements stacked in order: Before label, left phone (Size = Mobile), Before caption, then the connector ROTATED 90 degrees so the arrow points DOWN (height 72), then the After label, right phone (Size = Mobile), After caption. Phones are straight (no tilt) on Mobile. Make the section scale between 360 and 430 wide without clipping, and make sure the phones never overflow their container.

IMPORTANT: do not generate or draw any screenshots, email text or imagery; leave both Screens as swappable image fills with a Sage mist placeholder, and I will place my own PNGs. Keep every word exactly as written above, add no other text, logos, icons or decoration, and use only the listed colours.

Also add a headline above the section: "Newsletter in, calendar events out" (Cormorant Garamond Medium, 48 desktop / 32 mobile, Forest, centred). Remove it if you prefer not to have a headline.
```

**A good result looks like:** a rounded sage card with "Before" on the left, an arrow in the middle, "After" on the right; on mobile it stacks top to bottom
with a downward arrow, and the phones stay inside the card.
**Iteration tips:** if the AI draws its own screens, delete them and apply the real PNG fills. If the arrow looks clumsy, ask for "a simple straight arrow, 2px, no curve".
If captions wrap oddly on mobile, set the caption width to Fill container. If you would rather not use a headline, delete that text layer. Check truth: the captions say only what the images show, and "Add to Calendar" opens a pre-filled Google Calendar event (not an auto-add).

---

## H. How this was made (for the record)

- The "after" PNGs come from the **real** `buildReportEmail` function (`worker/src/email-templates.ts`), run by
  `worker/scripts/render-hero-email.ts` with four fictional events, then rasterized with the already-installed Google Chrome
  in headless mode (no installs). Re-run: from `worker/`, bundle with esbuild, run the `.mjs` and re-screenshot (the exact command
  is in the script's header comment).
- The "before" newsletter is hand-written HTML (`hero-newsletter-before.html`) designed so its four buried events match the four report cards exactly; the HTML header comment holds the fact-check table so any future edit keeps the two in sync.
- The framed and hero-scaled versions are built by `worker/scripts/render-hero-containers.ts`, which writes HTML into `marketing/hero/source/`; `marketing/hero/source/rasterize.sh` turns each page into a PNG (size and pixel density come from `source/manifest.txt`). The hero-scaled report uses the same real markup as the 1:1 render with only the footer, the heading and the descriptions removed and paddings tightened.
- Chrome's headless window has a minimum width, so the phone-width newsletter was captured through a 390px-wide frame to keep its real phone layout.
