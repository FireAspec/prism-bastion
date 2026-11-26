/** Relative URLs work with both Vite's public directory and packaged Electron. */
export const worldArtRoot = './art/world/';
export const uiArtRoot = './art/ui/';
const bossIds = new Set(['boss-carapace','boss-brood','boss-mirror','boss-chrono','boss-tempest','boss-eclipse']);
function assetId(id: string): string {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*(?![\s\S])/.test(id)) throw new RangeError('Invalid art ID');
  return id;
}
export function enemyArt(id: string): string {
  return './art/' + (bossIds.has(id) ? 'bosses/' : 'enemies/') + assetId(id) + '.svg';
}
export function mapArt(id: string): string { return './art/maps/' + assetId(id) + '/background.svg'; }
export const resourceIds = ['credits','xp','knowledge-points','seals','lives'] as const;
export const difficultyIds = ['easy','normal','hard','extreme'] as const;
export const modeIds = ['standard','half-cash','no-leaks','iron-oath','short-supply','blackout','stormfront','overdrive','low-tech','no-actives'] as const;
export const statusIds = ['burn','poison','slow','freeze','stun','mark','shred','wet','reveal'] as const;
export const controlIds = ['play','pause','speed','lock','check','warning','close','settings','sell','ability','coop','medal'] as const;
export const decorationIds = ['lantern','crystal-cluster','reed-bed','copper-gear','stone-rubble','waystone'] as const;
export const frameIds = ['panel','selected','locked','warning'] as const;
function catalogPath<T extends string>(root: string, group: string, ids: readonly T[], id: T): string {
  if (!ids.includes(id)) throw new RangeError('Unknown art ID: ' + id);
  return root + group + '/' + id + '.svg';
}
export const resourceArt = (id: typeof resourceIds[number]) => catalogPath(uiArtRoot,'resource',resourceIds,id);
export const difficultyArt = (id: typeof difficultyIds[number]) => catalogPath(uiArtRoot,'difficulty',difficultyIds,id);
export function mapGroupArt(group: 1|2|3|4): string {
  if (![1,2,3,4].includes(group)) throw new RangeError('Invalid map group');
  return uiArtRoot + 'map-group/group-' + group + '.svg';
}
export const modeArt = (id: typeof modeIds[number]) => catalogPath(uiArtRoot,'mode',modeIds,id);
export const statusArt = (id: typeof statusIds[number]) => catalogPath(uiArtRoot,'status',statusIds,id);
export const controlArt = (id: typeof controlIds[number]) => catalogPath(uiArtRoot,'control',controlIds,id);
export const decorationArt = (id: typeof decorationIds[number]) => catalogPath(worldArtRoot,'decoration',decorationIds,id);
export const frameArt = (id: typeof frameIds[number]) => catalogPath(uiArtRoot,'frame',frameIds,id);
export const artPalette = Object.freeze({background:'#102b35',surface:'#21434a',ink:'#11272e',ivory:'#fff1ca',copper:'#c48354',amber:'#ffc95c',cyan:'#83d8e2',violet:'#c6a9f5',green:'#9bd6aa',danger:'#ff9b85'});
export const artSizes = Object.freeze({status:20,resource:24,control:28,difficulty:32,mapGroup:32,mode:40,decoration:96,frameWidth:320,frameHeight:120});
