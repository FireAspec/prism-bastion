import type {MapDef} from '../../contracts';

/** The four hairpins of the old glass pass, in frozen world coordinates. */
export function getMap():MapDef {
 return {
  id:'glass-switchback',name:'Стеклянный серпантин',
  description:'Разминируйте старый перевал над приливными карманами. Четыре тесных разворота дают перекрёстный огонь, однако слишком ранние вложения в экономику оставят выход без защиты. После победы откроется минный узел.',
  difficulty:3,campaignIndex:15,recommendedDifficulty:'hard',theme:'estuary',
  background:'/art/maps/glass-switchback/background.svg',pathWidth:38,
  lanes:[[
   {x:0,y:126},{x:775,y:126},{x:826,y:168},{x:826,y:195},
   {x:775,y:238},{x:420,y:238},{x:369,y:277},{x:369,y:307},
   {x:420,y:347},{x:842,y:347},{x:892,y:388},{x:892,y:412},
   {x:842,y:455},{x:415,y:455},{x:366,y:492},{x:366,y:520},
   {x:415,y:563},{x:1280,y:563},
  ]],
  water:[
   [{x:948,y:74},{x:1218,y:64},{x:1263,y:116},{x:1253,y:286},{x:1160,y:309},{x:980,y:273},{x:946,y:195}],
   [{x:40,y:338},{x:255,y:330},{x:307,y:365},{x:295,y:517},{x:217,y:550},{x:49,y:535}],
   [{x:973,y:355},{x:1200,y:356},{x:1265,y:403},{x:1235,y:500},{x:1060,y:519},{x:964,y:468}],
   [{x:632,y:628},{x:812,y:623},{x:860,y:697},{x:585,y:700}],
  ],
  blocked:[
   [{x:270,y:24},{x:556,y:15},{x:592,y:73},{x:494,y:91},{x:302,y:76}],
   [{x:545,y:282},{x:592,y:278},{x:617,y:299},{x:581,y:317},{x:544,y:310}],
   [{x:460,y:643},{x:550,y:633},{x:571,y:691},{x:426,y:703}],
   [{x:1096,y:12},{x:1240,y:16},{x:1264,y:52},{x:1084,y:57}],
  ],
  // Use the canonical 1..80 hard wave schedule and rewards unchanged.
  // 'mine' is unlocked AFTER this map; it must not be required to clear it.
  waveOverrides:{},
 };
}
