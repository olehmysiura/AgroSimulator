// ============================================================================
// Діагностика: визначення активної кризи та релевантності приладів
// ============================================================================
import { CROPS, EPSH_WEEDS, PEST_EPSH, TOOLS } from './data';
import { layer, panBlocking } from './soil';
import type { CrisisId, SimState, ToolId } from './types';

export const liveCrop = (s: SimState) => (s.crop && !s.crop.dead && !s.crop.harvested ? s.crop : null);

export function detectCrisis(s: SimState): CrisisId | null {
  if (s.quest && !s.quest.solved && !s.quest.failed) return s.quest.id;
  const c = liveCrop(s);
  if (!c) return null;
  if (!c.emerged && s.crust > 0 && c.corkscrew) return 'crust';
  if (c.id === 'corn' && c.stressCause === 'приморозок' && c.stressUntil >= s.day) return 'frost';
  if (c.disease > 20) return 'septoria';
  if (c.wilting && panBlocking(s) && layer(s, 'transition').moisture > 60) return 'pan';
  if (c.wilting) return 'drought';
  if (CROPS[c.id].pest.kind === 'mite' && c.pests > PEST_EPSH.soy) return 'mites';
  if (c.pests > PEST_EPSH[c.id] * 1.5 && c.pests > 3) return 'pests';
  if (c.emerged && s.weeds > EPSH_WEEDS * 1.5) return 'weeds';
  if (c.emerged && c.nStatus < 0.6) return 'nitrogen';
  return null;
}

const RELEVANT: Record<CrisisId, ToolId[]> = {
  crust: ['shovel'],
  frost: ['shovel', 'thermometer'],
  pan: ['penetrometer', 'auger', 'infiltrometer'],
  septoria: ['lens', 'meteo'],
  pests: ['lens', 'traps'],
  beetle: ['lens', 'traps'],
  mites: ['lens'],
  weeds: ['frame'],
  nitrogen: ['lens', 'ndvi', 'auger', 'agrolab'],
  drought: ['auger'],
  wetsoil: ['auger', 'infiltrometer'],
  coldsoil: ['thermometer'],
  acid: ['agrolab', 'auger'],
  lodging: ['frame', 'lens'],
};

const SYMPTOM: Record<CrisisId, string> = {
  crust: 'відсутність сходів у рядках після зливи',
  frost: 'почорніле листя сходів після нічного приморозку',
  pan: 'денне в\'янення рослин',
  septoria: 'некротична плямистість листя',
  pests: 'погризи та колонії комах на рослинах',
  beetle: 'пошкоджені бутони суцвіть',
  mites: 'мармурове посвітління та павутиння на нижньому боці листя',
  weeds: 'забур\'яненість міжрядь',
  nitrogen: 'рівномірне посвітління листя',
  drought: 'втрата тургору у спеку',
  wetsoil: 'перезволожена поверхня поля перед початком робіт',
  coldsoil: 'рішення про строк сівби теплолюбної культури',
  acid: 'планування посіву бобової культури',
  lodging: 'загущений темно-зелений стеблостій',
};

const NOT_SEEN: Record<CrisisId, string> = {
  crust: 'стан і форму проростків під поверхнею ґрунту',
  frost: 'життєздатність тканин точки росту, розташованої під поверхнею ґрунту',
  pan: 'механічну перешкоду для коренів та розподіл вологи в профілі',
  septoria: 'пікніди, спороношення та некрози на листковій пластинці',
  pests: 'комах, їхні яйцекладки та колонії на органах рослини',
  beetle: 'жуків у бутонах та їхню чисельність на рослину',
  mites: 'кліщів, їхні яйця та павутиння на нижньому боці листка',
  weeds: 'видовий склад та чисельність бур\'янів на облікову площу',
  nitrogen: 'вміст хлорофілу та азоту в тканинах листка',
  drought: 'запаси доступної вологи в окремих горизонтах',
  wetsoil: 'вологість орного шару за глибинами',
  coldsoil: 'температуру ґрунту на глибині загортання насіння',
  acid: 'реакцію ґрунтового розчину (pH)',
  lodging: 'густоту стеблостою та забезпеченість рослин азотом',
};

export function toolRelevance(s: SimState, tool: ToolId): { crisis: CrisisId | null; relevant: boolean; warning?: string } {
  const crisis = detectCrisis(s);
  if (!crisis) return { crisis, relevant: true };
  if (RELEVANT[crisis].includes(tool)) return { crisis, relevant: true };
  return {
    crisis,
    relevant: false,
    warning: `Цей прилад вимірює ${TOOLS[tool].measures}. Поточна ситуація на полі — ${SYMPTOM[crisis]}: прилад не реєструє ${NOT_SEEN[crisis]}, тому отримані дані не дають відповіді на поточну проблему.`,
  };
}
