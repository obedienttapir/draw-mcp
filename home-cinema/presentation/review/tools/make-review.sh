#!/usr/bin/env bash
# Regenerates both editions of the design review from the planner.
#   tools/make-review.sh [path/to/index.html]
# Needs Node 18+, Playwright with Chromium, Python 3 with Pillow and pypdf, and npm (fetches three.js and the
# Cormorant Garamond webfont into the work folder on first run). Renders take about 10 minutes on a CPU (SwiftShader).
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
REVIEW="$(dirname "$HERE")"
export REVIEW_WORK="${REVIEW_WORK:-$REVIEW/.work}"
APP="$(cd "$(dirname "${1:-$REVIEW/../../index.html}")" && pwd)/$(basename "${1:-index.html}")"
mkdir -p "$REVIEW_WORK/vendor"

fetch() {   # npm package -> $REVIEW_WORK/vendor/<dir>/package
  local pkg="$1" dir="$2"
  [ -d "$REVIEW_WORK/vendor/$dir/package" ] && return
  local tmp; tmp="$(mktemp -d)"
  (cd "$tmp" && npm pack "$pkg" --silent >/dev/null)
  mkdir -p "$REVIEW_WORK/vendor/$dir" && tar -xzf "$tmp"/*.tgz -C "$REVIEW_WORK/vendor/$dir" && rm -rf "$tmp"
}
fetch three@0.160.0 three                                 # the version the planner's import map loads
fetch @fontsource/cormorant-garamond@5.2.5 cormorant

node "$HERE/render.cjs" "$APP"
python3 "$HERE/prep.py" "$REVIEW_WORK/renders" "$REVIEW_WORK"
for ed in print screen; do
  IMG_DIR="$REVIEW_WORK/$ed" node "$HERE/build.cjs" "$REVIEW_WORK/review-$ed.html"
  node "$HERE/print.cjs" "$REVIEW_WORK/review-$ed.html" "$REVIEW_WORK/review-$ed.pdf"
done
python3 "$HERE/finalize.py" "$REVIEW_WORK/review-print.pdf" "$REVIEW_WORK/review-print.outline.json" "$REVIEW/Basement-Cinema-Design-Review-Print.pdf"
python3 "$HERE/finalize.py" "$REVIEW_WORK/review-screen.pdf" "$REVIEW_WORK/review-screen.outline.json" "$REVIEW/Basement-Cinema-Design-Review.pdf"
cp "$REVIEW_WORK/renders/layout-cinema-edit.json" "$REVIEW/cinema-edit-layout.json"
echo "done: $REVIEW/Basement-Cinema-Design-Review.pdf (screen) and -Print.pdf"
