import type {MapDef, Vec} from '../../contracts';

// The two approaches share every point after the junction: one visible exit.
const fork: Vec = {x: 560, y: 360};
const common: Vec[] = [fork, {x: 680, y: 360}, {x: 940, y: 360},
  {x: 1040, y: 360}, {x: 1110, y: 420}, {x: 1280, y: 420}];
const upper: Vec[] = [{x: 0, y: 174}, {x: 140, y: 174}, {x: 214, y: 230},
  {x: 318, y: 230}, {x: 392, y: 294}, {x: 476, y: 294}, ...common];
const lower: Vec[] = [{x: 0, y: 566}, {x: 140, y: 566}, {x: 214, y: 502},
  {x: 330, y: 502}, {x: 406, y: 428}, {x: 486, y: 428}, ...common];

// The ravine is navigable water. The bridge carries the path over it, but
// its deck is never a valid tower foundation.
const rift: Vec[] = [
  {x: 698, y: 0}, {x: 687, y: 74}, {x: 707, y: 131}, {x: 690, y: 206},
  {x: 705, y: 273}, {x: 687, y: 326}, {x: 691, y: 414}, {x: 712, y: 483},
  {x: 688, y: 549}, {x: 707, y: 632}, {x: 700, y: 720},
  {x: 947, y: 720}, {x: 932, y: 632}, {x: 949, y: 560}, {x: 934, y: 479},
  {x: 951, y: 414}, {x: 944, y: 326}, {x: 957, y: 271}, {x: 934, y: 203},
  {x: 952, y: 133}, {x: 936, y: 66}, {x: 946, y: 0},
];

// Foundry roofs, machinery and four bridge anchor pylons. Rendered details
// outside these polygons remain decorative, not additional obstacles.
const blocked: Vec[][] = [
  [{x: 38, y: 18}, {x: 222, y: 18}, {x: 232, y: 88}, {x: 50, y: 105}],
  [{x: 327, y: 27}, {x: 476, y: 22}, {x: 492, y: 95}, {x: 331, y: 101}],
  [{x: 48, y: 624}, {x: 214, y: 618}, {x: 236, y: 700}, {x: 46, y: 704}],
  [{x: 319, y: 625}, {x: 476, y: 630}, {x: 484, y: 709}, {x: 307, y: 702}],
  [{x: 526, y: 31}, {x: 636, y: 41}, {x: 637, y: 146}, {x: 520, y: 139}],
  [{x: 659, y: 213}, {x: 735, y: 208}, {x: 741, y: 285}, {x: 663, y: 287}],
  [{x: 659, y: 436}, {x: 741, y: 436}, {x: 737, y: 514}, {x: 665, y: 509}],
  [{x: 908, y: 213}, {x: 975, y: 209}, {x: 979, y: 285}, {x: 907, y: 288}],
  [{x: 910, y: 437}, {x: 976, y: 434}, {x: 976, y: 516}, {x: 904, y: 512}],
  [{x: 998, y: 23}, {x: 1186, y: 34}, {x: 1196, y: 132}, {x: 999, y: 129}],
  [{x: 1072, y: 171}, {x: 1236, y: 166}, {x: 1241, y: 251}, {x: 1070, y: 251}],
  [{x: 969, y: 590}, {x: 1037, y: 588}, {x: 1041, y: 700}, {x: 963, y: 705}],
  [{x: 1177, y: 544}, {x: 1265, y: 541}, {x: 1265, y: 705}, {x: 1171, y: 705}],
];

export function getMap(): MapDef {
  // An independent copy prevents accidental mutation of future game runs.
  const copy = (polygons: Vec[][]) => polygons.map(poly => poly.map(p => ({...p})));
  return {
    id: 'fracture-bridge', name: 'Мост раскола',
    description: 'Два литейных тракта сходятся у моста через светящийся разлом. '
      + 'Удержите переправу, откройте транспортный разлом и восстановите портал.',
    difficulty: 4, campaignIndex: 16, recommendedDifficulty: 'extreme',
    waveOverrides: {}, // Canonical 1..100 waves, no speculative substitutions.
    lanes: copy([upper, lower]), pathWidth: 48,
    blocked: copy(blocked), water: copy([rift]),
    theme: 'foundry', background: '/art/maps/fracture-bridge/background.svg',
  };
}
