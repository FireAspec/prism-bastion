# Asset quality — 4K preparation

## Scope and release gate

The preparation stage is a developer tool, not part of the game runtime. It never replaces files in `public/art`. The inventory covers all regular files under the supplied art root, including non-image metadata and previews. Required paths follow contract v1: 30 tower sets × 22 SVGs (30 base, 450 upgrades, 180 overlays), 20 map backgrounds, 24 regular enemies, six bosses: 710 required SVGs. Additional UI, effects, enemy layers/phases and animation resources are inventoried if present; their final expected IDs must be reconciled against the integrated content catalog. No final acceptance is inferred from a successful process exit.

## Run (Node 22.12+)

From the repository root, inventory first:

```powershell
node scripts/prepare-assets-4k.mjs --source public/art --stage asset-inventory-01 --inventory
```

Create a local JSON file outside the public source tree (see metadata below). Set environment variables to the actual local Upscayl backend and model directory. The program uses an argument array, no shell interpolation, and hides Windows console windows. The local path is not put in the manifest or package configuration. Use a new staging directory each run, with an existing parent.

```powershell
$env:UPSCAYL_BIN = Read-Host 'Path to upscayl-bin.exe'
$env:UPSCAYL_MODELS = Read-Host 'Path to model directory'
node scripts/prepare-assets-4k.mjs --source public/art --stage asset-quality-run-01 --metadata asset-targets.local.json --select all
```

`--backend` and `--models` override the environment. `--select` accepts comma-separated model names or `all`. Default comparison: digital-art-4x, high-fidelity-4x, remacri-4x. Other supported names: ultramix-balanced-4x, ultrasharp-4x, upscayl-lite-4x, upscayl-standard-4x. The adapter checks the backend help for the seven flags and checks each model's `.param` and `.bin`. It passes `-i`, `-o`, `-m`, `-n`, `-s` (requested output scale), `-z 4` (model scale), `-f png`. Unsupported scale/device/model errors are reported rather than accepted. A timeout terminates the child process. Real backend compatibility and GPU performance must be verified locally.

## Metadata schema and scaling

Keys are POSIX paths relative to the source art root. Target is the maximum **physical** displayed size, measured from the actual renderer/UI at 4K (CSS size × DPR), not an arbitrary 4× increase. Example:

```json
{
  "ui/crystal.png": {"kind":"icon","target":{"width":192,"height":192},"pivot":{"x":32,"y":32}},
  "maps/example/background.png": {"kind":"background","target":{"width":3840,"height":2160}},
  "sprites/idle-0.png": {"kind":"sprite","target":{"width":192,"height":192},"pivot":{"x":48,"y":48},"padding":4,"sequence":"idle","frameIndex":0,"duration":100,"hitbox":{"radius":12}},
  "sprites/idle-atlas.png": {"kind":"atlas","target":{"width":768,"height":192},"pivot":{"x":48,"y":48},"padding":4,"frames":[{"id":"idle0","x":0,"y":0,"width":64,"height":64,"pivot":{"x":32,"y":32},"duration":100,"hitbox":{"radius":12}},{"id":"idle1","x":68,"y":0,"width":64,"height":64,"pivot":{"x":32,"y":32},"duration":120,"hitbox":{"radius":12}}]}
}
```

- `target` for an atlas refers to the full texture's physical-equivalent size; calculate it from the largest required frame-to-source ratio. Integer scale 1–4 is the smallest that meets both axes; above 4× is flagged for redesign. Avoid anisotropic output targets. No processing takes place at scale 1. SVG is copied exactly regardless of target; use target metadata for physical-size gallery comparison.
- Pivots, atlas rectangles and padding are texture pixels; duration is milliseconds; hitboxes must be gameplay/world units and are copied without scaling. Frame IDs/order/duration remain unchanged. Independent sprite sequences start at frameIndex 0, without gaps, with consistent target/padding; the manifest audits dimensions/scales. Use a common accepted model for an entire sequence. Missing or mismatched metadata blocks processing of declared animation groups. Unlabelled PNG assets cannot be reliably classified as animations; catalog reconciliation is mandatory.
- A frame rectangle includes its own transparent margins. Atlas `padding` is a minimum transparent gap between rectangles (at least one pixel). Rotated, trimmed-with-offset, extruded or overlapping atlas formats need an explicit conversion/repack before this tool; opaque pixels outside declared frames and insufficient padding are rejected. No inference of frame layout from filename or grid is performed.
- Supported automatic processing: non-interlaced 8-bit PNG (RGBA, RGB, grayscale, grayscale-alpha and 8-bit palette). Other raster formats, animated PNG, interlaced/16-bit images and images above the 32 MP limit are not silently converted. Convert to lossless sRGB PNG with explicit frame metadata before retrying; keep the source. The codec does not preserve custom ICC/gamma metadata in candidates, so color-profile-sensitive resources must be normalized to sRGB before processing. The original file remains byte-for-byte intact.

