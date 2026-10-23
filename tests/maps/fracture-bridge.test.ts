import {describe, it, expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {getMap} from '../../src/content/maps/fracture-bridge';
import {distance, distanceToSegment, laneLength, pointOnLane, pointInPolygon} from '../../src/contracts/geometry';
import type {Vec} from '../../src/contracts';
import {candidates, positions, firstVisitTowers, guaranteedGrossCashBefore} from '../../validation/maps/fracture-bridge/strategies';

const map = getMap();
const edges = (poly: Vec[]) => poly.map((p, i): [Vec, Vec] => [p, poly[(i + 1) % poly.length]]);
const fromPoly = (point: Vec, poly: Vec[]) => pointInPolygon(point, poly) ? 0 :
  Math.min(...edges(poly).map(([a, b]) => distanceToSegment(point, a, b)));
const fromRoad = (p: Vec) => Math.min(...map.lanes.flatMap(lane =>
  lane.slice(1).map((b, i) => distanceToSegment(p, lane[i], b))));
const signedArea = (poly: Vec[]) => poly.reduce((sum, a, i) => {
  const b = poly[(i + 1) % poly.length]; return sum + a.x * b.y - b.x * a.y;
}, 0) / 2;

describe('fracture-bridge geometry and campaign contract', () => {
  it('has the correct map, independent copies, two paths and an explicit empty override table', () => {
    expect(map).toMatchObject({id: 'fracture-bridge', campaignIndex: 16, difficulty: 4,
      recommendedDifficulty: 'extreme', pathWidth: 48, theme: 'foundry',
      background: '/art/maps/fracture-bridge/background.svg', waveOverrides: {}});
    expect(map.lanes).toHaveLength(2);
    const mutated = getMap(); mutated.lanes[0][0].x = 999;
    expect(getMap().lanes[0][0]).toEqual({x: 0, y: 174});
  });
  it('uses in-bounds nondegenerate paths and polygons', () => {
    for (const poly of [...map.lanes, ...map.blocked, ...map.water]) {
      for (const p of poly) {
        expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
        expect(p.x).toBeGreaterThanOrEqual(0); expect(p.x).toBeLessThanOrEqual(1280);
        expect(p.y).toBeGreaterThanOrEqual(0); expect(p.y).toBeLessThanOrEqual(720);
      }
    }
    for (const lane of map.lanes) {
      expect(lane.length).toBeGreaterThan(10);
      lane.slice(1).forEach((p, i) => expect(distance(p, lane[i])).toBeGreaterThan(40));
      expect(laneLength(lane)).toBeGreaterThan(1300);
      expect(laneLength(lane)).toBeLessThan(1450);
      expect(laneLength(lane) / 260).toBeGreaterThan(5);
    }
    for (const poly of [...map.blocked, ...map.water]) expect(Math.abs(signedArea(poly))).toBeGreaterThan(300);
  });
  it('shares an unambiguous visible exit and an exposed common bridge', () => {
    expect(map.lanes[0][0]).toEqual({x: 0, y: 174});
    expect(map.lanes[1][0]).toEqual({x: 0, y: 566});
    for (const lane of map.lanes) {
      const junction = lane.findIndex(p => p.x === 560 && p.y === 360);
      expect(junction).toBeGreaterThan(0);
      expect(lane.slice(junction)).toEqual(map.lanes[0].slice(6));
      const end = pointOnLane(lane, laneLength(lane));
      expect(end.x).toBeCloseTo(1280, 8);
      expect(end.y).toBeCloseTo(420, 8);
    }
    expect(pointInPolygon({x: 815, y: 360}, map.water[0])).toBe(true);
  });
  it('keeps blocked areas outside the full 48px road corridor', () => {
    for (const lane of map.lanes) for (let d = 0; d <= laneLength(lane); d += 3) {
      const p = pointOnLane(lane, d);
      for (const poly of map.blocked) expect(fromPoly(p, poly)).toBeGreaterThanOrEqual(23);
    }
  });
  it('offers at least three viable 30px land footprints and two real water positions', () => {
    expect(Object.keys(positions).length).toBeGreaterThanOrEqual(10);
    for (const [name, p] of Object.entries(positions)) {
      expect(p.x).toBeGreaterThan(30); expect(p.x).toBeLessThan(1250);
      expect(p.y).toBeGreaterThan(30); expect(p.y).toBeLessThan(690);
      expect(fromRoad(p), name).toBeGreaterThanOrEqual(54);
      for (const poly of map.blocked) expect(fromPoly(p, poly), name).toBeGreaterThan(30);
      if (name.startsWith('W')) expect(map.water.some(poly => pointInPolygon(p, poly))).toBe(true);
      else for (const poly of map.water) expect(fromPoly(p, poly), name).toBeGreaterThan(30);
    }
    expect(fromRoad(positions.C)).toBeLessThan(110);
    expect(positions.E.x).toBeGreaterThan(940);
  });
  it('supplies legal, chronological and honestly unverified replay plans', () => {
    expect(candidates.map(p => p.modeId)).toEqual(['standard', 'half-cash', 'iron-oath']);
    expect(firstVisitTowers).not.toContain('portal');
    for (const plan of candidates) {
      expect(plan.verified).toBe(false); expect(plan.maxWave).toBe(100);
      const placed = new Set<string>(); let lastTime = 0;
      for (const action of plan.actions) {
        const time = action.wave * 20000 + action.tick;
        expect(time).toBeGreaterThanOrEqual(lastTime); lastTime = time;
        expect(action.wave).toBeGreaterThanOrEqual(1); expect(action.wave).toBeLessThanOrEqual(100);
        expect(action.tick).toBeGreaterThanOrEqual(0);
        if (action.type === 'place') {
          expect(firstVisitTowers).toContain(action.tower);
          expect(placed.has(action.alias)).toBe(false); placed.add(action.alias);
        } else {
          expect(placed.has(action.alias)).toBe(true);
          expect([0, 1, 2]).toContain(action.path);
        }
      }
    }
    expect(guaranteedGrossCashBefore(1, 'standard')).toBe(850);
    expect(guaranteedGrossCashBefore(101, 'standard')).toBe(15950);
    expect(guaranteedGrossCashBefore(101, 'half-cash')).toBe(7975);
  });
  it('ships three offline visual assets without external references or scripts', () => {
    const root = 'public/art/maps/fracture-bridge/';
    const background = readFileSync(root + 'background.svg', 'utf8');
    const thumbnail = readFileSync(root + 'thumbnail.svg', 'utf8');
    const preview = readFileSync(root + 'preview.html', 'utf8');
    for (const svg of [background, thumbnail]) {
      expect(svg).toContain('viewBox='); expect(svg).toContain('</svg>');
      expect(svg).not.toMatch(/<script|(?:href|src)=["']https?:/i);
    }
    expect(background).toContain('M698 0L687 74');
    expect(preview).toContain('background.svg');
    expect(preview).not.toMatch(/(?:href|src)=["']https?:/i);
  });
});
