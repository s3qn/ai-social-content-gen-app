#!/usr/bin/env bash
#
# Build assets/images/statto-loop.webp from assets/images/statto-ds.mp4.
#
# Why this exists: the source is an H.264 mp4 (yuv420p) with NO alpha channel,
# so playing it as video would put a black rectangle on screen. It does however
# sit on an exactly-#000000 background, and the character never touches black:
# the eye+brow region contains zero pure-black pixels (min luma 5, pupils at
# luma 26-32). That gap is what makes the key below safe rather than a guess.
#
# Two problems are fixed here:
#
#   1. No alpha. `alphamerge` builds a straight alpha channel from luma with a
#      soft ramp (luma 0 -> transparent, luma >=8 -> opaque). The 0.37% of
#      pixels that land in between are the anti-aliased silhouette, which is
#      exactly where partial alpha belongs.
#
#   2. No loop. The source does not loop: the last frame differs from the first
#      by roughly 12x a normal frame step, because a rising arrow appears and
#      the pose shifts, so a raw loop pops every 5s. We drop that trailing beat
#      and dissolve the tail back into the head instead.
#
# Output: ~950K, VP8X flags 0x12 (alpha + animation), 111 frames, rendered by
# expo-image. Re-run this if the source animation is re-exported.
#
# Usage:  bash scripts/build-statto-loop.sh
set -euo pipefail

cd "$(dirname "$0")/.."

SRC="assets/images/statto-ds.mp4"
OUT="assets/images/statto-loop.webp"

# Display size is ~180pt; 420px covers that past 2x density without bloating the
# file. 24fps is plenty for a soft character idle and is 40% cheaper than the
# source's 60.
WIDTH=420
FPS=24
QUALITY=62

KEEP=4.6   # drop the trailing arrow beat (source runs 5.07s)
BODY=4.2   # plays untouched
FADE=0.4   # KEEP-BODY: tail cross-dissolved into the head

if [ ! -f "$SRC" ]; then
  echo "build-statto-loop: missing $SRC" >&2
  exit 1
fi

# -an drops the source's stray AAC track outright, so there is no audio to mute.
ffmpeg -y -v warning -i "$SRC" -filter_complex "\
[0:v]fps=${FPS},scale=${WIDTH}:-1:flags=lanczos,trim=0:${KEEP},setpts=PTS-STARTPTS,split[main][tail];\
[main]trim=0:${BODY},setpts=PTS-STARTPTS[body];\
[tail]trim=${BODY}:${KEEP},setpts=PTS-STARTPTS[fade];\
[0:v]fps=${FPS},scale=${WIDTH}:-1:flags=lanczos,trim=0:${FADE},setpts=PTS-STARTPTS[head];\
[fade][head]blend=all_expr='A*(1-(T/${FADE}))+B*(T/${FADE})'[blended];\
[body][blended]concat=n=2:v=1:a=0,\
format=rgba,split[a][b];\
[a]format=gray,geq=lum='clip(lum(X,Y)*32,0,255)'[al];\
[b][al]alphamerge" -an \
  -c:v libwebp_anim -lossless 0 -q:v "${QUALITY}" -compression_level 4 -loop 0 \
  "$OUT"

# Verify the container really carries alpha + animation rather than trusting the
# encoder: VP8X flag bit 4 is alpha, bit 1 is animation.
python3 - "$OUT" <<'PY'
import sys
p = sys.argv[1]
d = open(p, 'rb').read()
if d[:4] != b'RIFF' or d[8:12] != b'WEBP':
    sys.exit(f'{p}: not a WebP')
if b'VP8X' not in d[:40]:
    sys.exit(f'{p}: no VP8X chunk, so no alpha/animation flags')
flags = d[20]
alpha, anim = bool(flags & 0x10), bool(flags & 0x02)
frames = d.count(b'ANMF')
print(f'{p}: {len(d)/1024:.0f}K, alpha={alpha}, animated={anim}, frames={frames}')
if not (alpha and anim and frames > 1):
    sys.exit('expected an animated WebP WITH alpha')
PY
