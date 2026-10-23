import type {MapDef,Vec,WaveDef} from '../../contracts';

const route:Vec[]=[
 {x:0,y:152},{x:82,y:150},{x:210,y:151},{x:300,y:174},
 {x:350,y:225},{x:358,y:315},{x:351,y:380},{x:308,y:433},
 {x:236,y:452},{x:165,y:459},{x:132,y:500},{x:140,y:546},
 {x:181,y:583},{x:270,y:602},{x:387,y:602},{x:471,y:574},
 {x:525,y:512},{x:534,y:423},{x:528,y:321},{x:548,y:248},
 {x:598,y:198},{x:672,y:177},{x:785,y:178},{x:864,y:213},
 {x:899,y:272},{x:903,y:353},{x:880,y:420},{x:821,y:462},
 {x:781,y:501},{x:781,y:546},{x:820,y:578},{x:927,y:592},
 {x:1070,y:592},{x:1170,y:593},{x:1280,y:591},
];
const creek:Vec[]=[
 {x:619,y:243},{x:644,y:232},{x:683,y:255},{x:705,y:290},
 {x:720,y:339},{x:712,y:398},{x:705,y:444},{x:679,y:486},
 {x:647,y:508},{x:608,y:488},{x:593,y:441},{x:604,y:397},
 {x:606,y:344},{x:598,y:293},
];
const oxbow:Vec[]=[
 {x:42,y:260},{x:84,y:250},{x:113,y:275},{x:120,y:317},
 {x:105,y:369},{x:72,y:408},{x:32,y:400},{x:22,y:365},
 {x:30,y:310},
];
const downstream:Vec[]=[
 {x:1016,y:645},{x:1070,y:632},{x:1130,y:637},{x:1173,y:657},
 {x:1185,y:707},{x:1014,y:707},
];
const blocked:Vec[][]=[
 [{x:1055,y:270},{x:1195,y:270},{x:1208,y:284},{x:1208,y:418},{x:1055,y:418}],
 [{x:1030,y:125},{x:1124,y:125},{x:1150,y:160},{x:1130,y:199},{x:1042,y:200},{x:1018,y:160}],
 [{x:7,y:639},{x:73,y:632},{x:96,y:660},{x:85,y:704},{x:8,y:703}],
 [{x:576,y:621},{x:654,y:617},{x:675,y:650},{x:658,y:698},{x:583,y:700}],
];

/** Fresh copies prevent one run or diagnostic from mutating another. */
export function getMap():MapDef{
 const bossWave=(boss:string,at:number,preview:string):Partial<WaveDef>=>({
  boss,preview,groups:[{enemy:boss,count:1,at,every:0,lane:0}],
 });
 const waveOverrides:Record<number,Partial<WaveDef>>={
  10:bossWave('boss-carapace',12,'Панцирник: броня и фазовые осколки.'),
  20:bossWave('boss-brood',12,'Матка осколков: потомство на двух изгибах.'),
  40:bossWave('boss-mirror',14,'Зеркальный регент: щиты и теневые призывы.'),
 };
 const copy=(poly:Vec[]):Vec[]=>poly.map(p=>({...p}));
 return {
  id:'copper-creek',name:'Медный ручей',
  description:'Спасите мастерскую лесничего. Две сухие петли огибают медный ручей. Награда после победы: saw и venom.',
  difficulty:1,campaignIndex:2,recommendedDifficulty:'easy',
  lanes:[copy(route)],pathWidth:54,blocked:blocked.map(copy),water:[creek,oxbow,downstream].map(copy),
  theme:'garden',background:'/art/maps/copper-creek/background.svg',waveOverrides,
 };
}
