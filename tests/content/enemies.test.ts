import {describe,expect,it} from 'vitest';
import {existsSync,readFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {getEnemies} from '../../src/content/enemies';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const enemies=getEnemies();
const byId=new Map(enemies.map(e=>[e.id,e]));
const ids=['scarlet','amber','lemon','jade','azure','violet','iron','glass','cloak','regrow','shield','split','ruby','glacier','copper','obsidian','dart','swarm','aegis','royal','hollow','prismatic','juggernaut','herald'];

function budget(id:string,ancestors:string[]=[]):number {
  if(ancestors.includes(id)) throw new Error(`Cycle ${id}`);
  if(ancestors.length>3) throw new Error(`Generation >3 at ${id}`);
  const enemy=byId.get(id);
  if(!enemy) throw new Error(`Unknown child ${id}`);
  return enemy.bounty+enemy.children.reduce((sum,c)=>sum+c.count*budget(c.id,[...ancestors,id]),0);
}

describe('enemy catalogue v1',()=>{
  it('has precisely 24 stable normal IDs in their design order',()=>{
    expect(enemies.map(e=>e.id)).toEqual(ids);
    expect(new Set(ids).size).toBe(24);
    expect(enemies.every(e=>!e.boss)).toBe(true);
  });

  it.each(enemies)('$id: valid stats, income shells and countermeasure',e=>{
    expect(e.name.length).toBeGreaterThan(2);
    expect(e.description.length).toBeGreaterThan(50);
    expect(e.description).toMatch(/урон|башн|оруж|щит|огон|огн|брон|замедлен|выстрел|ловуш|площад|обнаруж|контрол|пробит|перехват|перекр/i);
    expect(e.hp).toBeGreaterThan(0);
    expect(e.speed).toBeGreaterThan(0);
    expect(e.radius).toBeGreaterThan(0);
    expect(e.bounty).toBeGreaterThan(0);
    expect(e.leak).toBeGreaterThan(0);
    expect(e.armor).toBeGreaterThanOrEqual(0);
    expect(e.shield).toBeGreaterThanOrEqual(0);
    expect(e.regen).toBeGreaterThanOrEqual(0);
    expect(typeof e.cloaked).toBe('boolean');
    expect(typeof e.flying).toBe('boolean');
    expect(e.layers.length).toBeGreaterThan(0);
    expect(e.color).toEqual(e.layers[0]!.color);
    expect(e.layers.reduce((sum,layer)=>sum+layer.hp,0)).toBe(e.hp);
    expect(e.layers.reduce((sum,layer)=>sum+layer.cash,0)).toBe(e.bounty);
    for(const layer of e.layers) {
      expect(layer.hp).toBeGreaterThan(0);
      expect(Number.isSafeInteger(layer.hp)).toBe(true);
      expect(layer.cash).toBeGreaterThan(0);
      expect(Number.isSafeInteger(layer.cash)).toBe(true);
      expect(layer.color).toMatch(/^#[0-9a-f]{6}$/);
    }
    for(const [element,value] of Object.entries(e.resist)) {
      expect(['kinetic','fire','frost','electric','acid','energy']).toContain(element);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
      expect(value).toBeLessThanOrEqual(.8);
    }
    for(const c of e.children) {
      expect(byId.has(c.id)).toBe(true);
      expect(Number.isSafeInteger(c.count)).toBe(true);
      expect(c.count).toBeGreaterThan(0);
    }
  });

  it('preserves all primary HP, speed, bounty and leak baselines',()=>{
    expect(enemies.map(e=>e.hp)).toEqual([12,22,14,58,35,80,130,25,48,95,95,75,180,160,210,350,70,9,330,450,120,600,1000,1600]);
    expect(enemies.map(e=>e.speed)).toEqual([52,72,115,46,82,58,38,70,65,42,45,48,40,42,44,32,132,95,35,40,75,36,24,28]);
    expect(enemies.map(e=>e.bounty)).toEqual([3,4,4,6,5,7,9,5,7,8,9,4,12,12,13,16,8,1,17,20,10,22,30,40]);
    expect(enemies.map(e=>e.leak)).toEqual([1,1,1,2,1,2,3,1,2,2,2,2,4,3,4,5,2,1,5,6,3,7,10,12]);
  });

  it('has exact stated special properties',()=>{
    expect(byId.get('iron')!.armor).toBe(8);
    expect(byId.get('obsidian')!.armor).toBe(20);
    expect(byId.get('regrow')!.regen).toBe(4);
    expect(byId.get('shield')!.shield).toBe(100);
    expect(byId.get('aegis')!.shield).toBe(300);
    expect(byId.get('ruby')!.resist.fire).toBe(.5);
    expect(byId.get('glacier')!.resist.frost).toBe(.5);
    expect(byId.get('copper')!.resist.electric).toBe(.5);
    expect(enemies.filter(e=>e.cloaked).map(e=>e.id)).toEqual(['cloak','hollow']);
    expect(enemies.filter(e=>e.flying).map(e=>e.id)).toEqual(['dart']);
  });

  it('has acyclic child graphs with ≤3 generations and the exact full budgets',()=>{
    for(const e of enemies) expect(budget(e.id)).toBeGreaterThanOrEqual(e.bounty);
    expect(budget('glass')).toBe(7);
    expect(budget('split')).toBe(10);
    expect(budget('royal')).toBe(40);
    expect(budget('prismatic')).toBe(76);
    expect(budget('herald')).toBe(96);
  });

  it('does not share mutation-prone state between runs',()=>{
    const first=getEnemies();
    first[0]!.layers[0]!.cash=999;
    first[0]!.resist.fire=.9;
    first.find(e=>e.id==='royal')!.children[0]!.id='bad';
    const later=getEnemies();
    expect(later[0]!.layers[0]!.cash).toBe(1);
    expect(later[0]!.resist.fire).toBeUndefined();
    expect(later.find(e=>e.id==='royal')!.children[0]!.id).toBe('split');
  });

  it('ships every independent offline SVG layer and a preview card for each ID',()=>{
    for(const e of enemies) for(let i=0;i<e.layers.length;i++) {
      const filename=`${e.id}${i?'-layer-'+i:''}.svg`;
      const path=resolve(root,'public/art/enemies',filename);
      expect(existsSync(path),filename).toBe(true);
      const body=readFileSync(path,'utf8');
      expect(body).toContain('<svg');
      expect(body).toContain('</svg>');
      expect(body).toContain(`<title>${e.name}`);
      expect(body).toContain(`data-enemy="${e.id}"`);
      expect(body).toContain(`data-shell="${i}"`);
      expect(body).toContain(e.layers[i]!.color);
      expect(body).not.toMatch(/<(?:script|foreignObject|image)\b|<!DOCTYPE|(?:href|src)\s*=\s*["']\s*https?:/i);
    }
    const preview=readFileSync(resolve(root,'public/art/enemies/preview.html'),'utf8');
    for(const id of ids) expect(preview).toContain(`data-id="${id}"`);
    expect(preview).toContain('Полный распад с потомками');
  });
});
