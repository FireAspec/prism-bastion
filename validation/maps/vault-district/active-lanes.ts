import type {MapDef,WaveDef} from '../../../src/contracts';
import {getMap} from '../../../src/content/maps/vault-district';

export const ROUTE_NAMES=['северная эстакада','грузовой объезд','нижний рельсовый тракт'] as const;

/** Maps the canonical groups to a truthful pre-wave lane warning. */
export function activeLaneIndices(wave:WaveDef,map:MapDef=getMap()):number[] {
  if(map.lanes.length!==3)throw new Error('vault-district requires three routes');
  const indices=new Set<number>();
  for(const group of wave.groups) {
    if(!Number.isInteger(group.lane)||group.lane<0)
      throw new Error('invalid active lane index for wave '+wave.number);
    indices.add(group.lane%map.lanes.length);
  }
  return [...indices].sort((a,b)=>a-b);
}
export function activeLanePreview(wave:WaveDef,map:MapDef=getMap()):string {
  const lanes=activeLaneIndices(wave,map);
  if(!lanes.length)throw new Error('wave '+wave.number+' has no active routes');
  return wave.preview+' · Полосы: '+lanes.map(i=>ROUTE_NAMES[i]).join(', ');
}
