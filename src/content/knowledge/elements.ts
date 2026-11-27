import type { KnowledgeEffect, KnowledgeNode, KnowledgeStat } from '../../contracts';

type Stat = Extract<KnowledgeStat, 'elementDamage' | 'statusDuration' | 'shieldDamage' | 'controlDuration'>;
const core = ['ember', 'frost', 'tesla', 'venom', 'prism', 'storm'];
const d = (percent: number, ...towers: string[]) => effect('elementDamage', percent, towers);
const s = (percent: number, ...towers: string[]) => effect('statusDuration', percent, towers);
const h = (percent: number, ...towers: string[]) => effect('shieldDamage', percent, towers);
const c = (percent: number, ...towers: string[]) => effect('controlDuration', percent, towers);
function effect(stat: Stat, percent: number, towers: string[]): KnowledgeEffect {
  return { stat, value: percent / 100, towers };
}
const id = (n: number) => `elements-${String(n).padStart(2, '0')}`;

export function getKnowledge(): KnowledgeNode[] {
  const rows: [string, string, KnowledgeEffect[]][] = [
    ['Жар углей', 'Жаровая печь: урон +2%.', [d(2, 'ember')]],
    ['Чистый лёд', 'Криокристалл: урон +2%.', [d(2, 'frost')]],
    ['Медная дуга', 'Катушка Теслы: урон +2%.', [d(2, 'tesla')]],
    ['Крепкий раствор', 'Алхимическая колба: урон +2%.', [d(2, 'venom')]],
    ['Тетрада', 'Шесть стихийных башен: урон и длительность мягких статусов +1%.', [d(1, ...core), s(1, ...core)]],
    ['Долгое тление', 'Печь и ракетная батарея: мягкие статусы +2% длительности.', [s(2, 'ember', 'rocket')]],
    ['Сухой холод', 'Криокристалл: заморозка и оглушение +1% длительности.', [c(1, 'frost')]],
    ['Ионная кромка', 'Катушка Теслы: урон щитам +3%.', [h(3, 'tesla')]],
    ['Злая кислота', 'Алхимическая колба: урон щитам +2%.', [h(2, 'venom')]],
    ['Мастер реакций', 'Шесть стихийных башен: мягкие статусы и урон щитам +1%.', [s(1, ...core), h(1, ...core)]],
    ['Тёплый спектр', 'Печь и призменный маяк: урон +1%.', [d(1, 'ember', 'prism')]],
    ['Снежное зерно', 'Криокристалл и приливный насос: мягкие статусы +2% длительности.', [s(2, 'frost', 'tide')]],
    ['Солёная искра', 'Катушка и штормовой шпиль: урон щитам +2%.', [h(2, 'tesla', 'storm')]],
    ['Едкая пелена', 'Колба и коралловый страж: мягкие статусы +1% длительности.', [s(1, 'venom', 'coral')]],
    ['Катализатор', 'Шесть стихийных башен: урон и длительность мягких статусов +1%.', [d(1, ...core), s(1, ...core)]],
    ['Горячая линза', 'Печь и призменный маяк: урон щитам +2%.', [h(2, 'ember', 'prism')]],
    ['Морозный след', 'Криокристалл и приливный насос: жёсткий контроль +1% длительности.', [c(1, 'frost', 'tide')]],
    ['Высокий потенциал', 'Катушка и штормовой шпиль: урон щитам +2%.', [h(2, 'tesla', 'storm')]],
    ['Густой яд', 'Колба и коралловый страж: мягкие статусы +2% длительности.', [s(2, 'venom', 'coral')]],
    ['Согласие стихий', 'Шесть стихийных башен: урон и урон щитам +1%.', [d(1, ...core), h(1, ...core)]],
    ['Свет сквозь щит', 'Призменный маяк: урон щитам +3%.', [h(3, 'prism')]],
    ['Медленный фронт', 'Криокристалл, насос и шпиль: мягкие статусы +2% длительности.', [s(2, 'frost', 'tide', 'storm')]],
    ['Угли в броне', 'Печь и ракетная батарея: мягкие статусы +1% длительности.', [s(1, 'ember', 'rocket')]],
    ['Ледяной осколок', 'Криокристалл: урон +1%.', [d(1, 'frost')]],
    ['Фазовый переход', 'Криокристалл, катушка и насос: жёсткий контроль +1%; шесть стихийных башен: урон щитам +1%.', [c(1, 'frost', 'tesla', 'tide'), h(1, ...core)]],
    ['Живая плазма', 'Катушка, маяк и шпиль: урон +1%.', [d(1, 'tesla', 'prism', 'storm')]],
    ['Кристаллизация', 'Криокристалл и насос: жёсткий контроль +1% длительности.', [c(1, 'frost', 'tide')]],
    ['Проводящий дождь', 'Катушка и шпиль: жёсткий контроль +1% длительности.', [c(1, 'tesla', 'storm')]],
    ['Полный распад', 'Колба и коралловый страж: мягкие статусы +1% длительности.', [s(1, 'venom', 'coral')]],
    ['Белое солнце', 'Шесть стихийных башен: урон +1%, урон щитам +2%, мягкие статусы +1% длительности.', [d(1, ...core), h(2, ...core), s(1, ...core)]],
  ];
  return rows.map(([name, description, effects], i) => {
    const index = i + 1;
    return { id: id(index), branch: 'elements', index, name, description,
      requires: i ? [id(i)] : [], minLevel: 1 + 4 * Math.floor(i / 5),
      pointCost: 1, sealCost: 5 * Math.ceil((20 + 5 * index + index * index / 3) / 5),
      effects, icon: `art/knowledge/elements/${id(index)}.svg` };
  });
}
