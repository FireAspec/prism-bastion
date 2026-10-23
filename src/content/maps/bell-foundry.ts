import type {MapDef,Vec} from '../../contracts';

/** World-space geometry for the restored bell works, 1280 × 720 pixels. */
const lanes:Vec[][]=[
  [{x:0,y:150},{x:888,y:150},{x:888,y:287},{x:255,y:287},{x:255,y:431},{x:935,y:431},{x:935,y:579},{x:0,y:579}],
  [{x:0,y:76},{x:193,y:76},{x:193,y:150},{x:888,y:150},{x:888,y:287},{x:255,y:287},{x:255,y:431},{x:935,y:431},{x:935,y:579},{x:0,y:579}],
  [{x:1280,y:350},{x:1050,y:350},{x:935,y:431},{x:935,y:579},{x:0,y:579}],
];
const blocked:Vec[][]=[
  [{x:976,y:25},{x:1251,y:25},{x:1251,y:287},{x:976,y:287}],
  [{x:1012,y:477},{x:1257,y:477},{x:1257,y:699},{x:1012,y:699}],
  [{x:37,y:334},{x:167,y:334},{x:167,y:511},{x:37,y:511}],
  [{x:548,y:332},{x:655,y:332},{x:675,y:350},{x:675,y:390},{x:548,y:390}],
  [{x:408,y:28},{x:595,y:28},{x:595,y:90},{x:408,y:90}],
];
const water:Vec[][]=[
  [{x:402,y:642},{x:554,y:631},{x:601,y:648},{x:591,y:702},{x:412,y:701}],
  [{x:653,y:632},{x:805,y:635},{x:822,y:675},{x:795,y:704},{x:648,y:696}],
];

export interface FoundrySite {id:string;name:string;pos:Vec;radius:number;role:'land'|'water'}
/** Recommended, unobstructed pads; building is not restricted to these sites. */
export const BELL_FOUNDRY_SITES:readonly FoundrySite[]=[
  {id:'north-anvil',name:'Северная наковальня',pos:{x:762,y:219},radius:32,role:'land'},
  {id:'west-bell',name:'Западный колокол',pos:{x:349,y:357},radius:32,role:'land'},
  {id:'east-crucible',name:'Восточный тигель',pos:{x:826,y:503},radius:32,role:'land'},
  {id:'hearth-west',name:'Запад кузни',pos:{x:457,y:362},radius:32,role:'land'},
  {id:'hearth-east',name:'Восток кузни',pos:{x:771,y:355},radius:32,role:'land'},
  {id:'feed-station',name:'Подача руды',pos:{x:410,y:215},radius:32,role:'land'},
  {id:'early-platform',name:'Начальная платформа',pos:{x:130,y:213},radius:32,role:'land'},
  {id:'coal-station',name:'Угольный пост',pos:{x:600,y:218},radius:32,role:'land'},
  {id:'slag-platform',name:'Шлаковая платформа',pos:{x:705,y:503},radius:32,role:'land'},
  {id:'south-platform',name:'Южная платформа',pos:{x:381,y:504},radius:32,role:'land'},
  {id:'west-exit',name:'Страж выхода',pos:{x:210,y:659},radius:32,role:'land'},
  {id:'east-exit',name:'Дальний заслон',pos:{x:912,y:660},radius:32,role:'land'},
  {id:'cooling-west',name:'Западное охлаждение',pos:{x:495,y:671},radius:25,role:'water'},
  {id:'cooling-east',name:'Восточное охлаждение',pos:{x:744,y:669},radius:25,role:'water'},
];
const copy=(polygons:Vec[][]):Vec[][]=>polygons.map(poly=>poly.map(p=>({...p})));

export function getMap():MapDef {return {
  id:'bell-foundry',name:'Колокольная литейная',
  description:'Зажгите центральную кузню. Три глубоких разворота рудного пути дают перекрёстный огонь, но цеха закрывают дальние площадки. Северный и шлаковый входы видны заранее; общий выход на западе.',
  difficulty:2,campaignIndex:7,recommendedDifficulty:'normal',theme:'foundry',
  // Three legal lanes support all shared-wave lane indices; no hidden boss or reward changes.
  waveOverrides:{},lanes:copy(lanes),pathWidth:46,blocked:copy(blocked),water:copy(water),
  background:'/art/maps/bell-foundry/background.svg',
};}
