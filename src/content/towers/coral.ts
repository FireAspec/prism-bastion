import type {AbilityDef, AttackDef, EffectDef, StatDelta, StatusSpec, TowerDef, UpgradeDef, VisualState} from '../../contracts';

const ART = '/art/towers/coral/';
const poison = (power:number,duration:number,maxStacks:number):StatusSpec => ({kind:'poison',power,duration,maxStacks});
const visual = (asset:string,accent:string,motion:VisualState['motion'],projectile:string,impact:string,glow=0.45):VisualState => ({
 asset:`${ART}${asset}.svg`,accent,muzzle:'coral-spore',projectile,impact,scale:1,glow,motion,
});
const needleVisual = (tier:number) => visual(`a${tier}`,'#eafff9',tier===5?'pulse':'breathe','reef-needle','needle-shatter',0.35+tier*0.1);
const livingVisual = (tier:number) => visual(`b${tier}`,'#ffc78b','breathe','pearl-seed','coral-bloom',0.35+tier*0.1);
const toxinVisual = (tier:number) => visual(`c${tier}`,'#abff8e',tier>=4?'orbit':'pulse','venom-medusa','spore-burst',0.4+tier*0.1);
const aura = (id:string,stat:NonNullable<EffectDef['stat']>,power:number,radius:number):EffectDef => ({
 id,kind:'aura',stat,power,radius,interval:1,duration:1.1,cap:1,
});
const burst = (id:string,power:number,radius:number,cap:number,status:StatusSpec):EffectDef => ({
 id,kind:'deathBurst',element:'acid',power,radius,interval:0,duration:0,cap,status,
});
const nova = (id:string,name:string,power:number,radius:number,cooldown:number,element:AbilityDef['element']):AbilityDef => ({
 id,name,description:`Импульс наносит ${power} ед. урона (${element}) в радиусе ${radius}; перезарядка ${cooldown} с.`,
 cooldown,kind:'nova',power,radius,duration:0,element,
});
const upgrade = (
 path:'a'|'b'|'c',tier:1|2|3|4|5,name:string,description:string,cost:number,
 delta:StatDelta,visualState:VisualState,extra:Pick<UpgradeDef,'addStatuses'|'effects'|'abilities'>={},
):UpgradeDef => ({id:`coral-${path}${tier}`,name,description,tier,cost,delta,visual:visualState,...extra});

const attack:AttackDef = {
 mode:'shot',element:'kinetic',damage:8,interval:0.65,range:155,
 pierce:1,count:1,splash:0,chains:0,chainRadius:0,detects:false,
 armorPierce:0,shieldMultiplier:1,bossMultiplier:1,executeBelow:0,push:0,
 statuses:[],projectileSpeed:350,projectileRadius:3,homing:false,windup:0.09,arc:0,
};

