import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { enemyArt, mapArt, worldArtRoot, resourceIds, resourceArt, difficultyIds, difficultyArt, mapGroupArt, modeIds, modeArt, statusIds, statusArt, controlIds, controlArt, decorationIds, decorationArt, frameIds, frameArt } from '../../src/art/index';
const all = [...resourceIds.map(resourceArt), ...difficultyIds.map(difficultyArt), ...([1,2,3,4] as const).map(mapGroupArt), ...modeIds.map(modeArt), ...statusIds.map(statusArt), ...controlIds.map(controlArt), ...decorationIds.map(decorationArt), ...frameIds.map(frameArt)];
function walk(dir: string): string[] { return readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(dir,e.name)):[join(dir,e.name)]); }
describe('common art',()=>{
  it('routes normal enemies, six boss IDs and maps to their owners',()=>{
    expect(worldArtRoot).toBe('./art/world/');
    expect(enemyArt('scarlet')).toBe('./art/enemies/scarlet.svg');
    for(const id of ['boss-carapace','boss-brood','boss-mirror','boss-chrono','boss-tempest','boss-eclipse']) expect(enemyArt(id)).toBe(`./art/bosses/${id}.svg`);
    expect(mapArt('lantern-garden')).toBe('./art/maps/lantern-garden/background.svg');
    expect(enemyArt('future-enemy')).toBe('./art/enemies/future-enemy.svg');
  });
  it('rejects unsafe paths and invalid closed catalog IDs',()=>{
    for(const id of ['','../evil','a/b','a\\b','a.svg','a?b','%2e%2e',' A','a\n']) {expect(()=>enemyArt(id)).toThrow(RangeError); expect(()=>mapArt(id)).toThrow(RangeError);}
    expect(()=>mapGroupArt(0 as 1)).toThrow(RangeError);
    expect(()=>resourceArt('unknown' as 'xp')).toThrow(RangeError);
  });
  it('contains each distinct catalog asset and no unregistered SVG',()=>{
    expect(new Set(all).size).toBe(54);
    const actual = [...['resource','difficulty','map-group','mode','status','control','frame'].flatMap(g=>walk('public/art/ui/'+g)),...walk('public/art/world/decoration')].filter(f=>f.endsWith('.svg')).map(f=>f.replaceAll('\\','/')).sort();
    expect(actual).toEqual(all.map(p=>'public/'+p.slice(2)).sort());
    for(const path of all){const file='public/'+path.slice(2); expect(existsSync(file)).toBe(true); const svg=readFileSync(file,'utf8'); expect(svg).toMatch(/<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/); expect(svg).not.toMatch(/<script|<image|<foreignObject|\bhref\s*=|\bon\w+\s*=|url\s*\(/i);}
  });
});
