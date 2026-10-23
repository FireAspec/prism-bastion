import type {EnemyDef} from '../contracts';

type Seed = Pick<EnemyDef, 'id'|'name'|'description'|'shape'|'hp'|'speed'|'bounty'|'leak'> & {
  shells: Array<readonly [hp:number,cash:number,color:string]>;
} & Partial<Pick<EnemyDef,'radius'|'armor'|'shield'|'regen'|'cloaked'|'flying'|'resist'|'children'>>;

const SEEDS:Seed[] = [
  {id:'scarlet',name:'Алый осколок',description:'Обычный кристалл без защит: перехватывайте игольной башней на прямых участках.',shape:'shard',hp:12,speed:52,bounty:3,leak:1,radius:12,shells:[[5,1,'#f05b64'],[7,2,'#a92d50']]},
  {id:'amber',name:'Янтарный бегун',description:'Быстрый бегун: размещайте скорострельные башни у поворотов, используйте замедление.',shape:'diamond',hp:22,speed:72,bounty:4,leak:1,radius:13,shells:[[7,1,'#ffc15c'],[7,1,'#e98a43'],[8,2,'#a8563d']]},
  {id:'lemon',name:'Лимонная искра',description:'Очень быстрый и хрупкий: ловите ранним замедлением либо широкой зоной поражения.',shape:'shard',hp:14,speed:115,bounty:4,leak:1,radius:11,shells:[[4,1,'#f5ed70'],[4,1,'#bed957'],[6,2,'#719d58']]},
  {id:'jade',name:'Нефритовый',description:'Толстые оболочки, низкая скорость: помогает концентрированный урон на длинных секторах обстрела.',shape:'hex',hp:58,speed:46,bounty:6,leak:2,radius:17,shells:[[15,1,'#78d4a6'],[18,2,'#37a985'],[25,3,'#267f77']]},
  {id:'azure',name:'Лазурный',description:'Умеренно быстрый и плотный: объединяйте точечные выстрелы с замедлением у поворота.',shape:'orb',hp:35,speed:82,bounty:5,leak:1,radius:15,shells:[[9,1,'#6bd2f0'],[11,2,'#369bcf'],[15,2,'#466ab9']]},
  {id:'violet',name:'Фиолетовый',description:'Первый энергетический щит: сначала пробейте щит усиленным уроном по щитам, затем снимайте слои.',shape:'diamond',hp:80,speed:58,bounty:7,leak:2,radius:17,shield:45,shells:[[20,2,'#bb8cf2'],[25,2,'#875dcc'],[35,3,'#6344a5']]},
  {id:'iron',name:'Железный',description:'Броня 8 ослабляет частые слабые удары: применяйте бронепробитие, shred и сильные выстрелы.',shape:'hex',hp:130,speed:38,bounty:9,leak:3,radius:19,armor:8,shells:[[35,2,'#b8bfc9'],[40,3,'#8b9ba7'],[55,4,'#536b7c']]},
  {id:'glass',name:'Стеклянный',description:'После гибели выпускает двух мошек: переключайте огонь на мелкие цели или бейте по площади.',shape:'shard',hp:25,speed:70,bounty:5,leak:1,radius:14,children:[{id:'swarm',count:2}],shells:[[7,1,'#b5f3f2'],[8,2,'#81c8eb'],[10,2,'#8ca9d5']]},
  {id:'cloak',name:'Теневой',description:'Скрыт от башен без обнаружения: маяк или статус reveal раскрывает цель остальной защите.',shape:'orb',hp:48,speed:65,bounty:7,leak:2,radius:15,cloaked:true,shells:[[12,2,'#9491c4'],[16,2,'#68669c'],[20,3,'#444872']]},
  {id:'regrow',name:'Почкователь',description:'Восстанавливает 4 HP/с, но выплаты не возобновляются: нужен постоянный урон или яд.',shape:'hex',hp:95,speed:42,bounty:8,leak:2,radius:18,regen:4,shells:[[25,2,'#9ee294'],[30,3,'#60b78f'],[40,3,'#348878']]},
  {id:'shield',name:'Щитоносец',description:'Щит 100 поглощает урон до начала оплачиваемых HP-слоёв: применяйте повышенный урон по щитам.',shape:'hex',hp:95,speed:45,bounty:9,leak:2,radius:18,shield:100,shells:[[25,2,'#9dc2f5'],[30,3,'#679fdb'],[40,4,'#4479b7']]},
  {id:'split',name:'Дробящийся',description:'После гибели оставляет два алых осколка: готовьте добивание потомков атаками по площади.',shape:'diamond',hp:75,speed:48,bounty:4,leak:2,radius:17,children:[{id:'scarlet',count:2}],shells:[[20,1,'#e3a0bc'],[25,1,'#c36e9c'],[30,2,'#944a7e']]},
  {id:'ruby',name:'Рубиновый',description:'Поглощает 50% огненного урона: используйте кинетику, холод или другое неогненное оружие.',shape:'diamond',hp:180,speed:40,bounty:12,leak:4,radius:19,resist:{fire:.5},shells:[[45,3,'#ff7184'],[60,4,'#da4a68'],[75,5,'#973454']]},
  {id:'glacier',name:'Ледяной',description:'Сопротивляется 50% холодного урона: добивайте кинетическим или огненным оружием.',shape:'shard',hp:160,speed:42,bounty:12,leak:3,radius:20,resist:{frost:.5},shells:[[40,3,'#b7effc'],[50,4,'#79c4e4'],[70,5,'#538fbf']]},
  {id:'copper',name:'Медный',description:'Поглощает 50% электрического урона: используйте огненные и кинетические атаки.',shape:'hex',hp:210,speed:44,bounty:13,leak:4,radius:20,resist:{electric:.5},shells:[[55,3,'#f0b77a'],[65,4,'#c98b67'],[90,6,'#966a62']]},
  {id:'obsidian',name:'Обсидиан',description:'Броня 20 почти гасит слабые удары: используйте бронепробитие, shred и мощные попадания.',shape:'shard',hp:350,speed:32,bounty:16,leak:5,radius:23,armor:20,shells:[[80,4,'#7c7897'],[120,5,'#595772'],[150,7,'#36384f']]},
  {id:'dart',name:'Стрела',description:'Летающий разведчик обходит напольные ловушки: ставьте дальнобойные прямые атаки и замедление.',shape:'shard',hp:70,speed:132,bounty:8,leak:2,radius:13,flying:true,shells:[[18,2,'#9ce8de'],[22,3,'#56bcb9'],[30,3,'#428f9f']]},
  {id:'swarm',name:'Мошка',description:'Мелкая одиночная цель: частые дешёвые выстрелы и атаки по площади справляются с роем.',shape:'orb',hp:9,speed:95,bounty:1,leak:1,radius:9,shells:[[9,1,'#e0d795']]},
  {id:'aegis',name:'Эгида',description:'Большой щит 300 требует концентрированного шквального урона по щитам: броня здесь не препятствие.',shape:'hex',hp:330,speed:35,bounty:17,leak:5,radius:22,shield:300,shells:[[75,4,'#c6c0fb'],[100,5,'#978fe1'],[155,8,'#635aaf']]},
  {id:'royal',name:'Королевский',description:'Броня 12 и два Дробящихся после смерти, затем четыре Алых: бронепробитие плюс атаки по площади.',shape:'crown',hp:450,speed:40,bounty:20,leak:6,radius:23,armor:12,children:[{id:'split',count:2}],shells:[[100,5,'#f4d79b'],[150,6,'#d9aa77'],[200,9,'#9e705e']]},
  {id:'hollow',name:'Полый',description:'Быстрый скрытый кристалл без брони: сначала обнаружение маяком, затем концентрированный огонь.',shape:'diamond',hp:120,speed:75,bounty:10,leak:3,radius:17,cloaked:true,shells:[[30,2,'#adacc9'],[40,3,'#797eaa'],[50,5,'#494b77']]},
  {id:'prismatic',name:'Радужный',description:'Пять оболочек; выпускает Королевского и двух Стеклянных с потомками: нужно пробитие и зачистка площади.',shape:'crown',hp:600,speed:36,bounty:22,leak:7,radius:24,children:[{id:'royal',count:1},{id:'glass',count:2}],shells:[[70,2,'#e89ccb'],[90,3,'#a6a5f1'],[120,4,'#7acfe8'],[140,5,'#96daa5'],[180,8,'#f3c479']]},
  {id:'juggernaut',name:'Монолит',description:'Огромные 1000 HP без иммунитета: удерживайте под перекрёстным огнём и усиливайте урон одной цели.',shape:'hex',hp:1000,speed:24,bounty:30,leak:10,radius:27,shells:[[200,7,'#b0b4c5'],[300,9,'#797f9c'],[500,14,'#515a78']]},
  {id:'herald',name:'Глашатай',description:'Элитный предбосс с бронёй, щитом, Королевским и двумя Стрелами после гибели: пробитие, контроль и добивание.',shape:'crown',hp:1600,speed:28,bounty:40,leak:12,radius:28,armor:8,shield:160,children:[{id:'royal',count:1},{id:'dart',count:2}],shells:[[300,7,'#fae6b5'],[400,9,'#d7b48c'],[400,10,'#a98691'],[500,14,'#6d6588']]},
];

/** Independent copies are required for simultaneous solo/co-op run configs. */
export function getEnemies():EnemyDef[] {
  return SEEDS.map(s=>({id:s.id,name:s.name,description:s.description,shape:s.shape,
    hp:s.hp,speed:s.speed,bounty:s.bounty,leak:s.leak,color:s.shells[0]![2],
    radius:s.radius??16,armor:s.armor??0,shield:s.shield??0,regen:s.regen??0,
    cloaked:s.cloaked??false,flying:s.flying??false,resist:{...s.resist},
    children:(s.children??[]).map(child=>({...child})),
    layers:s.shells.map(([hp,cash,color])=>({hp,cash,color}))}));
}
