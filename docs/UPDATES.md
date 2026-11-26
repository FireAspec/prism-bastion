# Content releases (schema 1)

`src/content/index.ts` is the single catalog entry point. The generated file contains static imports and SHA-256 hashes of public art. It works in Vite and in Node (including Electron's host); no runtime directory scan, network request, dynamic import glob or Node crypto is needed by the renderer.

## Release workflow

1. Add `src/content/towers/<id>.ts` exporting `getTower`, `src/content/maps/<id>.ts` exporting `getMap`, or `src/content/knowledge/<branch>.ts` exporting `getKnowledge`. Stable IDs must not be renamed. Use independent plain data and the frozen contract. Do not put helper `.ts` files in those three discovery directories; move shared utilities outside them.
2. Add the corresponding SVGs under `public/art`. Towers require `base.svg`, `a1.svg` through `c5.svg` (all 15), and the six `a1-overlay.svg` through `c2-overlay.svg`. Maps require `background.svg`; enemies/bosses require their ID-named SVG in `art/enemies` or `art/bosses`. Knowledge icons must resolve to local files, using a full `/art/...` path or a filename relative to `art/knowledge`. Visual muzzle/projectile/impact strings are renderer effect keys, not filenames. The generator hashes actual image bytes and rejects symlink traversal; it checks resource presence and basic SVG identification, not visual quality or full XML safety.
3. Register map progression, prerequisites and rewards in the campaign data. A new tower must be unlocked by some campaign node or be one of the fixed four initial towers. Add the map's unique positive `campaignIndex`; the original 20 maps keep their original index/group. Extra maps may belong to any of the four groups. Add knowledge after the preceding node in the same branch. The original 30 towers, 20 maps (five per base group) and 150 knowledge nodes remain a minimum release floor, not a maximum. Updating the base floor is a future breaking content decision.
4. Increment `CONTENT_VERSION` in `src/content/manifest.ts` (patch for data/asset changes, minor for additional content). Changes to endless generation logic must also bump this version because the closure itself is deliberately not serialized. Do not bump schema or network protocol for ordinary additions. A compatible schema is not permission to connect with different content.
5. Run the generator, validation, catalog tests and complete project checks. Commit the regenerated `src/content/generated.ts` with the content release. After parallel branches merge, regenerate it before testing or packaging.

```sh
node scripts/generate-content.mjs
node scripts/generate-content.mjs --check
node --import tsx scripts/validate-content.mjs
node --import tsx --test tests/catalog/catalog.node.mjs
npm run check
```

`--check` is read-only and fails for a stale registry or image hash. Missing modules, exports and unfinished factories fail generation/typechecking/loading rather than being ignored. Full validation prints the release manifest as JSON; invalid catalogs return a nonzero exit code and diagnostics. `loadContent` refuses invalid content and returns a fresh independent configuration. Never regenerate within a running game.

### Desktop/build integration (module 68)

Proposed package scripts, to be added by the owner of package.json, not this module:

```json
{
  "content:generate": "node scripts/generate-content.mjs",
  "content:validate": "node --import tsx scripts/validate-content.mjs",
  "test:catalog": "node --import tsx --test tests/catalog/catalog.node.mjs"
}
```

Run `content:generate` before typecheck/build in local development. CI should check that the generated file is current (`node scripts/generate-content.mjs --check`) and then validate and run the catalog tests before packaging. Both host and renderer must bundle the same generated file. On Windows, use the same commands in PowerShell. Resource hashes must be refreshed after the final art processing pipeline. Ensure the package includes public art.

## Compatibility

`createManifest(config)` returns the frozen `ContentManifest` fields (`version`, `protocol`, `schema`, ID lists) plus `contentVersion`, `contentDigest` and referenced resource keys. `schema` corresponds to `GameConfig.version`; `protocol` comes from `PROTOCOL_VERSION`; content version is a separate semver string. `contentDigest` is 64 lowercase hexadecimal characters, a synchronous SHA-256 of canonical UTF-8 JSON. The canonical representation sorts dictionary keys and top-level registries by stable IDs (waves by number). Ordered structures such as paths, lane points, layers and spawn groups retain their order. All game data, content version, schema/protocol and hashes of referenced resources are included. The digest field and endless callback itself are excluded. No use of locale-dependent sorting, random values, timestamps or file enumeration order.

A host must check `protocolVersion` and `contentDigest` before joining/rejoining a room, including resume-token requests. `compatibilityError(config, hello)` returns `protocol-mismatch`, `content-mismatch`, or `null`. The host owns actual socket refusal and sends the corresponding `ServerMessage.error` without assigning a player slot; see module 59. The helper is not a replacement for host message validation. An unchanged content version still produces a different digest after data or referenced art bytes change. A stale generated file is a build failure, not a network fallback.

## Additive profile migration example

A release adds `fixture31` to the rewards (`unlocks`) of campaign node `node-1`. An existing profile may already have `node-1` in `completedNodes`. Integrate the following after the persistence module has loaded/migrated the schema and before menus derive available towers:

```ts
import { loadContent, reconcileCampaignRewards } from './content';
const config = loadContent();
const envelope = store.load();
const profile = reconcileCampaignRewards(envelope.profile, config.campaign);
// Preserve the old envelope and profile; do not replay rewards or reset XP.
// Decide separately whether an old in-progress battle is compatible.
store.save({ ...envelope, profile, contentVersion: config.contentVersion });
```

Only update the envelope's content version after the persistence/runtime owner has independently checked its in-progress run, or after the run has been safely archived/ended. Incompatible runs must not be restored against changed prices/geometry; preserve the profile and offer a clear explanation. Never delete unknown saved tower, cosmetic, knowledge, medal or completed-node IDs. The reconciliation is idempotent; it grants only unlocked tower IDs, does not reissue currency, XP, medals or run rewards, and preserves unknown data. It does not change the frozen save format. Call the helper explicitly from integration; this module does not edit the persistence service or app.

## Local verification scope

Catalog tests use test doubles for all content factories. They test SHA-256 against Node crypto, ordering, data and asset mutations, missing resources and references, structural invalidity, 31/21 content expansion, discovery, stale detection, symlinks, a protocol/content compatibility guard and additive migration. The test fixture is not a proof of real campaign balance, real SVG quality, a browser build or a WebSocket server test. Those checks are required at integration with the real content and runtime.
