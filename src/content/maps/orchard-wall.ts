import type {MapDef} from '../../contracts';

/** Sequential western and eastern orchard loops; one continuous visible lane. */
const MAP:MapDef={
 id:'orchard-wall',name:'Садовая стена',
 description:'Проведите защиту сквозь две садовые петли, чтобы открыть торговый квартал.',
 difficulty:1,campaignIndex:5,recommendedDifficulty:'easy',theme:'garden',
 background:'/art/maps/orchard-wall/background.svg',pathWidth:42,
 lanes:[[
  {x:0,y:206},{x:105,y:206},{x:155,y:153},{x:340,y:127},
  {x:484,y:173},{x:519,y:245},{x:487,y:350},{x:350,y:403},
  {x:202,y:374},{x:132,y:314},{x:181,y:248},{x:300,y:222},
  {x:456,y:249},{x:570,y:315},{x:683,y:209},{x:778,y:144},
  {x:957,y:128},{x:1101,y:177},{x:1130,y:272},{x:1086,y:377},
  {x:935,y:413},{x:772,y:385},{x:716,y:319},{x:757,y:259},
  {x:928,y:240},{x:1091,y:310},{x:1190,y:355},{x:1280,y:355},
 ]],
 blocked:[
  [{x:0,y:0},{x:1280,y:0},{x:1280,y:46},{x:0,y:46}],
  [{x:45,y:80},{x:92,y:80},{x:95,y:130},{x:49,y:142}],
  [{x:248,y:307},{x:260,y:284},{x:330,y:289},{x:354,y:319},{x:338,y:347},{x:267,y:347}],
  [{x:594,y:69},{x:641,y:65},{x:656,y:110},{x:603,y:121}],
  [{x:885,y:315},{x:902,y:299},{x:962,y:298},{x:992,y:327},{x:980,y:356},{x:913,y:357}],
  [{x:1155,y:82},{x:1220,y:80},{x:1235,y:140},{x:1180,y:151}],
 ],
 water:[[
  {x:0,y:624},{x:146,y:611},{x:283,y:622},{x:419,y:605},
  {x:566,y:625},{x:750,y:604},{x:901,y:625},{x:1071,y:611},
  {x:1199,y:622},{x:1280,y:605},{x:1280,y:720},{x:0,y:720},
 ]],
 // The global wave catalog is not implemented at the frozen base. Do not
 // invent inaccessible enemy IDs or double-credit boss rewards here.
 waveOverrides:{},
};

export function getMap():MapDef{return structuredClone(MAP);}
