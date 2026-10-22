import type {DifficultyDef, ModeDef} from '../contracts';

/** The map's geometry group never participates in these run presets. */
const DIFFICULTY_DATA:DifficultyDef[] = [
 {id:'easy',name:'Лёгкая',rounds:40,lives:200,startCredits:1000,towerCostMul:0.85,enemyHpMul:0.85,roundRewardBase:100,roundRewardStep:5,popCashMul:1,rewardMul:0.70},
 {id:'normal',name:'Обычная',rounds:60,lives:150,startCredits:900,towerCostMul:1,enemyHpMul:1,roundRewardBase:80,roundRewardStep:4,popCashMul:1,rewardMul:1},
 {id:'hard',name:'Сложная',rounds:80,lives:100,startCredits:850,towerCostMul:1.10,enemyHpMul:1.10,roundRewardBase:60,roundRewardStep:3,popCashMul:1,rewardMul:1.35},
 {id:'extreme',name:'Предельная',rounds:100,lives:1,startCredits:850,towerCostMul:1.20,enemyHpMul:1.20,roundRewardBase:50,roundRewardStep:2,popCashMul:1,rewardMul:1.70},
];
export const DIFFICULTIES:readonly Readonly<DifficultyDef>[] = Object.freeze(DIFFICULTY_DATA.map(def=>Object.freeze(def)));

/** Meta rewards multiply the chosen difficulty's rewardMul, not the map's group. */
export const MODE_REWARDS: Readonly<Record<string,number>> = Object.freeze({
 'standard':1,
 'half-cash':1.60,
 'no-leaks':1.70,
 'iron-oath':2.25,
 'short-supply':1.45,
 'blackout':1.40,
 'stormfront':1.45,
 'overdrive':1.50,
 'low-tech':1.50,
 'no-actives':1.35,
});

const MODE_DATA:ModeDef[] = [
 {
  id:'standard',name:'Оборона маяка',requiresClear:false,
  description:'Обычный сюжетный забег. Жизни, 40/60/80/100 волн, цены и награды определяет выбранная сложность; фермы, знания, продажа и активные способности доступны.',
  modifiers:{},
 },
 {
  id:'half-cash',name:'Половина снабжения',requiresClear:true,
  description:'Стартовый кошелёк и ВСЕ боевые поступления ×0,5: оплата слоёв, награды за раунды, фермы, проценты, harvest и денежные способности. Дробные кредиты накапливаются, не теряются.',
  modifiers:{incomeMul:0.5,startingCashMul:0.5},
 },
 {
  id:'no-leaks',name:'Как бы не погаснуть',requiresClear:true,
  description:'Одна жизнь на весь забег; восстановление и знания не могут поднять лимит выше 1. Фермы, harvest, пассивный доход, боевые способности, знания и продажа разрешены.',
  modifiers:{maxLives:1},
 },
 {
  id:'iron-oath',name:'Клятва маяка',requiresClear:true,
  description:'Одна жизнь, без продажи и знаний. Только деньги за снятые слои и завершённые волны: запрещены фермы, проценты, harvest, денежные способности и прочий дополнительный доход. Боевые активные способности работают; продолжения после поражения нет.',
  modifiers:{maxLives:1,sellAllowed:false,allowPassiveIncome:false,allowKnowledge:false},
 },
 {
  id:'short-supply',name:'Двенадцать опор',requiresClear:true,
  description:'Не более 12 построек одновременно на всю команду, включая кооператив; знания и число участников не повышают предел.',
  modifiers:{maxTowers:12},
 },
 {
  id:'blackout',name:'Слепая ночь',requiresClear:true,
  description:'Постоянный читаемый туман затрудняет обнаружение врагов. Маршруты, размещение и управление остаются видимыми; обнаруживающие башни особенно полезны.',
  modifiers:{weather:'fog'},
 },
 {
  id:'stormfront',name:'Смена фронтов',requiresClear:true,
  description:'Каждые 5 волн меняется сухая/влажная погода. Первая фаза задаётся seed; текущая и следующая фазы предсказуемы заранее и не зависят от часов.',
  modifiers:{weather:'alternating'},
 },
 {
  id:'overdrive',name:'Форсаж',requiresClear:true,
  description:'Все враги движутся ×1,35 быстрее; весь боевой доход ×1,10. HP, число волн и базовые цены остаются от выбранной сложности.',
  modifiers:{enemySpeedMul:1.35,incomeMul:1.10},
 },
 {
  id:'low-tech',name:'Полевой ремонт',requiresClear:true,
  description:'Максимум третья ступень улучшений на каждой башне. T4/T5 и их активные способности недоступны; нижние ступени и обычные способности разрешены.',
  modifiers:{maxTier:3},
 },
 {
  id:'no-actives',name:'Тихий приказ',requiresClear:true,
  description:'Нельзя активировать способности башен вручную, включая денежные. Пассивные эффекты, фермы, harvest, обычные атаки и знания продолжают работать.',
  modifiers:{allowAbilities:false},
 },
];
export const MODES:readonly Readonly<ModeDef>[] = Object.freeze(MODE_DATA.map(mode=>Object.freeze({...mode,modifiers:Object.freeze({...mode.modifiers})})));
