import { describe, expect, it } from 'vitest';
import { createEnemyMotion, ENEMY_MOTION_IDS } from '../../../src/render-animations/enemies';
import { advance, enemy, event, state, fixtureConfig } from './fixture';

describe('enemy motion', () => {
  it('covers 30 distinct archetypes and produces finite samples', () => {
    expect(new Set(ENEMY_MOTION_IDS).size).toBe(30);
    const s = state(ENEMY_MOTION_IDS.map((id, i) => enemy(`e${i}`, id))), m = createEnemyMotion();
    m.reset(s); advance(s, .12); m.update(.12, s);
    for (const e of s.enemies) { const a = m.sample(e.id); expect([a.offset.x, a.offset.y, a.rotation, a.scale, a.glow, a.opacity].every(Number.isFinite)).toBe(true); }
    expect(m.sample('e16').offset.y).toBeLessThan(0);
  });
  it('keeps all same-tick layer events and their contact, without mutating economy or regen replay', () => {
    const e = enemy('e'), s = state([e]), m = createEnemyMotion(); m.reset(s);
    e.paidLayers = [0, 1, 2]; e.hp = 10; e.shield = 0;
    const a = event(s, 'layerBreak', e.id, {x: 21, y: 5}, {layer: 0}), b = event(s, 'layerBreak', e.id, {x: 24, y: 6}, {layer: 1}), c = event(s, 'layerBreak', e.id, {x: 25, y: 7}, {layer: 2}), d = event(s, 'shieldBreak', e.id, {x: 30, y: 8});
    const before = JSON.stringify(s); m.consume([d, b, a, c, a], s); expect(JSON.stringify(s)).toBe(before);
    expect(m.effects().map(x => x.id)).toEqual([a.id, b.id, c.id, d.id]); expect(m.effects().map(x => x.pos)).toEqual([a.pos, b.pos, c.pos, d.pos]); expect(m.appearance(e.id)?.layer).toBe(3);
    e.hp = 95; advance(s, .1); m.consume([a,b,c,d], s); expect(m.effects().length).toBe(4); expect(m.appearance(e.id)?.layer).toBe(3);
    const repeated = event(s, 'layerBreak', e.id, {x: 28, y: 8}, {layer: 0}); m.consume([repeated], s); expect(m.effects().length).toBe(4);
    const missing = event(s, 'layerBreak', e.id, undefined, {pos: undefined}); m.consume([missing], s); expect(m.effects().length).toBe(4);
  });
  it('does not replay reconnect history and permits new events', () => {
    const s = state([enemy('e')]), m = createEnemyMotion(), old = event(s, 'shieldBreak', 'e'); m.consume([old], s); expect(m.effects()).toEqual([]);
    const fresh = event(s, 'hit', 'e'); m.consume([fresh,old], s); expect(m.effects().map(x=>x.id)).toEqual([fresh.id]);
    m.reset(s); m.consume([fresh], s); expect(m.effects()).toEqual([]);
    const next = event(s, 'bossPhase', 'e'); m.consume([next], s); expect(m.effects().length).toBe(1);
  });
  it('bounds 200 simultaneous deaths, expires tails and effects, respects low quality', () => {
    const s = state(Array.from({length:200}, (_,i)=>enemy(`e${i}`))), m = createEnemyMotion(); m.reset(s);
    const events = s.enemies.map(e=>event(s,'kill',e.id)); s.enemies=[]; m.consume(events,s); expect(m.effects().length).toBe(192); expect(m.tails().length).toBe(120);
    m.setPreferences({quality:'low',reducedMotion:false,colorblind:true}); expect(m.effects().length).toBe(64); expect(m.tails().length).toBe(40);
    for(let i=0;i<10;i++){advance(s,.1);m.update(.1,s);} expect(m.effects()).toEqual([]);expect(m.tails()).toEqual([]);expect(m.sample('e199').opacity).toBe(1);
    m.dispose();m.consume(events,s);expect(m.effects()).toEqual([]);
  });
  it('smooths heading from progress rather than selecting a route by screen coordinates', () => {
    const e=enemy('e','iron'),s=state([e]),m=createEnemyMotion();m.reset(s);e.progress=10;e.pos={x:10,y:0};advance(s,.1);m.update(.1,s);
    e.progress=20;e.pos={x:10,y:10};advance(s,1/60);m.update(1/60,s);const a=m.sample('e').rotation;expect(a).toBeGreaterThan(0);expect(a).toBeLessThan(1);
    const before=JSON.stringify(e); e.progress=1;e.pos={x:0,y:0};advance(s,1/60);m.update(1/60,s);expect(Math.abs(m.sample('e').rotation-a)).toBeLessThan(.4);expect(before).not.toBe(JSON.stringify(e));
  });
  it('uses the lane and progress at an actual self-intersection, not nearest geometry', () => {
    const lane = [{x:0,y:0},{x:100,y:100},{x:0,y:100},{x:100,y:0}];
    const cfg = fixtureConfig(['iron'], [{id:'fixture',name:'Cross',description:'',difficulty:1,campaignIndex:1,recommendedDifficulty:'normal',waveOverrides:{},lanes:[lane],pathWidth:20,blocked:[],water:[],theme:'garden',background:''}]);
    const a=enemy('a','iron'),b=enemy('b','iron'); a.pos=b.pos={x:50,y:50}; a.progress=Math.sqrt(5000); b.progress=Math.sqrt(20000)+100+Math.sqrt(5000);
    const s=state([a,b]),m=createEnemyMotion(cfg);m.reset(s);m.setReducedMotion(true);
    expect(m.sample('a').rotation).toBeGreaterThan(.7);expect(m.sample('b').rotation).toBeLessThan(-.7);
  });
  it('reveals the next configured shell color and expires leak tails at 3x', () => {
    const e=enemy('e'),s=state([e]),m=createEnemyMotion(fixtureConfig(['scarlet']));m.reset(s);
    const old=m.appearance('e')?.color;e.paidLayers=[0,1];e.hp=40;m.consume([event(s,'layerBreak','e',{x:8,y:7},{layer:0}),event(s,'layerBreak','e',{x:9,y:7},{layer:1})],s);
    expect(m.appearance('e')?.color).not.toBe(old);expect(m.effects()[0].color).toBe(old);
    const leak=event(s,'leak','e');s.enemies=[];m.consume([leak],s);expect(m.tails().length).toBe(1);s.speed=3;advance(s,.2);m.update(.2,s);expect(m.tails()).toEqual([]);expect(m.effects()).toEqual([]);
  });
  it('respects pause, reduced motion and authoritative active statuses', () => {
    const e=enemy('e','dart'),s=state([e]),m=createEnemyMotion();m.reset(s);e.statuses=[{kind:'freeze',source:'f',remaining:1,power:1,duration:1,stacks:1}];m.consume([event(s,'hit','e')],s);
    expect(m.appearance('e')?.statuses).toEqual(['freeze']);expect(m.sample('e').offset).toEqual({x:0,y:0});
    s.paused=true;const a=m.sample('e');m.update(.2,s);expect(m.sample('e')).toEqual(a);m.setReducedMotion(true);expect(m.sample('e').scale).toBe(1);expect(m.sample('e').offset).toEqual({x:0,y:0});
  });
});
