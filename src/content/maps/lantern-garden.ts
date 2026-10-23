import type {MapDef,Vec} from '../../contracts';

/**
 * Map 01. One continuous, deliberately long approach: west -> east -> west -> east.
 * The two broad hairpin interiors are reserved for land towers. The garden pond
 * is visual water AND placement water; all landmarks outside it are ground art.
 * World coordinates match the 1280 x 720 renderer; no screen-pixel scaling.
 */
const lane:Vec[] = [
 {x:0,y:170},{x:115,y:170},{x:252,y:169},{x:395,y:165},
 {x:540,y:166},{x:686,y:171},{x:823,y:180},{x:932,y:191},
 {x:1015,y:216},{x:1067,y:250},{x:1091,y:291},{x:1094,y:331},
 {x:1073,y:373},{x:1034,y:397},{x:974,y:409},{x:869,y:410},
 {x:740,y:413},{x:610,y:419},{x:485,y:422},{x:367,y:432},
 {x:286,y:450},{x:233,y:477},{x:206,y:515},{x:208,y:550},
 {x:229,y:580},{x:273,y:601},{x:347,y:610},{x:482,y:612},
 {x:624,y:613},{x:769,y:611},{x:910,y:607},{x:1050,y:603},
 {x:1170,y:600},{x:1280,y:600},
];

// Clockwise shore outline. The bottom-to-top clearance from both road passes
// is wide enough for later water-only towers on the inside of the pond.
const pond:Vec[] = [
 {x:550,y:291},{x:564,y:264},{x:591,y:245},{x:628,y:237},
 {x:670,y:240},{x:708,y:251},{x:733,y:271},{x:740,y:296},
 {x:731,y:320},{x:704,y:340},{x:665,y:349},{x:626,y:350},
 {x:588,y:340},{x:561,y:321},
];

// Low planters and the restored watch-post foundation; all outside the road.
const blocked:Vec[][] = [
 [{x:73,y:54},{x:183,y:54},{x:197,y:113},{x:65,y:113}],
 [{x:1120,y:57},{x:1242,y:57},{x:1242,y:127},{x:1120,y:127}],
 [{x:27,y:357},{x:125,y:350},{x:140,y:421},{x:27,y:421}],
 [{x:1108,y:463},{x:1238,y:469},{x:1238,y:532},{x:1105,y:534}],
 [{x:492,y:662},{x:598,y:657},{x:616,y:696},{x:484,y:696}],
];

const waveOverrides:MapDef['waveOverrides'] = {
 // First shields: no hidden reveal or late-game elemental technology needed.
 11:{
  preview:'Первые защитные оболочки. Замедлите колонну и разбивайте щиты пушкой.',
  groups:[
   {enemy:'violet',count:8,at:0,every:1.5,lane:0},
   {enemy:'azure',count:10,at:5,every:1.1,lane:0},
  ],
 },
 // Explicitly introduce camouflage while the starting Beacon can detect it.
 12:{
  preview:'Теневые осколки. Поставьте маяк обнаружения у внутреннего изгиба.',
  groups:[
   {enemy:'amber',count:10,at:0,every:0.9,lane:0},
   {enemy:'cloak',count:7,at:7,every:1.8,lane:0},
  ],
 },
 21:{
  preview:'Дробящиеся и бронированные цели. Пушка прикрывает игломёты.',
  groups:[
   {enemy:'split',count:14,at:0,every:1.3,lane:0},
   {enemy:'iron',count:9,at:8,every:2.1,lane:0},
  ],
 },
 31:{
  preview:'Смешанный натиск: тени, щиты, огонь и лёд. Понадобятся обнаружение и разный урон.',
  groups:[
   {enemy:'cloak',count:12,at:0,every:1.1,lane:0},
   {enemy:'shield',count:8,at:4,every:2.1,lane:0},
   {enemy:'ruby',count:6,at:9,every:2.0,lane:0},
   {enemy:'glacier',count:6,at:13,every:2.0,lane:0},
  ],
 },
};

export function getMap():MapDef {
 return {
  id:'lantern-garden',
  name:'Сад фонарей',
  description:'Верните свет сторожевому посту. Враги проходят через два открытых поворота старого сада; берег пруда пригодится для будущих водных башен. Награда за первую победу: Веерный страж и Жаровая печь.',
  difficulty:1,
  campaignIndex:1,
  recommendedDifficulty:'easy',
  waveOverrides,
  lanes:[lane],
  pathWidth:46,
  blocked,
  water:[pond],
  theme:'garden',
  background:'/art/maps/lantern-garden/background.svg',
 };
}
