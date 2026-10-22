import type {MapDef} from '../../contracts';

/**
 * An unbranched, clockwise-to-counterclockwise spiral. All coordinates use the
 * fixed 1280x720 world space. The background supplies scenery only; the game
 * renderer owns the visible collision path and placed towers.
 */
const WINDMILL_FIELDS:MapDef = {
 id:'windmill-fields',
 name:'Поля ветряков',
 description:'Проведите энергию по открытой спирали к центральному узлу. '
  +'Три зелёных островка подходят для обороны на нескольких витках. '
  +'Восстановление узла откроет рельсотрон и катушку Теслы.',
 difficulty:1,
 campaignIndex:3,
 recommendedDifficulty:'easy',
 theme:'garden',
 background:'/art/maps/windmill-fields/background.svg',
 pathWidth:46,
 lanes:[[
  {x:0,y:80},{x:1150,y:80},{x:1195,y:130},
  {x:1195,y:638},{x:1140,y:678},{x:110,y:678},
  {x:72,y:629},{x:72,y:263},{x:130,y:244},
  {x:1025,y:244},{x:1075,y:290},{x:1075,y:505},
  {x:1030,y:535},{x:290,y:535},{x:250,y:500},
  {x:250,y:387},{x:300,y:358},{x:780,y:358},
  {x:830,y:400},{x:830,y:421},{x:792,y:452},
  {x:670,y:452},
 ]],
 // Three fenced windmills. Blade artwork is purely decorative; only the
 // footprints below exclude building, with no unmodelled collision objects.
 blocked:[
  [{x:125,y:135},{x:150,y:125},{x:180,y:138},{x:190,y:165},
   {x:179,y:191},{x:153,y:201},{x:126,y:186},{x:117,y:160}],
  [{x:1082,y:158},{x:1107,y:149},{x:1131,y:165},{x:1140,y:188},
   {x:1129,y:213},{x:1105,y:220},{x:1080,y:202},{x:1073,y:180}],
  [{x:1106,y:551},{x:1125,y:542},{x:1147,y:556},{x:1156,y:577},
   {x:1143,y:599},{x:1122,y:605},{x:1101,y:589},{x:1097,y:567}],
 ],
 // Accessible water for later revisits with harbor/tide/coral. None of the
 // first-visit land towers requires the ponds or a water-only shortcut.
 water:[
  [{x:428,y:281},{x:460,y:269},{x:543,y:273},{x:574,y:292},
   {x:563,y:325},{x:530,y:333},{x:452,y:329},{x:421,y:307}],
  [{x:878,y:302},{x:902,y:283},{x:980,y:280},{x:1015,y:298},
   {x:1023,y:332},{x:993,y:347},{x:917,y:347},{x:884,y:330}],
 ],
 // The shared 1..100 wave program is deliberately unchanged. It must be
 // checked by the central replay runner once enemies/waves have landed;
 // invented local enemy IDs would silently make the map less compatible.
 waveOverrides:{},
};

/** Returns fully independent geometry for each content-loader invocation. */
export function getMap():MapDef {
 return {
  ...WINDMILL_FIELDS,
  lanes:WINDMILL_FIELDS.lanes.map(lane=>lane.map(point=>({...point}))),
  blocked:WINDMILL_FIELDS.blocked.map(poly=>poly.map(point=>({...point}))),
  water:WINDMILL_FIELDS.water.map(poly=>poly.map(point=>({...point}))),
  waveOverrides:Object.fromEntries(Object.entries(WINDMILL_FIELDS.waveOverrides)
   .map(([key,value])=>[key,structuredClone(value)])),
 };
}
