import type {MapDef,SpawnGroup} from '../../contracts';

/** Two independently traversable entrances and one common eastern exit. */
export function getMap():MapDef {
 const g=(enemy:string,count:number,at:number,every:number,lane:0|1):SpawnGroup=>({enemy,count,at,every,lane});
 return {
  id:'freight-yard',name:'Грузовой двор',campaignIndex:6,difficulty:2,
  recommendedDifficulty:'normal',theme:'foundry',pathWidth:52,
  description:'Верните транспортный ангар. Составы по очереди подходят с запада и юга; обе дороги сходятся у восточных ворот. Центральный перегрузочный перрон простреливает обе линии.',
  background:'/art/maps/freight-yard/background.svg',
  lanes:[
   [{x:0,y:164},{x:148,y:164},{x:220,y:213},{x:332,y:213},
    {x:399,y:154},{x:519,y:154},{x:586,y:213},{x:697,y:213},
    {x:749,y:160},{x:833,y:160},{x:892,y:247},{x:969,y:248},
    {x:1009,y:326},{x:1070,y:380},{x:1176,y:380},{x:1280,y:380}],
   [{x:941,y:720},{x:941,y:640},{x:845,y:612},{x:748,y:612},
    {x:672,y:540},{x:555,y:540},{x:493,y:584},{x:372,y:584},
    {x:305,y:524},{x:305,y:458},{x:403,y:428},{x:523,y:428},
    {x:627,y:476},{x:762,y:476},{x:868,y:413},{x:981,y:413},
    {x:1070,y:380},{x:1176,y:380},{x:1280,y:380}],
  ],
  blocked:[
   [{x:34,y:12},{x:326,y:12},{x:326,y:92},{x:240,y:100},{x:34,y:100}],
   [{x:727,y:10},{x:1110,y:10},{x:1110,y:102},{x:918,y:108},{x:880,y:100},{x:727,y:96}],
   [{x:36,y:335},{x:192,y:335},{x:209,y:409},{x:36,y:409}],
   [{x:1085,y:150},{x:1236,y:150},{x:1244,y:257},{x:1102,y:262}],
   [{x:365,y:656},{x:572,y:642},{x:583,y:704},{x:366,y:711}],
  ],
  water:[
   [{x:8,y:480},{x:197,y:480},{x:239,y:519},{x:224,y:704},{x:8,y:704}],
   [{x:1053,y:526},{x:1237,y:522},{x:1272,y:562},{x:1272,y:705},{x:1050,y:705},{x:1029,y:628}],
  ],
  // Replace the introductory groups only. Boss identity and wave payouts come
  // from the shared 1..100-wave programme, never twice from this map.
  waveOverrides:{
   1:{groups:[g('scarlet',10,1,1.15,0)],preview:'Западный состав: алые осколки'},
   2:{groups:[g('scarlet',12,1,1.1,1)],preview:'Южный состав: алые осколки'},
   3:{groups:[g('scarlet',11,1,1,0),g('amber',5,9,1.4,1)],preview:'Сначала запад, затем быстрый юг'},
   4:{groups:[g('amber',9,1,1.25,1),g('scarlet',12,8,.95,0)],preview:'Юг первым; запад усиливается'},
   5:{groups:[g('jade',7,1,1.8,0),g('scarlet',16,10,.8,1)],preview:'Нефрит с запада; алый поток с юга'},
   6:{groups:[g('lemon',10,1,1.15,1),g('jade',9,10,1.7,0)],preview:'Быстрые южные искры; прочный запад'},
   7:{groups:[g('azure',12,1,1.35,0),g('amber',12,9,1.05,1)],preview:'Лазурный запад; янтарный юг'},
   8:{groups:[g('violet',7,1,1.8,1),g('iron',4,13,2.1,0)],preview:'Южные щиты; западная броня'},
   9:{groups:[g('scarlet',18,1,.8,0),g('iron',7,9,1.7,1),g('lemon',9,18,.9,0)],preview:'Три чередующихся эшелона перед боссом'},
  },
 };
}
