// ============================================================================
// Діагностика: визначення активної кризи та релевантності приладів
// ============================================================================
import { EPSH_WEEDS, TOOLS } from './data';
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
  if (c.pests > 10) return 'pests';
  if (c.emerged && s.weeds > EPSH_WEEDS * 1.5) return 'weeds';
  if (c.emerged && c.nStatus < 0.6) return 'nitrogen';
  return null;
}

const RELEVANT: Record<CrisisId, ToolId[]> = {
  crust: ['shovel'],
  frost: ['shovel'],
  pan: ['penetrometer', 'auger'],
  septoria: ['lens'],
  pests: ['lens'],
  weeds: ['frame'],
  nitrogen: ['lens', 'ndvi', 'auger'],
  drought: ['auger'],
};

const SYMPTOM: Record<CrisisId, string> = {
  crust: 'відсутність сходів у рядках після зливи',
  frost: 'почорніле листя сходів після нічного приморозку',
  pan: 'денне в\'янення рослин',
  septoria: 'некротична плямистість листя',
  pests: 'погризи та колонії комах на рослинах',
  weeds: 'забур\'яненість міжрядь',
  nitrogen: 'рівномірне посвітління листя',
  drought: 'втрата тургору у спеку',
};

const NOT_SEEN: Record<CrisisId, string> = {
  crust: 'стан і форму проростків під поверхнею ґрунту',
  frost: 'життєздатність тканин точки росту, розташованої під поверхнею ґрунту',
  pan: 'механічну перешкоду для коренів та розподіл вологи в профілі',
  septoria: 'пікніди, спороношення та некрози на листковій пластинці',
  pests: 'комах, їхні яйцекладки та колонії на органах рослини',
  weeds: 'видовий склад та чисельність бур\'янів на облікову площу',
  nitrogen: 'вміст хлорофілу та азоту в тканинах листка',
  drought: 'запаси доступної вологи в окремих горизонтах',
};

export function toolRelevance(s: SimState, tool: ToolId): { crisis: CrisisId | null; relevant: boolean; warning?: string } {
  const crisis = detectCrisis(s);
  if (!crisis) return { crisis, relevant: true };
  if (RELEVANT[crisis].includes(tool)) return { crisis, relevant: true };
  return {
    crisis,
    relevant: false,
    warning: `Цей прилад вимірює ${TOOLS[tool].measures}. Поточний симптом поля — ${SYMPTOM[crisis]}: прилад не реєструє ${NOT_SEEN[crisis]}, тому отримані дані не пояснюють причину проблеми.`,
  };
}
