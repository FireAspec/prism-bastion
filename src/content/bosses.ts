import type {BossPhase,Element,EnemyDef} from '../contracts';

/** The listed thresholds are crossed against the original maximum HP. */
type BossSpec = {
  id:string; name:string; description:string; color:string;
  shape:EnemyDef['shape']; hp:number; speed:number; bounty:number; leak:number;
  radius:number; armor:number; shield:number; controlFactor:number;
  resist:Partial<Record<Element,number>>;
  layers:readonly (readonly [hp:number,cash:number,color:string])[];
  phases:readonly BossPhase[];
};

function defineBoss(spec:BossSpec):EnemyDef{
  return {
    id:spec.id,name:spec.name,description:spec.description,color:spec.color,shape:spec.shape,
    hp:spec.hp,speed:spec.speed,bounty:spec.bounty,leak:spec.leak,radius:spec.radius,
    armor:spec.armor,shield:spec.shield,regen:0,cloaked:false,flying:false,
    resist:spec.resist,children:[],
    layers:spec.layers.map(([hp,cash,color])=>({hp,cash,color})),
    boss:{controlFactor:spec.controlFactor,phases:[...spec.phases]},
  };
}

/**
 * Pure content: the combat module owns one-shot phase dispatch, spawn scheduling,
 * shield changes and paidLayers. Boss assets live at /art/bosses/<id>.svg; phase
 * variants are /art/bosses/<id>/<id>-phase-1..3.svg.
 */
