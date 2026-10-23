/** Emit machine-readable geometry QA: npx tsx validation/maps/fracture-bridge/geometry-report.ts */
import {getMap} from '../../../src/content/maps/fracture-bridge';
import {distance, distanceToSegment, laneLength, pointInPolygon, pointOnLane} from '../../../src/contracts/geometry';
import type {Vec} from '../../../src/contracts';
import {positions} from './strategies';

const map = getMap();
const fromPolygon = (p: Vec, poly: Vec[]) => pointInPolygon(p, poly) ? 0 :
  Math.min(...poly.map((a, i) => distanceToSegment(p, a, poly[(i + 1) % poly.length])));
const fromRoad = (p: Vec) => Math.min(...map.lanes.flatMap(lane =>
  lane.slice(1).map((b, i) => distanceToSegment(p, lane[i], b))));
const lanes = map.lanes.map((lane, index) => {
  const length = laneLength(lane);
  const minSegment = Math.min(...lane.slice(1).map((p, i) => distance(p, lane[i])));
  let blocked = Infinity;
  for (let d = 0; d <= length; d += 2) {
    const p = pointOnLane(lane, d);
    for (const poly of map.blocked) blocked = Math.min(blocked, fromPolygon(p, poly));
  }
  return {index, lengthPx: +length.toFixed(2), minSegmentPx: +minSegment.toFixed(2),
    minBlockedClearancePx: +blocked.toFixed(2),
    traverseSecondsWithoutEffects: Object.fromEntries([100, 180, 260].map(speed =>
      [String(speed), +(length / speed).toFixed(2)]))};
});
const placements = Object.entries(positions).map(([id, pos]) => {
  const blocked = Math.min(...map.blocked.map(poly => fromPolygon(pos, poly)));
  const water = map.water.some(poly => pointInPolygon(pos, poly));
  const waterDistance = Math.min(...map.water.map(poly => fromPolygon(pos, poly)));
  const road = fromRoad(pos);
  return {id, pos, terrain: id.startsWith('W') ? 'water' : 'land',
    minRoadClearancePx: +road.toFixed(2), minBlockedClearancePx: +blocked.toFixed(2),
    safeForRadius30: road >= map.pathWidth / 2 + 30 && blocked > 30
      && (id.startsWith('W') ? water : waterDistance > 30)};
});
const inBounds = [...map.lanes.flat(), ...map.water.flat(), ...map.blocked.flat()].every(p =>
  Number.isFinite(p.x) && Number.isFinite(p.y) && p.x >= 0 && p.x <= 1280 && p.y >= 0 && p.y <= 720);
const pass = inBounds && lanes.every(l => l.minSegmentPx > 0 && l.minBlockedClearancePx >= 24)
  && placements.every(p => p.safeForRadius30);
process.stdout.write(JSON.stringify({schema: 1, mapId: map.id, status: pass ? 'pass' : 'fail',
  world: {width: 1280, height: 720}, pathWidthPx: map.pathWidth, sampledEveryPx: 2,
  inBounds, lanes, placements,
  caveat: 'Static geometry and constant-speed estimates only; not a combat victory.'}, null, 2) + '\n');
if (!pass) process.exitCode = 1;
