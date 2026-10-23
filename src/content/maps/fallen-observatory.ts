import type {MapDef} from '../../contracts';

/** One broad, visible path with long tangents and two gentle turns. */
const layout:MapDef={
 id:'fallen-observatory',name:'Павшая обсерватория',difficulty:3,campaignIndex:12,
 recommendedDifficulty:'hard',theme:'garden',
 description:'В заросшем астрономическом саду лежит разбитая гравитационная линза. Защитите открытую дорогу через обломки, затем поднимите линзу и откройте технологию «Гравитация».',
 background:'/art/maps/fallen-observatory/background.svg',
 pathWidth:54,
 lanes:[[{x:0,y:170},{x:335,y:170},{x:408,y:248},{x:785,y:248},{x:862,y:390},{x:1280,y:390}]],
 blocked:[
  [{x:214,y:28},{x:370,y:38},{x:400,y:85},{x:368,y:121},{x:232,y:118},{x:190,y:73}],
  [{x:80,y:244},{x:250,y:243},{x:283,y:318},{x:240,y:370},{x:104,y:350},{x:54,y:294}],
  [{x:520,y:41},{x:715,y:39},{x:756,y:98},{x:715,y:175},{x:530,y:178},{x:488,y:120}],
  [{x:505,y:326},{x:676,y:324},{x:733,y:370},{x:710,y:460},{x:557,y:478},{x:477,y:413}],
  [{x:940,y:86},{x:1130,y:81},{x:1180,y:141},{x:1151,y:253},{x:955,y:255},{x:920,y:179}],
  [{x:976,y:481},{x:1180,y:466},{x:1224,y:531},{x:1187,y:632},{x:996,y:615},{x:945,y:557}],
 ],
 water:[
  [{x:40,y:475},{x:252,y:477},{x:303,y:548},{x:248,y:666},{x:45,y:678}],
  [{x:760,y:505},{x:899,y:481},{x:921,y:555},{x:910,y:656},{x:739,y:676},{x:700,y:601}],
  [{x:1193,y:16},{x:1266,y:14},{x:1268,y:241},{x:1206,y:242},{x:1191,y:201}],
 ],
 // Map-specific wave changes must not assume an unfinished global wave schedule.
 waveOverrides:{},
};
export function getMap():MapDef{return structuredClone(layout);}
