# Bosses — content module 34

## Contract and scope

`getBosses(): EnemyDef[]` returns six independent, deep-cloned `EnemyDef` records using the frozen v1 contract. Bosses are inserted into `GameConfig.enemies` by the content registry; a wave spawns them by the public ID below. No battle timers, UI code, economy hooks or engine-specific state live in boss data.

| Wave | ID | Base HP | Speed (px/s) | Initial shield | Armor | Control factor | Layers / bounty |
|---:|---|---:|---:|---:|---:|---:|---|
| 10 | `boss-carapace` | 6,000 | 18 | 300 | 5 | .36 | 5 / 350 |
| 20 | `boss-brood` | 22,000 | 16 | 0 | 3 | .30 | 7 / 1,200 |
| 40 | `boss-mirror` | 65,000 | 17 | 14,000 | 8 | .27 | 6 / 1,800 |
| 60 | `boss-chrono` | 160,000 | 18 | 2,500 | 11 | .20 | 7 / 3,700 |
| 80 | `boss-tempest` | 360,000 | 16 | 50,000 | 13 | .22 | 7 / 7,100 |
| 100 | `boss-eclipse` | 800,000 | 15 | 0 | 34 | .16 | 7 / 14,000 |

These are **initial tuning numbers**, not validated completion thresholds for every map and mode. The engine's difficulty multiplier and cooperative HP multiplier apply once at spawn. The content does not secretly scale HP by map or prevent sales.

## One-shot phases and visible counterplay

Each boss has an initial `boss-<name>.svg` and three transitions when its health falls **to or below** the indicated share of its own original max HP. `speedMul` is a *phase speed multiplier*, not an additive boost. `shield` is the finite new shield amount for the phase, not a constantly regenerated shield. No boss is fully immune to any element, invisible, airborne or permanently immune to control.

| Boss | Phase thresholds | Triggered minions (per phase) | Total | Primary counter / cue |
|---|---|---|---:|---|
| Панцирник | 70%, 35%, 12% | iron ×2 / ×3 / ×1 | 6 | Cannon, armor-piercing needle; outer armor parts fall away |
| Матка осколков | 75%, 50%, 25% | swarm ×8 / ×10 / ×12 | 30 | Cannon splash and frost slow; eggs split open, expanding swarm |
| Зеркальный регент | 74%, 49%, 24% | cloak ×3 / hollow ×4 / cloak ×5 | 12 | Beacon detection plus mixed shots; mirror facets shift and split |
| Пожиратель секунд | 72%, 45%, 20% | dart ×3 / amber ×5 / dart ×6 | 14 | Early route coverage and control; broken dial, accelerating hands |
| Сердце шторма | 73%, 46%, 20% | aegis ×3 / dart ×6 / copper ×5 | 14 | Shield damage + distributed cover; turbulent orbit, lightning |
| Затмение | 75%, 49%, 23% | royal ×2 / aegis ×4 / herald ×2 | 8 | Armor piercing, then shield damage, then end-of-lane burst; open wings |

The chosen summon IDs are all defined in the shared enemy roster. The `children` arrays are intentionally empty: `BossPhase.spawn` is the only source of summoned escorts, avoiding an accidental death cascade. Each phase has a positive `interval`, a fixed count, and a unique descending threshold. The highest total is 30, well below the global live-enemy cap of 1,800; summoned ordinary enemies remain subject to the global generation limit when *their* children split.

### Integration rules for combat (owner: module 02)

- Check `phase.atHealth` against `enemy.hp / enemy.maxHp` after applying the hit. Process all crossed thresholds in **descending threshold order** even for one very large hit. Track a persistent `bossPhaseMask` (or equivalent) in `EnemyState.memory`. Do not emit a phase twice, including after restore, reconnect, overkill or regeneration.
- Trigger `bossPhase` with `target`, `fromVisual` and `toVisual`, using a matching explicit asset path from the table below. The renderer/motion layer should keep the previous shape until the transition event starts; reduced-motion mode may instantly swap shapes. Display a conspicuous HP threshold tick and shield restoration cue.
- Apply the supplied shield once at transition. The ordinary damage calculation must still reach HP after the shield is broken; `bossMultiplier`, armor piercing, slows and detec­tion still work.
- Spawn exactly `count` instances of `spawn` at intervals of `interval` simulation seconds, retaining the parent's lane and route progress. Use bounded schedulers persisted through save/load; burst multi-phase crossing may enqueue several finite groups without duplicating any.
- Respect the global boss control rules (control factor at least .15, hard-control duration at most .5 seconds per use, 2-second subsequent resistance). No absolute stun immunity or perpetual pushback.
- Only *newly crossed and unpaid* `layers` produce credit via the shared runtime. Never award `bounty` again on death, after phase reset, on hit, or after reconnect. The sum of layer `hp` equals `hp`, and the sum of layer `cash` equals `bounty`. Shields have no remunerated layers.
- Include a `boss` identifier in the appropriate `WaveDef` and show the upcoming boss as part of the **previous** wave's preview (9, 19, 39, 59, 79, 99). This is owned by waves/UI modules, not by static enemy data. The information is also stated in the boss description for encyclopedia cards.

