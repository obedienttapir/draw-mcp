# The Basement Cinema — Design Review No. 02

Furniture, finishes and light for the basement screening room and fireside lounge: seven furniture collections, five lighting scenes, the fireplace wall with and without a stone slab, and walnut slats behind the TV. 50 pages, 17 × 11 in landscape.

| File | What it is |
| --- | --- |
| [`Basement-Cinema-Design-Review.pdf`](Basement-Cinema-Design-Review.pdf) | Screen edition (about 14 MB): for reading, sharing and email. |
| [`Basement-Cinema-Design-Review-Print.pdf`](Basement-Cinema-Design-Review-Print.pdf) | Print edition (about 28 MB): full-resolution renders for an 11 × 17 print. |
| [`cinema-edit-layout.json`](cinema-edit-layout.json) | The recommended scheme for the planner: open `../../index.html`, click **Layout code**, paste the file's contents and press **Apply pasted code**. |
| [`tools/`](tools) | The pipeline that renders and composes the review (see below). |

## What is in it

- **Introduction** — at a glance (three moves, the recommendation, the decisions needed), the room as measured (rendered plan with the site dimensions), design principles and the material palette.
- **I · Architecture & light** — the fireplace wall as built and as originally schemed; **Option A**, slats running straight across both windows with a backlit LED band and a honed stone slab around the fire (82″ × 75″); **Option B**, the same slats running to a 1½″ reveal around the firebox, no slab; a side-by-side comparison; the **TV wall in walnut slats** (before/after and close-ups); viewing angles for the 85″ TV and the 110″ drop-down screen; the five lighting scenes; the 5.1.2 speaker pre-wire plan.
- **II · Seven collections** — Warm Modern, Mid-century Modern, Japandi, Industrial Loft, Luxe Lounge, Performance Theatre, and our **Warm Modern · Cinema Edit**. Each gets an opener, the lounge, sectional, arrival and alcove views, its piece list with indicative prices, the room in Bright, Fireside, Game night and Movie light, a furnished plan keyed to the piece list, and its scores.
- **III · Evaluation & recommendation** — the seven side by side (whole room, lounge, sectional, and the whole room with Option B), the scorecard under four sets of priorities, budget and lead-time charts, the recommendation with alternates, the FF&E schedule, the scope to send the trades for quotes, and a timeline to the first screening.
- **Appendix** — how the scores work, and an upholstery guide.

Every image is rendered from the planner with the measured room. Furniture prices, scores and lead times come from the planner's style study (indicative CAD, before tax and delivery). Slats, slab, lighting and AV are listed with quantities for trade quotes rather than priced.

## Regenerating it

```sh
tools/make-review.sh            # renders from ../../index.html, writes both PDFs and the layout code here
```

It needs Node 18+, Playwright with Chromium, Python 3 with Pillow and pypdf, and npm, which fetches three.js and the Cormorant Garamond webfont into `.work/` on the first run. Rendering takes about ten minutes on a CPU.

| Step | Script | Output in `.work/` |
| --- | --- | --- |
| Render | `render.cjs` drives the planner headless through its print hooks (`window.__cinema.capture`, `planShot`, `studyData`, `showItems`) | `renders/`: about 100 renders, furnished plans, and the study, plan and viewing data |
| Prepare | `prep.py` | `print/` and `screen/` image sets, plan backgrounds cleaned, detail close-ups cut |
| Compose | `build.cjs` + `review.css` | one HTML page per sheet, with the plans' dimensions redrawn as vectors |
| Print | `print.cjs`, then `finalize.py` | the PDFs, with bookmarks and document properties |

Camera positions, lighting exposures and the Cinema Edit's piece changes are at the top of `render.cjs`; the text of the review is in `build.cjs`.
