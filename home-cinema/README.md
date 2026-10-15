# Basement Cinema Planner

An interactive three.js model of the basement home cinema (Room 1 on the foundation plan, plus the strip past the W200 steel beam up to the fireplace wall). Use it to try furniture layouts, TV sizes, finishes and lighting before building.

Open `index.html` in a recent desktop or mobile browser. It loads three.js r160 and the fonts from public CDNs, so it needs an internet connection. Nothing else to install.

## What's modelled

| Element | Value | Source |
| --- | --- | --- |
| Fireplace wall → exterior wall | 228″ (19′-0″) | tape measure |
| Staircase wall → TV wall | 185″ (15′-5″) | tape measure |
| Ceiling | 108″ (9′) | owner |
| TV alcove (bay) | 2′-7″ / 7′-9″ / 2′-7″ faces, 2′-2″ jog to the exterior wall, ~60″ deep, 84″ flat TV wall | foundation plan, photos |
| Alcove bulkhead | follows the bay outline, 12″ deep, underside 7′-8″ | estimated from photos |
| Fireplace-side bulkhead | over the W200 beam, 48″ from the fireplace wall, underside 7′-10″ | estimated from photos |
| Steel beam pilaster | 18″ × 10″ box on the north wall, beam line 33″ from the fireplace wall | plan + photos |
| Stairs | along the staircase wall, rising toward the exterior wall, 11′-6″ opening, open balustrade over a knee wall | plan + photos |
| Fireplace + 2 windows | 52″ linear fireplace, two 42″ × 10″ reeded transoms above | photos |

Everything marked "estimated" can be changed in the **Room** tab; the room rebuilds as you drag.

## Using it

- **3D / Plan / Walk** (keys `1` `2` `3`): orbit the dollhouse, read a dimensioned plan, or walk at eye height (`W A S D` or arrows, drag to look, hold ▲ on touch screens).
- **Camera presets**: Overview, From sofa, TV wall, Fireplace, From stairs.
- **Select and move**: click a piece, drag it on the floor (snaps to ½″). `Q` / `E` rotate 15° (Shift: 45°), `R` turns 90°, arrows nudge 1″ (Shift: 6″), `Del` removes, `Ctrl+D` duplicates, `Ctrl+Z` undoes.
- **TV**: click it to change size (65″–98″), mount height and offset. The details panel reports eye-to-screen distance, the field of view the picture fills (SMPTE 30° / THX 36° references), whether it fits the 84″ alcove wall, neck tilt, and whether it clears the soundbar.
- **Measure** (`M`): click two points. In Plan view points are taken on the floor.
- **Lighting**: Bright, Evening, Movie and Fireside scenes, plus dimmers for the pot lights and the 2700K LED channels, TV, flame and lamps.
- **Finishes**: wall paint, alcove accent colour, floor, slat wood, slats on the fireplace wall and/or behind the TV.
- **Layout code**: copy the whole design as text to keep versions, paste one back to restore it. The latest layout is also saved in the browser.

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
```

The JS files are fragments of one ES module and are concatenated in name order. After editing, rebuild `index.html`:

```
node build.mjs
```

World units are inches. Plan coordinates: `x` runs from the fireplace wall toward the exterior wall, `y` from the staircase wall toward the TV wall.