The frozen `EnemyDef` has no `visual` or phase asset field. Asset resolution therefore uses this stable convention:

| State | Asset |
|---|---|
| Initial spawn | `/art/bosses/<id>.svg` |
| Crossing phase *n*, n=1..3 | `/art/bosses/<id>/<id>-phase-<n>.svg` |

The `public/art/bosses/preview.html` gallery links to six **offline** `public/art/bosses/<id>/preview.html` pages. Each page displays initial art and all three stages together, with large shape differences beyond mere hue. Transparent 256×256 SVG images are self-contained (no external assets, scripts, or fonts). The viewBox is larger than tower art to preserve boss silhouette at 4K; render using the gameplay radius/zoom rather than SVG intrinsic physical size.

## Early-map calculation: four initially available towers

The first map provides only `needle`, `cannon`, `frost`, `beacon`. Until those tower upgrades and the first map geometry are implemented, an actual strategy win cannot be certified. A **deliberately conservative unupgraded** arithmetic check exposes why an explicit wave override is needed.

For the wave-10 carapace, `armor = 5`, kinetic resistance 10% and frost resistance 12%. With continuous target coverage, no supports or upgrades, no slows, and at most one primary boss target, the nominal damage through armor is:

| One copy each | Damage/interval | Applied boss damage per shot | Sustained DPS |
|---|---|---|---:|
| Needle | 8 / 0.55 s | max(1, 8×.9 − 5) = 2.2 | 4.00 |
| Cannon | 30 / 1.70 s | 30×.9 − 5 = 22 | 12.94 |
| Frost | 5 / 0.90 s | max(1, 5×.88 − 5) = 1 | 1.11 |
| Beacon | support, no damage | 0 | 0 |
| **Total** | | | **18.05** |

For an **illustrative** 1,000-pixel lane, unaccelerated passage takes `1,000/18 = 55.56 s`. Even if every tower shoots for the **entire** route, it can only deal `18.05×55.56 ≈ 1,003` armor-adjusted HP damage before considering the 300 shield — much less than the 6,000 HP boss. The first map therefore cannot be certified using these four unupgraded towers at global stats. Four upgraded towers may perform significantly better, but their actual attack definitions are pending.

**Suggested explicit integration override**, owned by `MapDef.waveOverrides` in module 38:

```ts
// In lantern-garden's waveOverrides, replacing the boss group on wave 10:
10: {groups:[{enemy:'boss-carapace',count:1,at:0,every:1,lane:0,hpMul:0.10}]}
```

The frozen `spawnEnemy` scales HP and shield by `hpMul`: at `.10` the boss starts with 600 HP + 30 shield. If a verified map has ≥1,000 route pixels and the four base towers can remain in range for 70% of passage time, their nominal 55.56×.70×18.05 ≈ **702 HP-equivalent** exceeds the conservative 630 combined HP + shield budget by ~72 (11%). This is an *upper-envelope arithmetic scenario*, not a measured win. It ignores dynamic fire arcs, targeting of accompanying enemies, projectile travel, cooldown alignment, movement and shield-specific behavior. It also ignores useful frost control and support upgrades. Validate with the real map, placements, engine, full wave stream and costs before accepting the override. If coverage is lower than 70%, lower the declared `hpMul` or improve the available build. Do not silently lower base enemy HP in this module.

Across the six unmodified bosses, an illustrative 1,000-pixel lane has these travel times before phase acceleration/control:

| Boss | 1000 / base speed |
|---|---:|
| Carapace | 55.56 s |
| Brood | 62.50 s |
| Mirror | 58.82 s |
| Chrono | 55.56 s |
| Tempest | 62.50 s |
| Eclipse | 66.67 s |

The full route length depends on map and lane. Effective travel time *decreases* when phase speed multipliers exceed 1; it may increase under resisted control. In multiplayer, HP changes with the official player-count multiplier, not a map-specific hidden bonus. Advanced wave balance remains an explicit integration QA item.

## Verification boundary

Run `npm run typecheck`, `npx vitest run tests/content/bosses.test.ts` and `npm run check`. Unit tests assert boss ID/number integrity, strict phase ordering, finite summons/known IDs, finite layer-credit ledgers, ability to scale an enemy with the actual frozen runtime, clone isolation and valid asset inventory/structural differences. They do **not** claim that the still-stubbed base combat module executes phase transitions or that an unavailable full map layout was beaten. Final integration must add actual engine tests for multi-threshold burst, save/load, phase timers, sprite transition events, 1×/3× tick invariance, early-map win and shield/layer payouts.
