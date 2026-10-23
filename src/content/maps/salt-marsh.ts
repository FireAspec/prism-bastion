import type {MapDef} from '../../contracts';

/** Three broad islands and two tidal channels. Water crossings are causeways. */
export function getMap():MapDef {
 return {
  id:'salt-marsh',
  name:'Солёные болота',
  description:'Два каравана идут по северной и южной дамбам через три острова. Защитите место слияния и запустите насосную станцию. Приливный насос откроется после победы.',
  difficulty:2,
  campaignIndex:9,
  recommendedDifficulty:'normal',
  theme:'estuary',
  background:'/art/maps/salt-marsh/background.svg',
  pathWidth:40,
  lanes:[
   [
    {x:10,y:182},{x:100,y:178},{x:196,y:176},{x:290,y:202},
    {x:358,y:242},{x:427,y:265},{x:510,y:262},{x:587,y:218},
    {x:670,y:202},{x:749,y:220},{x:815,y:264},{x:900,y:281},
    {x:975,y:292},{x:1040,y:320},{x:1112,y:361},
    {x:1195,y:361},{x:1270,y:361},
   ],
   [
    {x:10,y:552},{x:94,y:551},{x:178,y:510},{x:263,y:479},
    {x:340,y:471},{x:415,y:439},{x:497,y:438},{x:577,y:480},
    {x:667,y:503},{x:751,y:484},{x:835,y:450},{x:912,y:438},
    {x:981,y:421},{x:1044,y:396},{x:1112,y:361},
    {x:1195,y:361},{x:1270,y:361},
   ],
  ],
  // Tidal channels continue behind the raised paths. Their geometry also
  // controls legal placement of future water towers and forbids land towers.
  water:[
   [
    {x:345,y:0},{x:484,y:0},{x:470,y:78},{x:493,y:148},
    {x:470,y:226},{x:504,y:309},{x:482,y:377},{x:509,y:463},
    {x:478,y:545},{x:493,y:643},{x:477,y:720},{x:359,y:720},
    {x:370,y:632},{x:344,y:554},{x:367,y:476},{x:344,y:399},
    {x:367,y:315},{x:344,y:251},{x:368,y:175},{x:345,y:99},
   ],
   [
    {x:791,y:0},{x:924,y:0},{x:907,y:100},{x:943,y:171},
    {x:914,y:251},{x:949,y:325},{x:918,y:405},{x:936,y:488},
    {x:902,y:578},{x:927,y:654},{x:910,y:720},{x:790,y:720},
    {x:802,y:631},{x:783,y:560},{x:808,y:478},{x:784,y:399},
    {x:810,y:311},{x:782,y:239},{x:808,y:163},{x:791,y:82},
   ],
  ],
  blocked:[
   [
    {x:70,y:315},{x:185,y:280},{x:287,y:327},{x:270,y:403},
    {x:132,y:424},{x:70,y:376},
   ],
   [
    {x:551,y:328},{x:620,y:298},{x:700,y:324},
    {x:730,y:379},{x:695,y:411},{x:585,y:405},{x:537,y:371},
   ],
   [
    {x:968,y:65},{x:1042,y:51},{x:1085,y:93},
    {x:1060,y:133},{x:991,y:135},
   ],
   [
    {x:1137,y:550},{x:1234,y:536},{x:1250,y:623},
    {x:1114,y:638},{x:1100,y:592},
   ],
   [
    {x:292,y:74},{x:335,y:65},{x:339,y:106},{x:308,y:116},
   ],
   [
    {x:710,y:597},{x:759,y:585},{x:773,y:631},
    {x:746,y:656},{x:697,y:632},
   ],
  ],
  // Reuse the global 1..100 program without duplicate wave rewards.
  waveOverrides:{},
 };
}
