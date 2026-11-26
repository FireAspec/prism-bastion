import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import * as art from '../../src/art/index.ts';
const paths = [...art.resourceIds.map(art.resourceArt), ...art.difficultyIds.map(art.difficultyArt), ...[1,2,3,4].map(art.mapGroupArt), ...art.modeIds.map(art.modeArt), ...art.statusIds.map(art.statusArt), ...art.controlIds.map(art.controlArt), ...art.decorationIds.map(art.decorationArt), ...art.frameIds.map(art.frameArt)];
assert.equal(art.enemyArt('scarlet'), './art/enemies/scarlet.svg');
for (const id of ['boss-carapace','boss-brood','boss-mirror','boss-chrono','boss-tempest','boss-eclipse']) assert.equal(art.enemyArt(id), `./art/bosses/${id}.svg`);
assert.equal(art.mapArt('lantern-garden'), './art/maps/lantern-garden/background.svg');
for (const id of ['', '../evil', 'a/b', 'a\\b', 'a.svg', 'a?b', '%2e%2e', ' A', 'a\n']) {
  assert.throws(() => art.enemyArt(id), RangeError);
  assert.throws(() => art.mapArt(id), RangeError);
}
assert.throws(() => art.mapGroupArt(0), RangeError);
assert.throws(() => art.resourceArt('unknown'), RangeError);
assert.equal(new Set(paths).size, 54);
for (const path of paths) {
  const file = 'public/' + path.slice(2);
  assert.ok(existsSync(file), file);
  const svg = readFileSync(file, 'utf8');
  assert.match(svg, /<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.doesNotMatch(svg, /<script|<image|<foreignObject|\bhref\s*=|\bon\w+\s*=|url\s*\(/i);
}
console.log('PASS: routing, invalid IDs, and 54 independent SVG assets');
