import type {MapDef} from '../../contracts';

const lanes:MapDef['lanes'] = [
 [{x:0,y:164},{x:118,y:164},{x:190,y:208},{x:308,y:208},
  {x:386,y:164},{x:492,y:164},{x:572,y:240},{x:572,y:332},
  {x:650,y:360},{x:726,y:405},{x:726,y:522},{x:842,y:570},
  {x:972,y:570},{x:1058,y:522},{x:1164,y:522},{x:1280,y:526}],
 [{x:0,y:560},{x:100,y:560},{x:180,y:508},{x:284,y:508},
  {x:354,y:560},{x:450,y:560},{x:530,y:468},{x:530,y:398},
  {x:650,y:360},{x:758,y:308},{x:758,y:184},{x:858,y:140},
  {x:986,y:140},{x:1082,y:192},{x:1180,y:192},{x:1280,y:192}],
];

const blocked:MapDef['blocked'] = [
 [{x:602,y:79},{x:697,y:79},{x:709,y:115},{x:684,y:146},{x:618,y:146},{x:590,y:116}],
 [{x:320,y:76},{x:375,y:86},{x:387,y:119},{x:348,y:141},{x:309,y:123}],
 [{x:1020,y:254},{x:1090,y:263},{x:1107,y:294},{x:1071,y:317},{x:1004,y:302}],
 [{x:594,y:610},{x:616,y:586},{x:684,y:586},{x:711,y:619},{x:694,y:663},{x:609,y:659}],
 [{x:1096,y:610},{x:1141,y:597},{x:1208,y:621},{x:1197,y:661},{x:1110,y:664}],
];

const water:MapDef['water'] = [
 [{x:85,y:338},{x:110,y:306},{x:209,y:296},{x:281,y:328},
  {x:294,y:375},{x:265,y:425},{x:158,y:436},{x:91,y:407}],
 [{x:957,y:350},{x:994,y:329},{x:1126,y:336},{x:1171,y:367},
  {x:1148,y:419},{x:1021,y:433},{x:967,y:405}],
];

/** Each run receives independent arrays; the crossed lanes have no shared segments. */
export function getMap():MapDef {
 return {
  id:'mirror-terrace',
  name:'Зеркальные террасы',
  description:'Три открытые ступени сада ведут к разрушенной зеркальной мастерской. '
   +'Две независимые дороги пересекаются у центрального кристалла: '
   +'дальнобойные башни контролируют диагонали, но обе линии требуют прикрытия. '
   +'Соберите зеркальную мастерскую и откройте технологию «Зеркальная галерея».',
  difficulty:3,
  campaignIndex:14,
  recommendedDifficulty:'hard',
  waveOverrides:{},
  lanes:lanes.map(lane=>lane.map(point=>({...point}))),
  pathWidth:44,
  blocked:blocked.map(poly=>poly.map(point=>({...point}))),
  water:water.map(poly=>poly.map(point=>({...point}))),
  theme:'garden',
  background:'/art/maps/mirror-terrace/background.svg',
 };
}
