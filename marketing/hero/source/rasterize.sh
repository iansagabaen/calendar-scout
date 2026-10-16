#!/bin/bash
# Rasterize every page listed in manifest.txt to ../<name>.png with headless Chrome (no installs needed).
# Run from marketing/hero/source/.  Lines of manifest.txt: <name> <css-width> <css-height> <device-scale>
cd "$(dirname "$0")/.."
CH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
while read -r n w h s; do
  "$CH" --headless=new --disable-gpu --hide-scrollbars --default-background-color=00000000 \
    --window-size=$w,$h --force-device-scale-factor=$s --screenshot="$PWD/$n.png" "file://$PWD/source/$n.html" >/dev/null 2>&1
done < source/manifest.txt
