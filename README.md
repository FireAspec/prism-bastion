# Prism Bastion

An offline Windows tower defense game about rebuilding a lighthouse network after a crystalline storm. Solo and 2–4 player cooperative play.

**Current status: development foundation.** Contracts, design and module boundaries are prepared. The current application shows a development landing screen; gameplay modules, content and Windows executables are not complete.

Planned first release: 30 buildings; three five-tier paths per building (450 upgrades, 90 final specializations); a distinct design for every upgrade; 24 enemies and six bosses; 20 maps across four map grades; independent 40/60/80/100-round difficulty presets; ten challenge modes; story unlocks; five permanent knowledge branches with 30 nodes each; local saves and content updates.

Co-op uses an embedded authoritative host and direct WebSocket connections. LAN is built in; remote friends can use a reachable host address or a virtual LAN. No central paid server is required.

## Development

Node.js 22.12 or newer.

```sh
npm ci
npm run dev
npm run check
```

See [design](docs/DESIGN.md), [interfaces](docs/INTERFACES.md), [module ownership](docs/OWNERSHIP.md) and [art direction](docs/ART.md).

## Core rules

A building can use at most two upgrade paths; only one may exceed tier two. Maximum crosspaths are permutations of 5–2–0. Selling returns exactly floor(0.70 × actual investment), including upgrades after discounts. Removed enemy layers pay once; regrowth never pays again. Permanent profile experience and seals are separate from credits earned during a run.

Map geometry difficulty and run difficulty are independent. The initial four buildings are unlocked by default; the other 26 are recovered through the campaign. Every level must have a replayable solution with the technologies available at that point.

## Validation status

Foundation tests cover upgrade legality, resale accounting and basic path geometry. Their success does not certify the unimplemented gameplay, network play, animations, long-term economy or Windows packaging. Release evidence is specified in docs/DESIGN.md.
