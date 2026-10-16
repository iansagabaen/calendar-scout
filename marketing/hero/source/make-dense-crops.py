#!/usr/bin/env python3
"""Build the two 'dense wall of text' BEFORE crops used by the 2026-10-16 hero banner pack.

Both are straight pixel crops of the real, already-rendered 1:1 fictional newsletter
(hero-newsletter-before.png and hero-newsletter-before-desktop@2x.png), so every word is
exactly what is in the newsletter. Nothing is redrawn. The only edit is a soft white fade
at the bottom so it reads as 'this goes on and on'.

Run from marketing/hero/:  python3 source/make-dense-crops.py
Needs Pillow (already on this Mac).
"""
from PIL import Image

def fade_bottom(img, fade_px):
    w, h = img.size
    mask = Image.new("L", (1, h), 0)
    px = mask.load()
    for y in range(h):
        d = y - (h - fade_px)
        px[0, y] = 0 if d <= 0 else min(255, int(255 * (d / fade_px) ** 1.3))
    mask = mask.resize((w, h))
    white = Image.new("RGB", (w, h), (255, 255, 255))
    return Image.composite(white, img, mask)

# 1) PHONE: real phone header (status strip + back arrow + 4 icons, top 210px of the 1:1 phone render)
#    + the dense 'Upcoming Happenings' stretch of the full newsletter, like the email scrolled down.
#    1170 x 2532 = 390:844 (same shape as hero-phone-before-screen@3x.png).
phone = Image.open("phone-before-1x@3x.png").convert("RGB")
full = Image.open("hero-newsletter-before.png").convert("RGB")
HEAD = 210
Y0 = 3775
out = Image.new("RGB", (1170, 2532), (255, 255, 255))
out.paste(phone.crop((0, 0, 1170, HEAD)), (0, 0))
body = full.crop((0, Y0, 1170, Y0 + 2532 - HEAD))
body = fade_bottom(body, 250)
out.paste(body, (0, HEAD))
out.save("hero-phone-before-dense@3x.png", optimize=True)

# 2) WIDE: desktop-width newsletter body (dates stretch), 1320 x 960 (11:8), 2x density.
desk = Image.open("hero-newsletter-before-desktop@2x.png").convert("RGB")
X0, Y0w = 100, 1935
wide = desk.crop((X0, Y0w, X0 + 1320, Y0w + 960))
wide = fade_bottom(wide, 150)
wide.save("hero-wide-before-dense@2x.png", optimize=True)
print("ok")
