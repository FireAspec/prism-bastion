import type {MapDef, SpawnGroup, Vec} from '../../contracts';

/** Every entrance has a permanent destination; the final trunk is shared. */
const shared:Vec[] = [
  {x:656,y:354},{x:744,y:354},{x:825,y:301},{x:934,y:301},
  {x:1022,y:353},{x:1084,y:353},
];
const upperExit:Vec[] = [{x:1140,y:300},{x:1192,y:211},{x:1280,y:211}];
const lowerExit:Vec[] = [{x:1140,y:407},{x:1192,y:510},{x:1280,y:510}];

const entrances:Vec[][] = [
  [{x:0,y:104},{x:102,y:104},{x:172,y:147},{x:289,y:147},
   {x:371,y:200},{x:478,y:200},{x:565,y:278}],
  [{x:0,y:266},{x:98,y:266},{x:188,y:292},{x:274,y:286},
   {x:380,y:302},{x:490,y:320},{x:565,y:342}],
  [{x:0,y:464},{x:98,y:464},{x:188,y:439},{x:274,y:443},
   {x:386,y:415},{x:490,y:399},{x:565,y:377}],
  [{x:0,y:624},{x:95,y:624},{x:180,y:557},{x:286,y:557},
   {x:373,y:497},{x:480,y:484},{x:565,y:421}],
];

const lanes:Vec[][] = entrances.map((entrance,index) => [
  ...entrance, ...shared, ...(index%2===0?upperExit:lowerExit),
]);

const blocked:Vec[][] = [
  [{x:311,y:44},{x:454,y:36},{x:474,y:94},{x:420,y:121},{x:316,y:119}],
  [{x:143,y:343},{x:226,y:329},{x:243,y:361},{x:210,y:394},{x:155,y:393}],
  [{x:356,y:591},{x:427,y:562},{x:471,y:598},{x:449,y:652},{x:381,y:660}],
  [{x:740,y:167},{x:816,y:163},{x:835,y:218},{x:792,y:246},{x:732,y:231}],
  [{x:851,y:447},{x:913,y:434},{x:944,y:472},{x:917,y:513},{x:851,y:502}],
  [{x:1113,y:81},{x:1188,y:86},{x:1190,y:145},{x:1124,y:151}],
  [{x:1118,y:574},{x:1192,y:582},{x:1192,y:644},{x:1124,y:654}],
];

const water:Vec[][] = [
  [{x:0,y:0},{x:1280,y:0},{x:1280,y:57},{x:1136,y:61},
   {x:1040,y:56},{x:890,y:67},{x:680,y:50},{x:471,y:68},
   {x:305,y:51},{x:141,y:65},{x:0,y:60}],
  [{x:594,y:77},{x:728,y:94},{x:856,y:117},{x:976,y:119},
   {x:1075,y:91},{x:1133,y:141},{x:1065,y:236},{x:979,y:246},
   {x:862,y:247},{x:783,y:250},{x:703,y:245},{x:619,y:211},{x:571,y:159}],
  [{x:590,y:521},{x:682,y:491},{x:812,y:487},{x:905,y:519},
   {x:1050,y:500},{x:1119,y:557},{x:1069,y:720},{x:551,y:720},{x:500,y:635}],
  [{x:258,y:343},{x:338,y:325},{x:382,y:344},{x:389,y:372},
   {x:338,y:402},{x:262,y:394}],
];

// Spawn lanes are explicit: never choose a hidden route or switch mid-wave.
// Difficulty determines the WaveSet prefix (40/60/80/100), not map difficulty.
const bossAt:Record<number,string> = {
  10:'boss-carapace',20:'boss-brood',40:'boss-mirror',
  60:'boss-chrono',80:'boss-tempest',100:'boss-eclipse',
};
// Explicit milestone lanes keep both exit beacons relevant in boss rounds.
const bossLanes:Record<number,number> = {10:0,20:3,40:2,60:1,80:0,100:3};
const profiles:{until:number;enemies:readonly string[]}[] = [
  {until:9,enemies:['scarlet','amber','jade','lemon']},
  {until:19,enemies:['violet','iron','glass','cloak','shield']},
  {until:39,enemies:['split','regrow','ruby','glacier','copper','dart']},
  {until:59,enemies:['obsidian','aegis','swarm','cloak','dart','shield']},
  {until:79,enemies:['royal','hollow','prismatic','aegis','copper','regrow']},
  {until:99,enemies:['juggernaut','herald','prismatic','royal','hollow','dart']},
  {until:100,enemies:['herald','prismatic','royal','juggernaut']},
];
const entranceNames = ['Северный шлюз','Верхний канал','Нижний канал','Южный шлюз'];
const exitNames = ['Северный маяк','Южный маяк'];

function mapWaves():MapDef['waveOverrides'] {
  const overrides:MapDef['waveOverrides'] = {};
  for(let wave=1;wave<=100;wave++) {
    const lane = bossLanes[wave]??(wave-1)%4;
    const phase = profiles.find(p=>wave<=p.until)!;
    const phaseStart = wave<=9?1:wave<=19?10:wave<=39?20:wave<=59?40:wave<=79?60:wave<=99?80:100;
    const primaryEnemy = phase.enemies[(wave-phaseStart)%phase.enemies.length];
    const boss = bossAt[wave];
    const groups:SpawnGroup[] = [];
    if(boss) {
      groups.push({enemy:boss,count:1,at:7,every:1,lane});
      groups.push({enemy:primaryEnemy,count:Math.min(5+Math.floor(wave/12),12),at:0,
        every:0.75,lane:(lane+2)%4});
    } else {
      groups.push({enemy:primaryEnemy,count:Math.min(7+Math.floor(wave/4),26),at:0,
        every:Math.max(0.30,0.62-wave*0.003),lane});
      if(wave>=13 && wave%3===0) {
        const support = phase.enemies[(wave-phaseStart+2)%phase.enemies.length];
        groups.push({enemy:support,count:Math.min(4+Math.floor(wave/9),13),
          at:4,every:0.67,lane:(lane+1)%4});
      }
    }
    const routes = [...new Set(groups.map(group=>group.lane))].map(index=>
      `${entranceNames[index]} → ${exitNames[index%2]}`);
    overrides[wave] = {
      groups,
      preview:`${boss?'БОСС · ':''}Волна ${wave}. Входы: ${routes.join('; ')}. Направления фиксированы.`,
      ...(boss?{boss}:{})
    };
  }
  return overrides;
}

const map:MapDef = {
  id:'heart-of-storm',name:'Сердце бури',
  description:'Финальный эстуарий. Четыре шлюза подают волны к общей дуге обороны, ' +
    'затем враги расходятся к двум открытым маякам. Синхронизируйте сеть маяков; ' +
    'победа приносит финальную медаль.',
  difficulty:4,campaignIndex:20,recommendedDifficulty:'extreme',theme:'estuary',
  background:'/art/maps/heart-of-storm/background.svg',pathWidth:38,
  lanes,blocked,water,waveOverrides:mapWaves(),
};

/** Return a detached snapshot, including nested wave groups. */
export function getMap():MapDef { return structuredClone(map); }