/** Independent, data-only tower. Crosspath deltas compose without replacing the primary attack. */
export function getTower():TowerDef {
 return {
  id:'coral',name:'Коралловый страж',
  description:'Водный стрелковый риф: известковые иглы, живые полипы поддержки или ядовитая колония.',
  category:'water',cost:650,footprint:26,placement:'water',
  attack:{...attack,statuses:[]},effects:[],abilities:[],
  visual:visual('base','#86e2db','breathe','pearl-seed','needle-shatter',0.4),
  paths:[
   {
    id:'coral-a',name:'Рифовые иглы',description:'Скоростные белые залпы с множественным пробитием.',
    upgrades:[
     upgrade('a',1,'Шипы рассвета','Пробитие +1; скорость снаряда ×1,15.',325,
      {pierceAdd:1,projectileSpeedMul:1.15},needleVisual(1)),
     upgrade('a',2,'Двойной венец','На каждом выстреле +1 игла; интервал ×0,92.',650,
      {countAdd:1,intervalMul:0.92},needleVisual(2)),
     upgrade('a',3,'Расколотый горизонт','Ещё +2 иглы и +2 пробития; интервал ×0,78, дальность ×1,05.',1625,
      {countAdd:2,pierceAdd:2,intervalMul:0.78,rangeMul:1.05},needleVisual(3)),
     upgrade('a',4,'Копья рифового трона','Ещё +2 иглы, +3 пробития, бронепробитие +3; урон ×1,6, интервал ×0,76.',3900,
      {countAdd:2,pierceAdd:3,armorPierceAdd:3,damageMul:1.6,intervalMul:0.76},needleVisual(4)),
     upgrade('a',5,'Белая тысяча','Высокий разветвлённый риф: ещё +3 иглы, +7 пробития; урон ×1,45, интервал ×0,86. Активный залп по площади.',9750,
      {countAdd:3,pierceAdd:7,damageMul:1.45,intervalMul:0.86},needleVisual(5),
      {abilities:[nova('coral-a-white-tide','Белый прилив',260,210,35,'energy')]}),
    ],
   },
   {
    id:'coral-b',name:'Живой риф',description:'Тёплые полипы повышают урон и дальность союзников.',
    upgrades:[
     upgrade('b',1,'Тёплые отростки','Дальность ×1,14, собственный урон ×1,10.',310,
      {rangeMul:1.14,damageMul:1.1},livingVisual(1)),
     upgrade('b',2,'Жемчужная влага','Интервал ×0,90; попадание накладывает намокание на 2,5 с.',620,
      {intervalMul:0.9},livingVisual(2),{addStatuses:[{kind:'wet',power:1,duration:2.5,maxStacks:1}]}),
     upgrade('b',3,'Дыхание полипов','Аура урона союзникам +8% в радиусе 145, дальность башни ×1,08.',1545,
      {rangeMul:1.08},livingVisual(3),{effects:[aura('coral-b-living-damage','damage',0.08,145)]}),
     upgrade('b',4,'Арки симбиоза','Аура дальности союзникам +14% в радиусе 175; собственный урон ×1,45.',3705,
      {damageMul:1.45},livingVisual(4),{effects:[aura('coral-b-reach','range',0.14,175)]}),
     upgrade('b',5,'Дворец живых приливов','Раскрытый коралловый дворец: вторая аура урона +20% в радиусе 215, дальность ×1,2, ещё 2 снаряда и активная волна.',9265,
      {rangeMul:1.2,countAdd:2},livingVisual(5),{
       effects:[aura('coral-b-heart','damage',0.20,215)],
       abilities:[nova('coral-b-heart-pulse','Сердцебиение дворца',230,190,40,'energy')],
      }),
    ],
   },
   {
    id:'coral-c',name:'Морской яд',description:'Яд, заражение и кислотные взрывы на гибели врагов.',
    upgrades:[
     upgrade('c',1,'Растворяющий известняк','Бронепробитие +2; радиус всплеска увеличен на 9 пикселей.',360,
      {armorPierceAdd:2,splashAdd:9},toxinVisual(1)),
     upgrade('c',2,'Пыль зелёных чаш','Яд силой 2 на 3 с (до 2 слоёв); обнаружение скрытых.',720,
      {detects:true},toxinVisual(2),{addStatuses:[poison(2,3,2)]}),
     upgrade('c',3,'Лабиринт токсинов','Дополнительный яд силой 6 на 4 с (до 3 слоёв); всплеск +20, урон ×1,25.',1790,
      {damageMul:1.25,splashAdd:20},toxinVisual(3),{addStatuses:[poison(6,4,3)]}),
     upgrade('c',4,'Взрывоцвет','Гибель заражённого: взрыв силой 42, радиус 62, до 6 целей; урон ×1,35 и пробитие +1.',4295,
      {damageMul:1.35,pierceAdd:1},toxinVisual(4),{effects:[burst('coral-c-infection-bloom',42,62,6,poison(3,2,2))]}),
     upgrade('c',5,'Матка изумрудных медуз','Асимметричный риф: +2 снаряда, всплеск +25, яд 16 на 6 с (5 слоёв), взрыв 120 в радиусе 110 и активная кислотная нова.',10730,
      {countAdd:2,splashAdd:25,rangeMul:1.2,intervalMul:0.8},toxinVisual(5),{
       addStatuses:[poison(16,6,5)],effects:[burst('coral-c-medusa-cascade',120,110,8,poison(8,4,3))],
       abilities:[nova('coral-c-medusa-nova','Цветение глубин',200,220,45,'acid')],
      }),
    ],
   },
  ],
 };
}
