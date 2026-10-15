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
| Hallway | 54″ deep behind the stairs, two doors | photos |
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

## Design options

The design review in [`presentation/`](presentation/) is built into the planner:

- **Furnish › Design option**: switch between the **Original plan** and the **Recommended** version (Undo goes back).
- **Finishes › Fireplace wall looks**: five one-click fixes for the "robot face": *Glow band + bench*, *Black frame + ledge*, *Hidden windows + stone*, *Black band + art* and *Linen shade + shelves*.
- **Finishes › Windows above the fireplace**: *As built*, *Slats across + glow band*, *One black frame* (a steel surround and mullion that make the pair read as one window), *Hidden behind slats* (slats and felt close over both), *Black band, wall to wall* or *One linen shade*. The window openings themselves never move; they are already cut.
- **Finishes › Around the fireplace**: a mantel ledge, a full-width floating walnut bench, a picture ledge with art, a stone slab surround, or open shelves either side.
- **TV details**: a 100–120″ drop-down screen in the alcove bulkhead with a ceiling projector; the viewing report switches to the screen when it is down and warns if it is too wide for the alcove.
- **Lighting**: a *Game night* scene, a 6500K bias light behind the TV, stair step lights, and a switch for the two pot lights over the TV.
- **Room › Overlays › Speaker pre-wire plan (5.1.2)**: where to run speaker wire while the ceiling is open, placed from the prime seat.
- New catalogue pieces: pouf and bar cart.

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
src/js/40-furniture.js furniture catalogue and factories
src/js/50-view.js     renderer, cameras, presets, walk mode, plan dimensions, viewing maths
src/js/55-edit.js     picking, dragging, measuring, keyboard
src/js/60-ui.js       design panel tabs
src/js/65-inspector.js details panel, layout code dialog
src/js/70-main.js     boot and render loop
presentation/         design review: renders, slide sources and a readable README
```

The JS files are fragments of one ES module and are concatenated in name order. After editing, rebuild `index.html`:

```
node build.mjs
```

World units are inches. Plan coordinates: `x` runs from the fireplace wall toward the exterior wall, `y` from the staircase wall toward the TV wall.
