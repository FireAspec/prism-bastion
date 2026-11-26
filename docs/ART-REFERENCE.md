# Common art — Prism Bastion

## Integration

The common art API is `src/art/index.ts`. Paths are relative to the application (`./art/…`), not to the TS module. `enemyArt` routes the six frozen boss IDs to `bosses/`; other syntactically valid IDs go to `enemies/`. `mapArt` returns `maps/<id>/background.svg`. These helpers resolve names, not existence; missing neighbor content must remain visible as an integration error, not be substituted with a generic tower. New boss IDs require an explicit catalog addition. Closed catalogs throw RangeError on invalid IDs; open enemy/map IDs are lowercase ASCII kebab-case only. Keep map background metadata authoritative if a content module explicitly supplies its path.

| API | Display size at 100% (CSS px) | Purpose |
|---|---:|---|
| resourceArt | 24 | credits, XP, doctrine points, seals, lives |
| statusArt | 20 | all nine StatusKind values |
| controlArt | 28 | control glyph within a 44×44 hit target |
| difficultyArt | 32 | run difficulty, not map group |
| mapGroupArt | 32 | map group 1–4 |
| modeArt | 40 | ten run modes |
| decorationArt | 96 world px | optional environmental props |
| frameArt | 320×120 | panel, selected, locked, warning |

Use `artPalette`, `artSizes` and exported ID lists. Reference gallery: `public/art/world/reference/index.html` (opens directly offline). Use `<img>` with a localized label or `alt=""` if adjacent text already labels the control. No state may rely on color alone: captions, counts and accessible names remain DOM text. Never use these decorations to represent collisions, build slots, enemies or towers. Map owner decides position/scale, and blocked polygons remain authoritative. Do not infer placement or line-of-sight from decorative opacity. Frames use a fixed aspect ratio; use CSS border-image or CSS panel borders for other proportions rather than stretch the corner motif.

## Palette and geometry

| Token | Hex | Role |
|---|---|---|
| background | #102B35 | deep teal |
| surface | #21434A | raised panel |
| ink | #11272E | outlines and interior cut lines |
| ivory | #FFF1CA | text, neutral material |
| copper | #C48354 | machinery, metal |
| amber | #FFC95C | energy, credits |
| cyan | #83D8E2 | water, cold, XP |
| violet | #C6A9F5 | doctrine, arcane |
| green | #9BD6AA | growth, acceptance |
| danger | #FF9B85 | alerts, heat |

Icon grid 64×64, centered around 32,32; stroke 3 units, round joins and caps, solid silhouettes with internal dark lines. Decoration grid 64×64 with intrinsic 96×96; transparent perimeter. Frames use 320×120 grid and 3–4 unit strokes. No external fonts, scripts, images, links, filters or animation in SVG. Keep labels out of the vector. 4K uses SVG directly and CSS sizes multiplied by platform scaling; do not raster upscale. Preserve the separate tower convention of 128×128 / pivot 64,64; those assets are not owned here.

Resource silhouettes: faceted coin, four-point star, book, scalloped wax seal, heart. Run difficulty: check shield, marked shield, crossed blades, alert diamond. Map groups use ascending terrain profiles and flags; the displayed group number should accompany the silhouette. Statuses use flame, vial, hourglass, snow crystal, impact star, target, cracked shield, droplet, eye. The frame border uses a dashed locked state; selected and warning must also have a label or icon. Color-vision previews are a design check, not a clinical test.

## Checks
Regenerate only common art with `node tests/art/generate-art.mjs` from the repository root. The checked-in SVGs are runtime resources, not generated at game startup.
Standalone check without Vitest: `node --experimental-strip-types tests/art/verify-art.mjs`.


`npx vitest run tests/art/art.test.ts` checks routing, unsafe input, catalog coverage and SVG independence. `npm run check` is the project-level gate. Open the gallery at normal and enlarged scale; check statuses at 20px, resource glyphs at 24px, and map/run difficulty with their captions. Full in-game HUD layout and native Windows 4K remain integration QA.
