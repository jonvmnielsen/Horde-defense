#!/bin/sh
# Library sounds (synced by game-assets/tools/sync.mjs into public/lib) → public/sounds/lib/*.mp3
# Ogg is converted to mp3 so every phone browser can decode it. Run after a sync.
set -e
out=public/sounds/lib
mkdir -p "$out"
find public/lib -name '*.ogg' | while read f; do
  n=$(basename "$f" .ogg)
  ffmpeg -nostdin -y -loglevel error -i "$f" -ac 1 -ar 44100 -codec:a libmp3lame -b:a 80k "$out/$n.mp3"
done
find public/lib/audio -name '*.mp3' | while read f; do cp "$f" "$out/$(basename "$f")"; done
ls "$out" | wc -l