## Output and review

Each run emits `manifest.json`, `originals/`, `candidates/<model>/`, `review.html`, `animation-review.html`. Open the review files from the staging directory in a trusted local browser. The manifest stores source/output SHA-256, path, size, status, model and scale per candidate, alpha counts, pivot and metadata, decoded byte estimates and candidate elapsed time. Other file types remain inventoried. SVG checks are conservative static warnings, not a complete XML security sanitizer or a guarantee that the graphic fits its viewBox. Do not open untrusted SVGs in the gallery.

The backend receives opaque RGB with nearest visible color extended into fully transparent texels. Alpha is reconstructed from the original mask using bilinear sampling, independently of the backend result. This avoids blindly upscaling alpha with generated color detail but does not prove absence of halo or silhouette jitter. Atlas frames are cut, processed independently and repacked at the same relative coordinates. Only output PNGs of the exact requested dimensions are accepted as candidates; temporary files are removed. All candidates still require visual approval. Originals and staged copies are never overwritten.

`review.html` compares original and candidates at physical target and 100% pixel size on checkerboard/dark/light mattes. It records decode time, Canvas CSS/physical dimensions, DPR and memory estimates; actual GPU memory and load time are not these estimates. `animation-review.html` aligns pivots, provides step/play at 1×/3× and uses declared durations; it displays only candidates available for every frame. On very long animations the gallery preloads frames, so review in smaller sets if memory is constrained. The player app is not modified.

Acceptance checklist per resource/sequence:

1. Compare native size and actual 4K display size; inspect details and contours, alpha on both dark/light matte, no clipping/halo, visible readability of projectile/attack/upgrade. Reject variants that merely increase file size or sharpen noise.
2. Step through every frame and play at 1×/3×. Reject flickering outline, shifting pivot, inconsistent contours, changed frame duration/count or bleeding. Keep original if no model improves it. Record source and chosen candidate hash, reason and reviewer in integration QA records. Do not mix per-frame models.
3. Verify all `missingExpected`, `unmatchedMetadata`, status failures and SVG warnings; reconcile all extra UI/phase/effect keys against the content catalog. No `releaseAccepted` value is automatically set true. Exit 2 denotes processing failure; inventory-only/missing coverage also requires release review even when exit 0.
4. In final Windows game at native 3840×2160, verify Windows 100/150/200% scale, fullscreen/windowed, text clarity and Canvas backing size equals CSS size × DPR within one pixel. Check viewBox and actual texture filtering, resize, reduced motion, and final combat with many units. Use `validation/asset-quality/runtime-check.mjs` in dev console (Vite serves the module from project root):

   ```js
   const {measureRuntime} = await import('/validation/asset-quality/runtime-check.mjs');
   console.log(await measureRuntime());
   ```

   Capture separate measurements at each DPI and at first/last map, including cold loading, process/GPU memory via Windows Task Manager, and frame timing in late-wave combat. The helper's rAF timings and Canvas memory estimates do not replace OS measurements.
5. Integrator copies only accepted variants, updates texture metadata/keys where needed, reruns inventory/check and Windows build. Never ship the backend, its models, stage folders or local paths.

## Repeatable independent verification

```sh
node --test tests/asset-quality/pipeline.node.mjs
node validation/asset-quality/fixture.mjs quality-fixture
node scripts/prepare-assets-4k.mjs --source quality-fixture/art --stage quality-inventory --metadata quality-fixture/metadata.json --inventory
```

The fixture substitutes nearest-neighbor for the backend and labels it as a test double, not an enhancement. The tests cover PNG roundtrip/CRC, alpha restoration, color extension, scale selection, vector byte identity, multiple candidates, backend failure, atlas separation and order, hitbox preservation, stage path and symlink safety, missing atlas metadata and inconsistent sequence metadata. The independent Node suite is deliberately explicit and uses no package changes. `browser-fixture-results.json` records a Linux Chromium emulation, not actual Windows DPI or final gameplay. The exact base commit had no art and the game renderer was a placeholder; final art, real Upscayl model quality, animation flicker and full game memory/load/performance remain acceptance blockers.
