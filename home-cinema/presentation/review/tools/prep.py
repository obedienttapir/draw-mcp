"""Prepares the review's images from the raw renders.

Usage: python3 prep.py <renders dir> <work dir>

- plans: anything light connected to the border becomes exactly the paper colour (drops soft shadows past the walls)
- details: close-ups cut from the full-size renders (slats, slab, seating, TV wall before/after)
- <work>/print: full resolution, re-encoded; <work>/screen: long side 1600 px for the lighter edition
"""
import glob
import os
import shutil
import sys

from PIL import Image, ImageDraw

SRC, WORK = sys.argv[1], sys.argv[2]
PAPER = (243, 239, 232)  # the page colour in review.css (--paper)
STAGE = os.path.join(WORK, 'stage')
os.makedirs(STAGE, exist_ok=True)

# 1. plans on paper
for f in sorted(glob.glob(os.path.join(SRC, 'plan-*.png'))):
    im = Image.open(f).convert('RGB')
    w, h = im.size
    for xy in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1), (w // 2, 0), (w // 2, h - 1), (0, h // 2), (w - 1, h // 2)]:
        ImageDraw.floodfill(im, xy, PAPER, thresh=120)
    im.save(os.path.join(STAGE, os.path.basename(f)))

# 2. renders as they are
for f in sorted(glob.glob(os.path.join(SRC, '*.jpg'))):
    shutil.copy(f, STAGE)

# 3. detail close-ups: (source render, crop box in its pixels, output size)
DETAILS = {
    'detail-slats': ('arch-fireEl-A-evening.jpg', (1380, 120, 2180, 720), (1200, 900)),
    'detail-slab': ('arch-fireEl-A-evening.jpg', (760, 470, 1560, 1070), (1200, 900)),
    'detail-seat': ('cinema-edit-fire-fireside.jpg', (1000, 620, 1960, 1340), (1200, 900)),
    'detail-tv-before': ('arch-tvEl-before-game.jpg', (420, 0, 1300, 560), (1320, 840)),
    'detail-tv-after': ('arch-tvEl-after-game.jpg', (420, 0, 1300, 560), (1320, 840)),
}
for name, (src, box, size) in DETAILS.items():
    im = Image.open(os.path.join(SRC, src)).convert('RGB').crop(box).resize(size, Image.LANCZOS)
    im.save(os.path.join(STAGE, name + '.jpg'), quality=95)

# 4. the two editions
for edition, long_side, quality, plan_quality in [('print', None, 88, 92), ('screen', 1600, 82, 88)]:
    out = os.path.join(WORK, edition)
    os.makedirs(out, exist_ok=True)
    for f in sorted(glob.glob(os.path.join(STAGE, '*'))):
        name = os.path.basename(f)
        im = Image.open(f).convert('RGB')
        if name.startswith('plan-'):
            if long_side:
                im.thumbnail((1500, 1500), Image.LANCZOS)
            im.save(os.path.join(out, name.replace('.png', '.jpg')), quality=plan_quality, optimize=True, progressive=True,
                    subsampling=0 if not long_side else 2)
        else:
            if long_side:
                im.thumbnail((long_side, long_side), Image.LANCZOS)
            im.save(os.path.join(out, name), quality=quality, optimize=True, progressive=True)
    print(edition, len(os.listdir(out)), 'images')
