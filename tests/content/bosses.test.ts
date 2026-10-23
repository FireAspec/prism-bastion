import {readFileSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {describe,expect,it} from 'vitest';
import {getBosses} from '../../src/content/bosses';
import {spawnEnemy} from '../../src/contracts/runtime';
import type {EnemyDef,GameConfig,GameState} from '../../src/contracts';

const expected=[
  ['boss-carapace',6000,18,0.70,0.35,0.12],
  ['boss-brood',22000,16,0.75,0.50,0.25],
  ['boss-mirror',65000,17,0.74,0.49,0.24],
  ['boss-chrono',160000,18,0.72,0.45,0.20],
  ['boss-tempest',360000,16,0.73,0.46,0.20],
  ['boss-eclipse',800000,15,0.75,0.49,0.23],
] as const;
const knownEnemyIds=new Set([
  'scarlet','amber','azure','moss','iron','glass','cloak','regrow','shield',
  'split','ruby','glacier','copper','obsidian','dart','swarm','aegis','royal',
  'hollow','prismatic','juggernaut','herald',
]);
const artRoot=join(process.cwd(),'public','art','bosses');

describe('boss wave catalog',()=>{
  it('contains the six frozen IDs with their canonical base HP and speed',()=>{
    const bosses=getBosses();
    expect(bosses).toHaveLength(6);
    expect(new Set(bosses.map(b=>b.id)).size).toBe(6);
    for(let i=0;i<expected.length;i++){
      expect([bosses[i].id,bosses[i].hp,bosses[i].speed]).toEqual(expected[i].slice(0,3));
    }
  });

  it('describes bounded one-time thresholds with three visual transitions',()=>{
    for(const [i,b] of getBosses().entries()){
      const phases=b.boss?.phases;
      expect(phases).toHaveLength(3);
      expect(phases?.map(p=>p.atHealth)).toEqual(expected[i].slice(3));
      for(let j=0;j<phases!.length;j++){
        const p=phases![j];
        expect(p.atHealth).toBeGreaterThan(0);
        expect(p.atHealth).toBeLessThan(1);
        if(j)expect(p.atHealth).toBeLessThan(phases![j-1].atHealth);
        expect(p.speedMul).toBeGreaterThan(0);
        expect(p.speedMul).toBeLessThanOrEqual(1.65);
        expect(p.shield).toBeGreaterThanOrEqual(0);
        expect(Number.isSafeInteger(p.shield)).toBe(true);
        expect(p.interval).toBeGreaterThan(0);
        expect(Number.isSafeInteger(p.count)).toBe(true);
        expect(p.count).toBeGreaterThan(0);
        expect(knownEnemyIds.has(p.spawn!)).toBe(true);
      }
      // Summon count is bounded per boss lifetime, not repeatable per tick.
      expect(phases!.reduce((n,p)=>n+p.count,0)).toBeLessThanOrEqual(30);
      expect(b.boss!.controlFactor).toBeGreaterThanOrEqual(0.15);
      expect(b.boss!.controlFactor).toBeLessThanOrEqual(1);
    }
  });

  it('pays a fixed finite number of layer crossings rather than damage ticks',()=>{
    for(const b of getBosses()){
      expect(b.layers.length).toBeGreaterThanOrEqual(5);
      expect(b.layers.reduce((total,layer)=>total+layer.hp,0)).toBe(b.hp);
      expect(b.layers.reduce((total,layer)=>total+layer.cash,0)).toBe(b.bounty);
      for(const layer of b.layers){
        expect(Number.isSafeInteger(layer.hp)).toBe(true);
        expect(Number.isSafeInteger(layer.cash)).toBe(true);
        expect(layer.hp).toBeGreaterThan(0);
        expect(layer.cash).toBeGreaterThan(0);
        expect(layer.color).toMatch(/^#[a-f\d]{6}$/i);
      }
      expect(b.children).toEqual([]);
      expect(b.regen).toBe(0);
      expect(b.cloaked).toBe(false);
      expect(b.flying).toBe(false);
    }
  });

  it('has counterplay with available direct attacks and no elemental immunity',()=>{
    for(const b of getBosses()){
      expect(b.armor).toBeLessThan(b.hp);
      expect(b.shield).toBeLessThan(b.hp);
      expect(b.radius).toBeGreaterThanOrEqual(30);
      expect(Object.values(b.resist)).not.toHaveLength(0);
      for(const resistance of Object.values(b.resist)){
        expect(resistance).toBeGreaterThanOrEqual(0);
        expect(resistance).toBeLessThanOrEqual(.8);
      }
      expect(b.description.length).toBeGreaterThan(55);
      expect(b.bounty).toBeGreaterThan(0);
    }
  });

  it('returns deeply independent config per run',()=>{
    const first=getBosses();
    first[0].layers[0].cash=999999;
    first[0].boss!.phases[0].count=9999;
    first[1].resist.fire=1;
    first.pop();
    const second=getBosses();
    expect(second).toHaveLength(6);
    expect(second[0].layers[0].cash).toBe(40);
    expect(second[0].boss!.phases[0].count).toBe(2);
    expect(second[1].resist.fire).toBe(.08);
  });
});

describe('boss assets',()=>{
  it('has the public base art, three different phase images, and an offline preview for each boss',()=>{
    for(const b of getBosses()){
      const base=join(artRoot,`${b.id}.svg`);
      const preview=join(artRoot,b.id,'preview.html');
      expect(existsSync(base)).toBe(true);
      expect(existsSync(preview)).toBe(true);
      const html=readFileSync(preview,'utf8');
      const images=[base];
      for(let i=1;i<=3;i++){
        const file=join(artRoot,b.id,`${b.id}-phase-${i}.svg`);
        expect(existsSync(file)).toBe(true);
        expect(html).toContain(`${b.id}-phase-${i}.svg`);
        images.push(file);
      }
      const geometry=new Set<string>();
      for(const asset of images){
        const svg=readFileSync(asset,'utf8');
        expect(svg).toMatch(/<svg[^>]*viewBox="0 0 256 256"/);
        expect(svg).toContain('</svg>');
        expect(svg).not.toMatch(/<(?:script|image|foreignObject|iframe)\b/i);
        expect(svg).not.toMatch(/(?:href|url)\s*=\s*["'](?:https?:|\/\/)/i);
        expect(svg.length).toBeGreaterThan(1700);
        // Compare geometry without incidental palette/text changes.
        geometry.add(svg.replace(/#[a-f0-9]{3,8}\b/gi,'#COLOR')
          .replace(/<title>.*?<\/title>/s,'<title/>')
          .replace(/aria-label="[^"]*"/,'aria-label=""'));
      }
      expect(geometry.size).toBe(4);
    }
    expect(existsSync(join(artRoot,'preview.html'))).toBe(true);
  });
});

describe('frozen runtime compatibility',()=>{
  it('instantiates a scaled boss with its shields and an empty paid-layer ledger',()=>{
    const boss=getBosses()[0];
    const state={
      time:0,options:{mapId:'fixture'},nextEntity:1,nextEvent:1,enemies:[],events:[],
    } as unknown as GameState;
    const config={enemies:[boss],maps:[{id:'fixture',lanes:[[{x:0,y:0},{x:1200,y:0}]]}]} as unknown as GameConfig;
    const spawned=spawnEnemy(state,config,boss.id,0,0,.12,.8);
    expect(spawned.maxHp).toBe(720);
    expect(spawned.shield).toBe(36);
    expect(spawned.paidLayers).toEqual([]);
    expect(spawned.memory.speedMul).toBe(.8);
    expect(state.events[0].kind).toBe('spawn');
  });
});
