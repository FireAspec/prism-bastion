import type {MapDef, Vec} from '../../contracts';

/**
 * The three approaches are permanent; none is a hidden conditional shortcut.
 * They meet at (972, 357) and share 308 px of last-chance defence.
 * The lighthouse itself is terrain, not a fourth entry or a tower slot.
 */
const lastStand:Vec[] = [
  {x:972,y:357}, {x:1140,y:357}, {x:1280,y:357},
];

const map:MapDef = {
  id:'black-lighthouse',
  name:'Чёрный маяк',
  description:'Три берега ведут к осаждённому маяку. Займите сухие уступы, удержите устье и прорвите осаду бастиона.',
  difficulty:4,
  campaignIndex:19,
  recommendedDifficulty:'extreme',
  theme:'estuary',
  pathWidth:38,
  background:'/art/maps/black-lighthouse/background.svg',
  lanes:[
    // Northern sea-wall: a long, elevated approach with an exposed upper bend.
    [
      {x:0,y:104},{x:116,y:104},{x:238,y:128},{x:332,y:102},
      {x:442,y:125},{x:510,y:190},{x:615,y:208},{x:692,y:150},
      {x:792,y:168},{x:855,y:260},{x:943,y:310},...lastStand,
    ],
    // Central quay: the shortest attack lane, pressuring early decisions.
    [
      {x:0,y:336},{x:135,y:336},{x:212,y:310},{x:280,y:330},
      {x:350,y:380},{x:435,y:398},{x:515,y:355},{x:590,y:312},
      {x:687,y:337},{x:788,y:345},{x:878,y:350},...lastStand,
    ],
    // Southern tidal road: a wide flanking route through the salt shoals.
    [
      {x:0,y:628},{x:130,y:628},{x:207,y:590},{x:250,y:540},{x:270,y:635},
      {x:332,y:650},{x:432,y:608},{x:488,y:537},{x:572,y:520},
      {x:655,y:566},{x:735,y:565},{x:792,y:478},{x:878,y:440},
      {x:932,y:418},...lastStand,
    ],
  ],
  water:[
    // Open northern sea, independent of the inland shoals.
    [{x:0,y:0},{x:1280,y:0},{x:1280,y:99},{x:1180,y:87},
     {x:1055,y:104},{x:940,y:74},{x:810,y:66},{x:700,y:42},
     {x:580,y:55},{x:440,y:32},{x:285,y:65},{x:132,y:47},{x:0,y:56}],
    // Deep harbour pocket: room for a water footprint, not just a blue seam.
    [{x:0,y:178},{x:198,y:182},{x:247,y:204},{x:237,y:259},
     {x:143,y:270},{x:0,y:262}],
    // Mid-estuary basin separates the central and southern shore batteries.
    [{x:398,y:433},{x:477,y:420},{x:538,y:442},{x:610,y:413},
     {x:686,y:424},{x:724,y:462},{x:692,y:502},{x:610,y:493},
     {x:535,y:504},{x:462,y:480},{x:398,y:494}],
    // Southern flooded flats, large enough for high-tier water towers.
    [{x:1000,y:516},{x:1060,y:522},{x:1130,y:510},{x:1280,y:482},
     {x:1280,y:720},{x:826,y:720},{x:835,y:662},
     {x:915,y:610},{x:955,y:562}],
    [{x:0,y:675},{x:170,y:687},{x:312,y:697},{x:440,y:681},
     {x:504,y:700},{x:504,y:720},{x:0,y:720}],
  ],
  blocked:[
    // Lighthouse cliff, visible in the background; never an implied tower pad.
    [{x:1090,y:165},{x:1173,y:155},{x:1218,y:196},
     {x:1200,y:284},{x:1150,y:305},{x:1085,y:276},{x:1062,y:220}],
    // Beached ship, western pier foundation, southern masonry, old battery.
    [{x:256,y:154},{x:304,y:151},{x:324,y:178},
     {x:300,y:198},{x:248,y:188}],
    [{x:65,y:484},{x:144,y:479},{x:182,y:509},
     {x:170,y:543},{x:96,y:546}],
    [{x:535,y:606},{x:595,y:608},{x:618,y:661},
     {x:578,y:684},{x:521,y:655}],
    [{x:912,y:102},{x:964,y:96},{x:995,y:120},
     {x:989,y:154},{x:931,y:151}],
  ],
  // The global 1..100 schedule already contains all six telegraphed bosses.
  // Overrides must not be guessed while the wave catalog is still pending.
  waveOverrides:{},
};

/** Return a fresh graph: the simulation and editor must never mutate source data. */
export function getMap():MapDef {
  return structuredClone(map);
}
