# Basement Cinema Planner

An interactive three.js model of the basement home cinema (Room 1 on the foundation plan, plus the strip past the W200 steel beam up to the fireplace wall). Use it to try furniture layouts, TV sizes, finishes and lighting before building.

Open `index.html` in a recent desktop or mobile browser. It loads three.js r160 and the fonts from public CDNs, so it needs an internet connection. Nothing else to install.

It starts in **Fast** display mode so it runs smoothly on older laptops and phones: it draws at standard resolution (lower still if frames get slow), skips the glow and area lights, and only redraws when something changes. The flame animates only while the fireplace is on screen. Switch to **High quality** (glow, soft area light, full resolution on sharp screens) under **Lighting › Display** if you have a strong graphics card. The choice is remembered per browser.

## What's modelled

| Element | Value | Source |
| --- | --- | --- |
| Fireplace wall → exterior wall | 228″ (19′-0″) | tape measure |
| Staircase wall → TV wall | 185″ (15′-5″) | tape measure |
| Ceiling | 108″ (9′) | owner |
| TV alcove (bay) | 10′-9″ (129″) wide at the opening, 84″ flat TV wall with 45° corners, 4′-7″ (55″) deep; its notch on the exterior side is 10′-10″ from the stair-side line, with a 2′-2″ jog to the exterior wall | tape measure, plan, photos |
| Alcove bulkhead | follows the bay outline, 12″ deep, underside 7′-8″ | estimated from photos |
| Fireplace wall | 10′-11″ (131″) long: on this side of the alcove the north wall sits 1″ further back than at the notch | tape measure |
| Fireplace nook | 3′-9″ (45″) deep, from the fireplace wall to the corner of the wall facing the stairs | tape measure |
| Fireplace-side bulkhead | over the W200 beam, from the fireplace wall to the alcove's west return (73″), and out over the stair landing; underside 7′-10″ | photos |
| Steel beam bump | 18″ wide and 12″ deep on the north wall of the fireplace pocket: its face is 9′-11″ from the pocket's south wall; beam line 33″ from the fireplace wall | tape measure, plan, photos |
| Stairs | 40″ wide along the staircase wall, 16 risers; bottom step 3′-11″ from the wall in front; tip of the stairs 11′-6″ from the exterior wall; open on the far side with a railing over the hallway | tape measure, photos |
| Wall facing the TV (stairs' room side) | solid floor to ceiling for 91″ from the exterior-wall corner (pink); the panel under the stairs meets the floor 128″ from the corner (blue) and is 31″ high where the solid wall ends (orange); open with a railing above the panel | tape measure |
| Wall the stairs face (west side of the landing and hallway) | solid for 4′-4″ from its corner with the main room, then a 5′-9″ opening through to the rest of the basement; the planner shows a 3′ stub of the passage beyond (an estimate), open at the far end | tape measure |
| Stair slope | set by that 31″ panel height: about 8¾″ tread run with 7⅝″ risers | from the tape numbers |
| Hallway behind the stairs | 93″ wide along its far wall, with a door (red) and 86″ along its east wall from the stairs, with the closet door's opening starting 2′-4″ from the far wall (green); open to the stairs under a railing | tape measure |
| Fireplace + 2 windows | 52″ linear fireplace, two 42″ × 10″ reeded transoms above (openings already cut) | photos |

Your tape measurements are sliders under **Room › Measured**, and Plan view shows each one as a dimension. The values marked as estimated can be changed in the same tab; the room rebuilds as you drag.

## Using it

- **3D / Plan / Walk** (keys `1` `2` `3`): orbit the dollhouse, read a dimensioned plan, or walk at eye height (`W A S D` or arrows, drag to look, hold ▲ on touch screens).
- **Camera presets**: Overview, From sofa, TV wall, Fireplace, From stairs.
- **Select and move**: click a piece, drag it on the floor (snaps to ½″). `Q` / `E` rotate 15° (Shift: 45°), `R` turns 90°, arrows nudge 1″ (Shift: 6″), `Del` removes, `Ctrl+D` duplicates, `Ctrl+Z` undoes.
- **TV**: click it to change size (65″–98″), mount height and offset. The details panel reports eye-to-screen distance, the field of view the picture fills (SMPTE 30° / THX 36° references), whether it fits the 84″ alcove wall, neck tilt, and whether it clears the soundbar.
- **Measure** (`M`): click two points. In Plan view points are taken on the floor.
- **Lighting**: Bright, Evening, Movie and Fireside scenes, plus dimmers for the pot lights and the 2700K LED channels, TV, flame and lamps.
- **Finishes**: wall paint, alcove accent colour, floor, slat wood, slats on the fireplace wall and/or behind the TV.
- **Layout code**: copy the whole design as text to keep versions, paste one back to restore it. The latest layout is also saved in the browser.
- **Hide menus** (`H`): hides every bar and panel so a phone shows only the 3D room. In this mode touches only move the camera (one finger turns, two fingers zoom and pan), so furniture can't be bumped by accident. Tap **Show menus** (or press `H` or `Esc`) to bring them back.

## Photo mode

**◉ Photo** in the top bar (or `P`) turns the screen into a camera for good snapshots, on a phone too, to keep or to send to another app for rendering.

- **Lenses in real focal lengths**: 16, 20, 24, 28, 35 and 50 mm, full-frame equivalent and matched on the diagonal like a phone camera, so a 24 mm shot here frames like 24 mm in a render app. Interiors are usually shot at 16–24 mm.
- **Framing**: 4:3, 3:2, 16:9, 1:1, 4:5 or 9:16, a thirds grid, and everything outside the frame dimmed. The label in the corner shows the lens and aspect.
- **Straight verticals** (⊥ Level, on by default): the camera stays level and the lens shifts instead of tilting, so walls stay upright, the look of architectural photography. Views steeper than 35° (aerials) tilt freely, and the label says *aerial tilt*.
- **Live camera moves, like a camera app**:

  | | 3D | Walk |
  | --- | --- | --- |
  | One finger / drag | orbit | look around |
  | Two fingers / right-drag | pan | move (up = forward, sideways = step aside) |
  | Pinch / Ctrl + wheel / trackpad pinch | zoom the lens, 12–85 mm | zoom the lens, 12–85 mm |
  | Hold ▲ ▼ / mouse wheel | move in and out | walk forward and back (also W A S D) |

  The lens chips jump to 16–50 mm; pinching goes anywhere in between and the frame label shows the focal length live.
- **Walk** at a seated (3′-6″), eye (5′-0″) or high (6′-0″) camera height.
- **Viewpoints**: the camera presets plus your own saved shots (**＋ Save this view**), which keep their lens, aspect and position and travel with the layout code.
- **Light**: exposure (±2 EV; double-tap to reset) and the lighting scene.
- **Shutter** (or `Space`): renders exactly the frame at 2K, 3K or 4K on the long edge, JPEG or PNG, with no labels or outlines; by default with the glow and soft area light for the shot only, so the live view stays fast.
- **After the shot**: **Share to an app…** (the phone's share sheet: a render or AI app, Photos, Messages), **Download**, **Copy**, and for render apps: **Scene + camera (.glb)**, the whole room and furniture in metres with a glTF camera that matches the shot (Blender, D5, SketchUp, Twinmotion open it with the same framing), and **Camera data** (position, look-at, focal length, sensor, field of view, aspect and the lens shift to set when straight verticals is on).
- `Esc` or ✕ leaves photo mode; editing is off while it's open, so taps only move the camera.

## Press and hold (touch-first editing)

Built for phones first; on by default and switchable under **Furnish › Press and hold to edit**.

- **Hold a piece** (a ring fills under your finger, the phone buzzes): it lifts off the floor. Keep your finger down and drag to move it; let go and its menu slides up from the bottom.
- **A quick tap never selects**, so one finger can orbit the room without bumping furniture. Tapping empty floor closes the menu.
- **Hold the floor** to open **Add here**: the piece lands on that spot, seats turn to face the TV, and if it's too big for the spot it goes to the nearest place it fits. Holding a rug selects the rug; its menu has **Add here** too.
- **The menu** is a bottom sheet that stays out of the way. It opens as a slim strip (about 150 px on a phone) with the name, quick actions (rotate 15° / 90°, **Face TV**, **Face fire**, copy, **3D file**, undo, delete) and tabs that appear only when the piece has them: **Colour**, **Fabric** or **Finish**, **Style**, **Layout** and **Size**. Tap a tab to open its options; tap it again, or touch the room, to fold back to the strip. Swipe the grip up for more room and down to fold or close.
- **The room stays in view**: on a phone the 3D picture (and Plan) shifts up by half the sheet's height so the room centres in the part you can see, and if the piece you picked is hidden behind the sheet the camera glides to it. The camera presets hide while the sheet is up.
- **Hold a wall** to open **Hang on this wall**: frames, a gallery wall, mirrors, shelves, sconces and acoustic panels land flat on that wall at the height you held.
- **Walls are solid**: dragging, nudging, turning, copying and adding all keep a piece's footprint on the floor and clear of the stairs and the steel-beam bump. A drag into a wall stops at the wall and slides along it. Turning next to a wall shifts the piece out a little, or says there's no room. A piece that already overlaps a wall (an old layout) can be dragged free but never further in.

## Wayfair Tremee U-sectional

**U-sectional · Tremee** models the Latitude Run *Tremee U Shaped Sectional Sofa Sleeper Sofa Couch With Storage* from Wayfair, built to the listing's dimension sheet:

| Part | Size | Check |
| --- | --- | --- |
| Overall | 134.2″ W × 79.6″ D × 33.9″ H | 5 × 24.8″ seats + 2 × 5.1″ arms = 134.2″ |
| Seat module | 24.8″ W × 30″ D, seat 17.7″ high, 18.9″ usable depth | 54.8″ chaise − 24.8″ ottoman = 30″ |
| Back cushion | 18.1″ tall, top at 33.9″ | back frame + cushion = 30 − 18.9 = 11.1″, so the 43.7″ label = 54.8 − 11.1 |
| Arm | 5.1″ wide × 27.2″ high, full depth | |
| Ottoman (×3) | 24.8″ square × 17.7″ high | the spec table says 25.6″; the drawing's 24.8″ is the one that adds up |
| In the box | 10 packages: 5 seats, 3 ottomans, 2 arms | |

The 79.6″ depth is the drawing's layout: a long chaise (seat + two ottomans) on one end and a single chaise on the other. The listing photo instead shows a chaise at each end and the third ottoman loose in front (93.5″ deep with a 14″ gap).

- **Fabric** offers the four Wayfair options: Green Corduroy, Grey Polyester, Grey Velvet and Light Corduroy (the listing cuts the fourth name off at "Ligh…"), in a new **Jumbo corduroy** cover, plus every other cover in the planner.
- **Configurations** (one tap, in Layout): **1 · U + loose ottoman** (listing photo), **2 · Long chaise, left**: the loose ottoman joins the end of the left chaise (134″ × 80″, the dimension sheet), **3 · Long chaise, right** (mirrored) and **Sleeper**. Left and right are as you face the sofa.
- **Layout**: 3–7 seats; chaises at both ends (U), *Long left + right* (as dimensioned), *Left + long right*, left, right or none; the loose ottoman in front or put away; arms or armless; the listing photo's throw pillows on or off; and **Sleeper (bed)** mode, which pulls the ottomans in front of the middle seats into one bed deck. A badge says whether the layout uses only what's in the box (5 seats, 3 ottomans).
- **Style**: *Tremee, as sold* or *Cloud pillow-back* (overstuffed cushions, lower back).
- The price is an indicative range, not Wayfair's.

### Download a 3D file

Any piece can be downloaded as a **.glb** (binary glTF) with its current fabric, colour and layout: **3D file** in the press-and-hold menu, or **3D file (.glb)** in the details panel. Files are in metres, Y up, front facing +Z, and open in Blender, SketchUp (glTF importer), Windows 3D Viewer, Android Scene Viewer and most web viewers. Corduroy ribs come through as a colour texture; glTF has no bump maps.

Ready-made files in [`models/`](models/):

- `tremee-u-sectional-green-corduroy.glb`: as in the listing photo (U with the loose ottoman), 134.2″ × 93.5″ × 33.9″
- `tremee-u-sectional-as-dimensioned.glb`: as in the dimension drawing (long left chaise), 134.2″ × 79.5″ × 33.9″

## Must Société Pretty sectional

**Pretty sectional · Must** models the Must Société *Pretty – Fabric Modular Sectional Sofa* (SKU 906121): a low corner L in a textured bouclé, with open, fully rounded ends and lumbar pillows against low, thick backs.

| Part | Size | Source |
| --- | --- | --- |
| Overall | 127″ W × 93″ D × 26″ H | product page |
| Seat | 14″ high, 20″ deep | product page |
| Modules | 30″ deep with a 10″ back (leaving the 20″ seat); long run = 30″ corner + 30″ middle + 67″ end; short run = 30″ corner + 63″ end | read from the photo to fit the totals |
| Open ends | the back stops 28″ short of each end; the seat finishes in a half-round | photo |

- **Fabric**: the four colours on the product page (Light grey, Taupe, Light blue, Green) are listed first, plus every other cover.
- **Layout**: 0–3 middle modules (the listing has 1), the short end on the left as pictured or on the right, lumbar pillows on or off.
- Price shown is the listed $3,796 (or $3,036.80 on the Black Friday sale), scaled for extra middles; lead time is a guess.
- Ready-made 3D file: [`models/pretty-sectional-green.glb`](models/pretty-sectional-green.glb), 127″ × 93″ × 26″.

## Wall décor

Six wall pieces, under **Furnish** or by holding a wall (or the floor: they go on the nearest wall):

| Piece | Styles | Options |
| --- | --- | --- |
| Picture frame | wood, thin metal, floating, gallery canvas | six artworks (warm abstract, dusk landscape, botanical, film poster, B&W photograph, line drawing), white mat or none, any size |
| Gallery wall | wood or black metal frames | 3, 5 or 6 (grid) frames, mixed or matching art |
| Mirror | round, arch, rectangle | brass, black or nickel; size |
| Wall shelf | styled floating shelf, picture ledge with leaning frames | wood, length |
| Wall sconce | opal globe, swing-arm, up/down cylinder | metal; it lights up with the lamps |
| Acoustic panel | fabric (any cover and colour) or wood slats on felt | size; counts towards the acoustics score |

- Wall pieces hang flat on the wall, facing the room, and on the face of the slats where a wall has them. Their centre height is in **Size** (57″ is gallery eye level: the **57″ eye** button).
- **Hold one and drag** to slide it along the wall and up or down, or across to another wall. In the menu, **Up / Down** move it 2″ and **Slide** moves it 4″ along the wall; arrow keys do the same on a keyboard.
- They stay inside the wall, under the ceiling or bulkhead, and step aside so they never cover the fireplace, the windows above it or the TV.
- Art is drawn by the planner (no images to download), so it works offline once loaded.

## Furniture style study (phase two)

The **Style** tab dresses the whole room in one of six curated furniture sets and helps you pick the best one:

| Set | Character |
| --- | --- |
| Warm Modern | Walnut, soft taupe and ivory bouclé: the original plan |
| Mid-century Modern | Walnut on tapered legs, rust tweed, mustard and teal |
| Japandi | Low modular seating, oatmeal linen, white oak, jute and paper light |
| Industrial Loft | Cognac leather, black steel, reclaimed timber, vintage rug |
| Luxe Lounge | Forest velvet, travertine and brass |
| Performance Theatre | Graphite performance fabric, power-reclining seats, matte black |

- **Real geometry, not just colour**: six sectional styles (track arm, low modular, tufted on tapered legs, slope-arm leather, channel-tufted velvet, power-reclining with headrests), five lounge chairs, five coffee tables, three ottomans, three poufs, six rugs, six media consoles, four side tables, five floor lamps and three plants, in leather, velvet, bouclé, tweed, linen, knit, walnut, oak, travertine, marble and brass.
- **Scores out of 100** on eight criteria: movie comfort, screen contrast, acoustics, durability and care, hangout flexibility, budget, lead time and fit with the room. They are computed from the pieces actually in your layout (cover performance, surface tone and sheen facing the screen, absorption by area, prices, lead times) and weighted by **your priorities** (sliders, or the Balanced / Cinema first / Hangout first / Budget first presets).
- **Compare all six**: a full-screen view with each set rendered from the same camera (fireplace lounge, sofa to screen, sectional or whole room), score bars, indicative budget, longest lead time, strengths and watch-outs, plus your own star rating, notes, a shortlist and a final pick. A scorecard table puts every criterion side by side.
- **Mix and match**: select any piece to change its style, cover, colour, wood, metal or stone on its own; the Style tab then shows "Your mix" with its own score and budget, and *Reset to set* puts it back.
- **Spec sheet**: a furniture schedule (FF&E) for the current layout or any set, with tags, specifications, cover performance, sizes, quantities, indicative CAD prices and lead times; copy it as CSV or print it.

Ratings, notes, the shortlist and your pick are saved in the browser and travel with the layout code; Undo never erases them. Prices are indicative 2026 CAD mid-market ranges, and scores are a planning aid, not lab measurements.

## Design review No. 02 (PDF)

[`presentation/review/`](presentation/review/) holds a 50-page, 17 × 11 in design review of the furniture, finishes and light, rendered from this planner: all seven collections (the six sets plus the recommended **Warm Modern · Cinema Edit**) from the same cameras in five lighting scenes, the fireplace wall with slats across the windows **with and without a stone slab surround**, walnut slats behind the TV, scorecards, budgets, an FF&E schedule, a trade-quote scope and a timeline. A screen edition, a print edition, the recommended scheme as a layout code, and the pipeline that regenerates it (`presentation/review/tools/make-review.sh`).

## Design options

The design review in [`presentation/`](presentation/) is built into the planner:

- **Furnish › Design option**: switch between the **Original plan** and the **Recommended** version (Undo goes back).
- **Finishes › Fireplace wall looks**: five one-click fixes for the "robot face": *Glow band + bench*, *Black frame + ledge*, *Hidden windows + stone*, *Black band + art* and *Linen shade + shelves*.
- **Finishes › Windows above the fireplace**: *As built*, *Slats across + glow band*, *One black frame* (a steel surround and mullion that make the pair read as one window), *Hidden behind slats* (slats and felt close over both), *Black band, wall to wall* or *One linen shade*. The window openings themselves never move; they are already cut.
- **Finishes › Around the fireplace**: a mantel ledge, a full-width floating walnut bench, a picture ledge with art, a stone slab surround, or open shelves either side.
- **TV details**: a 100–120″ drop-down screen in the alcove bulkhead with a ceiling projector; the viewing report switches to the screen when it is down and warns if it is too wide for the alcove.
- **Lighting**: a *Game night* scene, a 6500K bias light behind the TV, stair step lights, and a switch for the two pot lights over the TV.
- **Room › Overlays › Speaker pre-wire plan (5.1.2)**: where to run speaker wire while the ceiling is open, placed from the prime seat.
- New catalogue pieces: pouf and bar cart; the Recommended layout puts a reading lamp in the lounge's south-west corner, out of the path.

## Editing the code

The page is built from small source files:

```
src/styles.css        UI styles
src/body.html         UI markup
src/js/00-core.js     units, default design, room geometry, history
src/js/10-materials.js procedural textures (wood, bouclé, rugs, reeded glass) and finishes
src/js/20-room.js     floor, walls with openings, ceiling, bulkheads, pilaster
src/js/25-fixtures.js stairs, slat walls, fireplace with animated flames, transoms, TV
src/js/30-lights.js   pot lights, LED channels, lighting scenes
src/js/40-furniture.js furniture catalogue and factories (every style variant)
src/js/43-pretty.js    Must Société Pretty sectional (curved modular L)
src/js/42-decor.js     wall décor: frames, gallery wall, mirrors, shelves, sconces, acoustic panels, procedural art
src/js/45-styles.js    style sets, upholstery library, prices, lead times, scoring, spec sheet rows
src/js/46-decor-styles.js wall décor variants, prices and default finishes
src/js/50-view.js     renderer, cameras, presets, walk mode, plan dimensions, viewing maths
src/js/55-edit.js     picking, dragging, measuring, keyboard
src/js/57-collide.js  footprints, walls and obstacles: keeps furniture on the floor and wall pieces on walls
src/js/58-hold.js     press and hold gestures, the bottom-sheet furniture menu, Add here
src/js/59-export.js   download a piece as a .glb 3D file
src/js/60-ui.js       design panel tabs
src/js/62-style-ui.js  Style tab, per-piece style controls, compare view, spec sheet
src/js/65-inspector.js details panel, layout code dialog
src/js/68-photo.js     photo mode: lenses, framing, straight verticals, shutter, share and scene export
src/js/70-main.js     boot and render loop
presentation/         design review: renders, slide sources and a readable README
presentation/review/  design review No. 02: PDFs and the pipeline that renders and composes them
```

The JS files are fragments of one ES module and are concatenated in name order. After editing, rebuild `index.html`:

```
node build.mjs
```

World units are inches. Plan coordinates: `x` runs from the fireplace wall toward the exterior wall, `y` from the staircase wall toward the TV wall.
