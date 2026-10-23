import type {MapDef} from '../../contracts';

/** Campaign map four: a long visible route beneath two ruined aqueduct arches. */
export function getMap():MapDef {
 return {
  id:'old-aqueduct',name:'Старый акведук',difficulty:1,campaignIndex:4,
  recommendedDifficulty:'easy',theme:'garden',pathWidth:62,
  description:'Защитите извилистую дорогу под двумя арками и восстановите навигационную станцию. Каменные опоры запрещают строительство. После победы открываются мортира и обсерватория.',
  background:'/art/maps/old-aqueduct/background.svg',
  lanes:[[
   {x:0,y:220},{x:80,y:220},{x:150,y:234},{x:215,y:267},
   {x:276,y:310},{x:340,y:338},{x:402,y:346},{x:465,y:339},
   {x:520,y:317},{x:570,y:285},{x:622,y:260},{x:680,y:259},
   {x:740,y:279},{x:796,y:314},{x:846,y:357},{x:892,y:398},
   {x:941,y:422},{x:995,y:424},{x:1050,y:413},{x:1103,y:387},
   {x:1149,y:355},{x:1202,y:338},{x:1280,y:338},
  ]],
  blocked:[
   [{x:353,y:231},{x:395,y:230},{x:415,y:280},{x:363,y:291}],
   [{x:357,y:406},{x:412,y:412},{x:427,y:468},{x:360,y:478}],
   [{x:886,y:294},{x:926,y:292},{x:952,y:354},{x:902,y:359}],
   [{x:892,y:487},{x:954,y:482},{x:973,y:554},{x:908,y:558}],
   [{x:72,y:499},{x:185,y:499},{x:195,y:616},{x:60,y:615}],
  ],
  water:[[
   {x:920,y:98},{x:980,y:72},{x:1071,y:65},{x:1151,y:78},
   {x:1217,y:115},{x:1234,y:172},{x:1210,y:218},{x:1151,y:251},
   {x:1073,y:244},{x:1003,y:222},{x:951,y:183},{x:915,y:136},
  ]],
  // Shared wave program; this map does not silently weaken bosses or pay rewards.
  waveOverrides:{},
 };
}