const BOSSES:EnemyDef[] = [
  defineBoss({
    id:'boss-carapace',name:'Панцирник',color:'#e9a968',shape:'hex',
    description:'Волна 10 · Бронированные створки раскрываются на 70% и 35% HP. Светящиеся швы подсказывают, где полезно бронепробитие; из трещин выходят железные осколки.',
    hp:6000,speed:18,bounty:350,leak:35,radius:40,armor:5,shield:300,controlFactor:0.36,
    resist:{kinetic:0.10,frost:0.12},
    layers:[[700,40,'#f5d7a3'],[1000,55,'#dba76e'],[1100,70,'#ba774a'],[1400,85,'#80513c'],[1800,100,'#4a393c']],
    phases:[
      {atHealth:0.70,shield:170,speedMul:1,spawn:'iron',count:2,interval:0.65},
      {atHealth:0.35,shield:0,speedMul:1.12,spawn:'iron',count:3,interval:0.55},
      {atHealth:0.12,shield:0,speedMul:1.23,spawn:'iron',count:1,interval:0.65},
    ],
  }),
  defineBoss({
    id:'boss-brood',name:'Матка осколков',color:'#f1a4c7',shape:'shard',
    description:'Волна 20 · Яйцевые гнёзда трескаются на 75%, 50% и 25% HP. Видимые рои мошек проверяют урон по площади, но матка всегда уязвима для прямых попаданий.',
    hp:22000,speed:16,bounty:1200,leak:45,radius:45,armor:3,shield:0,controlFactor:0.30,
    resist:{acid:0.16,fire:0.08},
    layers:[[1800,90,'#f5dbe9'],[2600,115,'#eea3c7'],[3000,135,'#d67eae'],[3300,160,'#b15f95'],[3600,190,'#86486f'],[3500,225,'#5d3d65'],[4200,285,'#372d4d']],
    phases:[
      {atHealth:0.75,shield:0,speedMul:1.05,spawn:'swarm',count:8,interval:0.22},
      {atHealth:0.50,shield:0,speedMul:1.12,spawn:'swarm',count:10,interval:0.20},
      {atHealth:0.25,shield:0,speedMul:1.22,spawn:'swarm',count:12,interval:0.18},
    ],
  }),
  defineBoss({
    id:'boss-mirror',name:'Зеркальный регент',color:'#b6e9f6',shape:'crown',
    description:'Волна 40 · Три перестройки отражающей мозаики возобновляют щит и выпускают теневых осколков. Сочетайте источники урона с обнаружением: иммунитета нет.',
    hp:65000,speed:17,bounty:1800,leak:55,radius:48,armor:8,shield:14000,controlFactor:0.27,
    resist:{energy:0.32,kinetic:0.13,frost:0.12},
    layers:[[5000,170,'#e2fbff'],[7000,210,'#bde9f1'],[9000,250,'#94c6e4'],[11000,300,'#6f9dc4'],[13000,370,'#526a99'],[20000,500,'#383e73']],
    phases:[
      {atHealth:0.74,shield:11000,speedMul:1,spawn:'cloak',count:3,interval:0.9},
      {atHealth:0.49,shield:8500,speedMul:1.07,spawn:'hollow',count:4,interval:0.75},
      {atHealth:0.24,shield:6000,speedMul:1.15,spawn:'cloak',count:5,interval:0.6},
    ],
  }),
  defineBoss({
    id:'boss-chrono',name:'Пожиратель секунд',color:'#f6c981',shape:'orb',
    description:'Волна 60 · Циферблат теряет сегменты на 72%, 45% и 20% HP. Враг разгоняется и выпускает быстрых преследователей, но не останавливает время игры.',
    hp:160000,speed:18,bounty:3700,leak:65,radius:47,armor:11,shield:2500,controlFactor:0.20,
    resist:{frost:0.30,electric:0.10},
    layers:[[12000,300,'#fce3ab'],[16000,360,'#f3c579'],[20000,430,'#e4a752'],[24000,500,'#bb8349'],[28000,590,'#946248'],[30000,700,'#6c4c49'],[30000,820,'#473b4e']],
    phases:[
      {atHealth:0.72,shield:2000,speedMul:1.18,spawn:'dart',count:3,interval:0.72},
      {atHealth:0.45,shield:0,speedMul:1.38,spawn:'amber',count:5,interval:0.58},
      {atHealth:0.20,shield:0,speedMul:1.55,spawn:'dart',count:6,interval:0.44},
    ],
  }),
  defineBoss({
    id:'boss-tempest',name:'Сердце шторма',color:'#8ce7e6',shape:'orb',
    description:'Волна 80 · На 73%, 46% и 20% HP шторм возвращает конечный щит. Три вида свиты заставляют распределять оборону и вовремя снимать щиты.',
    hp:360000,speed:16,bounty:7100,leak:75,radius:53,armor:13,shield:50000,controlFactor:0.22,
    resist:{electric:0.38,frost:0.15,energy:0.10},
    layers:[[30000,650,'#d8fff2'],[38000,760,'#aae9ea'],[47000,870,'#83cace'],[55000,980,'#5aa6b5'],[61000,1130,'#417e9a'],[65000,1270,'#385b82'],[64000,1440,'#313958']],
    phases:[
      {atHealth:0.73,shield:50000,speedMul:1.02,spawn:'aegis',count:3,interval:0.9},
      {atHealth:0.46,shield:40000,speedMul:1.12,spawn:'dart',count:6,interval:0.54},
      {atHealth:0.20,shield:30000,speedMul:1.24,spawn:'copper',count:5,interval:0.66},
    ],
  }),
  defineBoss({
    id:'boss-eclipse',name:'Затмение',color:'#d9b4ff',shape:'crown',
    description:'Волна 100 · Поначалу защищено бронёй, затем поднимает щиты, а под конец раскрывает крылья и ускоряется с двумя глашатаями.',
    hp:800000,speed:15,bounty:14000,leak:100,radius:58,armor:34,shield:0,controlFactor:0.16,
    resist:{energy:0.24,fire:0.20,electric:0.16,kinetic:0.10},
    layers:[[60000,1200,'#f8e0ff'],[80000,1400,'#dbc1f5'],[100000,1700,'#b3a1dc'],[120000,1900,'#9983c4'],[130000,2200,'#795d9b'],[140000,2500,'#5a427c'],[170000,3100,'#302d59']],
    phases:[
      {atHealth:0.75,shield:45000,speedMul:1,spawn:'royal',count:2,interval:1},
      {atHealth:0.49,shield:90000,speedMul:1.06,spawn:'aegis',count:4,interval:0.8},
      {atHealth:0.23,shield:0,speedMul:1.62,spawn:'herald',count:2,interval:1.1},
    ],
  }),
];

/** Deep copies prevent battle state, saves or other runs mutating shared content. */
export function getBosses():EnemyDef[]{return structuredClone(BOSSES);}
