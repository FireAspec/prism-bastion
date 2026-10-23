import type {MapDef,SpawnGroup,Vec} from '../../contracts';

// World-space centrelines. Road strokes and enemies are rendered by the engine;
// the backdrop is deliberately scenery-only.
const northern:Vec[]=[
 {x:32,y:170},{x:210,y:170},{x:266,y:278},{x:404,y:278},
 {x:476,y:116},{x:630,y:116},{x:697,y:286},{x:830,y:286},
 {x:900,y:155},{x:1045,y:155},{x:1110,y:283},{x:1246,y:283},
];
const southern:Vec[]=[
 {x:32,y:548},{x:305,y:548},{x:385,y:481},{x:760,y:481},
 {x:841,y:552},{x:1055,y:552},{x:1120,y:469},{x:1246,y:469},
];
const blocked:Vec[][]=[
 [{x:38,y:35},{x:150,y:29},{x:187,y:93},{x:177,y:127},{x:57,y:127}],
 [{x:306,y:28},{x:438,y:37},{x:449,y:93},{x:345,y:104}],
 [{x:742,y:33},{x:850,y:29},{x:876,y:92},{x:820,y:128},{x:753,y:115}],
 [{x:40,y:628},{x:183,y:628},{x:190,y:693},{x:44,y:689}],
 [{x:491,y:326},{x:541,y:317},{x:559,y:359},{x:540,y:390},{x:489,y:385}],
 [{x:1030,y:635},{x:1170,y:618},{x:1191,y:687},{x:1051,y:694}],
 [{x:1145,y:62},{x:1230,y:65},{x:1240,y:152},{x:1190,y:173},{x:1137,y:144}],
];
const water:Vec[][]=[
 [{x:706,y:626},{x:751,y:597},{x:846,y:600},{x:889,y:633},
  {x:868,y:692},{x:733,y:694},{x:702,y:667}],
];

type GroupSpec=readonly [enemy:string,count:number,at:number,every:number,lane:0|1];
const schedule:ReadonlyArray<readonly [number,readonly GroupSpec[]]>=[
 [1,[['scarlet',8,1,.85,0]]],
 [2,[['scarlet',8,1,.8,0],['amber',5,8,1.15,1]]],
 [3,[['amber',7,1,.85,0],['scarlet',10,7,.65,1]]],
 [4,[['jade',5,1,1.5,0],['lemon',7,8,1,1]]],
 [5,[['azure',8,1,.85,0],['amber',11,8,.75,1]]],
 [6,[['jade',8,1,.9,0],['lemon',11,7,.55,1]]],
 [7,[['azure',11,1,.65,0],['jade',7,9,1,1]]],
 [8,[['amber',16,1,.55,0],['lemon',14,8,.45,1]]],
 [9,[['jade',10,1,.65,0],['azure',13,9,.7,1]]],
 [11,[['violet',8,1,1,0],['lemon',12,9,.5,1]]],
 [12,[['iron',6,1,1.4,0],['azure',14,8,.65,1]]],
 [13,[['cloak',9,1,.9,0],['amber',15,9,.55,1]]],
 [15,[['shield',7,1,1.1,0],['cloak',12,10,.75,1]]],
 [17,[['iron',12,1,.9,0],['glass',17,8,.55,1]]],
 [19,[['shield',10,1,.95,0],['regrow',13,10,.75,1]]],
 [21,[['ruby',8,1,.9,0],['split',17,9,.55,1]]],
 [24,[['glacier',11,1,.7,0],['cloak',17,9,.65,1]]],
 [27,[['copper',12,1,.7,0],['dart',18,9,.5,1]]],
 [33,[['obsidian',10,1,1,0],['swarm',44,8,.24,1]]],
 [37,[['aegis',10,1,.85,0],['hollow',18,10,.55,1]]],
 [41,[['royal',12,1,.75,0],['dart',28,8,.4,1]]],
 [44,[['obsidian',16,1,.75,0],['aegis',12,10,.65,1]]],
 [49,[['hollow',25,1,.46,0],['dart',36,8,.3,1]]],
 [53,[['royal',16,1,.6,0],['swarm',60,9,.18,1]]],
 [57,[['aegis',20,1,.6,0],['obsidian',20,11,.6,1]]],
 [61,[['royal',20,1,.65,0],['dart',40,9,.3,1]]],
 [64,[['prismatic',10,1,.85,0],['hollow',32,9,.4,1]]],
 [68,[['juggernaut',6,1,1.9,0],['aegis',22,9,.7,1]]],
 [72,[['herald',5,1,2.5,0],['dart',45,10,.3,1]]],
 [77,[['juggernaut',10,1,1.3,0],['prismatic',16,10,.7,1]]],
 [81,[['prismatic',19,1,.65,0],['royal',28,10,.45,1]]],
 [85,[['herald',12,1,1,0],['dart',54,9,.25,1]]],
 [89,[['juggernaut',18,1,.9,0],['aegis',30,10,.45,1]]],
 [93,[['herald',20,1,.9,0],['hollow',48,10,.35,1]]],
 [97,[['prismatic',28,1,.52,0],['juggernaut',19,12,.75,1]]],
 [99,[['herald',25,1,.7,0],['dart',70,12,.2,1]]],
];

function mapWaveOverrides():MapDef['waveOverrides'] {
 return Object.fromEntries(schedule.map(([round,spec])=>{
  const groups:SpawnGroup[]=spec.map(([enemy,count,at,every,lane])=>({enemy,count,at,every,lane}));
  const preview=groups.map(g=>`${g.lane===0?'Север / длинная':'Юг / короткая'}: ${g.enemy} ×${g.count}, старт ${g.at}с, интервал ${g.every}с`).join(' • ');
  return [round,{groups,preview}];
 }));
}

export function getMap():MapDef {
 return {
  id:'prism-quarry',name:'Призменный карьер',difficulty:3,campaignIndex:13,
  recommendedDifficulty:'hard',theme:'foundry',
  description:'Два пути к ядру большого маяка. Северная дорога длиннее, но южные группы, ' +
   'приходящие по объявленному графику, добегают быстрее. Усильте короткую линию ' +
   'и удержите оба видимых выхода. Восстановление ядра открывает prism.',
  background:'/art/maps/prism-quarry/background.svg',
  lanes:[northern.map(p=>({...p})),southern.map(p=>({...p}))],pathWidth:44,
  blocked:blocked.map(poly=>poly.map(p=>({...p}))),
  water:water.map(poly=>poly.map(p=>({...p}))),waveOverrides:mapWaveOverrides(),
 };
}
