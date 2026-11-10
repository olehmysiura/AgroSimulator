// ============================================================================
// Редьюсер: кожна дія студента → клон стану → перерахунок фізики
// ============================================================================
import { createInitialState, addLog, tick } from './engine';
import { clearCrop, setSprayMode, sow, spray, till, useTool } from './operations';
import { loadQuest } from './quests';
import type { ClimateMode, CropId, QuestId, SimState, SprayMode, SprayOp, TillageOp, ToolId, ZoneId } from './types';

export type Action =
  | { type: 'tick'; days: number }
  | { type: 'restore'; state: SimState }
  | { type: 'zone'; zone: ZoneId }
  | { type: 'climate'; mode: ClimateMode }
  | { type: 'sow'; crop: CropId; depth: number; seedTreatment: boolean; inoculated: boolean }
  | { type: 'clear' }
  | { type: 'till'; op: TillageOp }
  | { type: 'spray'; op: SprayOp; dose?: number }
  | { type: 'sprayMode'; mode: SprayMode }
  | { type: 'tool'; tool: ToolId }
  | { type: 'quest'; id: QuestId }
  | { type: 'dismissErrors' }
  | { type: 'fullReset'; zone: ZoneId; startDay: number };

export const CLIMATE_NAMES: Record<ClimateMode, string> = {
  normal: 'Норма', storm: 'Злива 40 мм', drought: 'Посуха', heat: 'Спека +33 °C', rainy: 'Затяжні дощі', frost: 'Приморозок −2 °C', wind: 'Вітер 9,5 м/с',
};

/** Перенесення журналу, помилок і статистики з попереднього стану у новий (нове поле, той самий урок). */
function carry(prev: SimState, n: SimState): SimState {
  let seq = prev.seq + 1;
  n.log = [...prev.log, ...n.log.map((l) => ({ ...l, id: seq++ }))];
  n.mistakes = [...prev.mistakes];
  n.diagnostics = [...prev.diagnostics];
  n.operations = [...prev.operations];
  n.harvests = [...prev.harvests];
  n.treatments = [...prev.treatments];
  n.questHistory = prev.quest ? [...prev.questHistory, prev.quest] : [...prev.questHistory];
  n.seq = seq;
  return n;
}

export function reducer(state: SimState, action: Action): SimState {
  if (action.type === 'restore') return action.state;
  if (action.type === 'fullReset') return createInitialState(action.zone, action.startDay);
  if (action.type === 'quest') return carry(state, loadQuest(action.id));
  if (action.type === 'zone') return carry(state, createInitialState(action.zone, state.day));

  const s: SimState = structuredClone(state);
  s.activeErrors = action.type === 'dismissErrors' ? [] : s.activeErrors;
  switch (action.type) {
    case 'tick':
      for (let i = 0; i < action.days; i++) tick(s);
      break;
    case 'climate':
      s.climate = action.mode;
      s.climateUntil = 99999;
      addLog(s, 'weather', `Кліматичний режим: ${CLIMATE_NAMES[action.mode]}`);
      if (action.mode !== 'normal') {
        // режим застосовується до поточного дня одразу
        s.day -= 1;
        tick(s);
      }
      break;
    case 'sow':
      s.activeErrors = [];
      sow(s, action.crop, action.depth, action.seedTreatment, action.inoculated);
      break;
    case 'clear':
      s.activeErrors = [];
      clearCrop(s);
      break;
    case 'till':
      s.activeErrors = [];
      till(s, action.op);
      break;
    case 'spray':
      s.activeErrors = [];
      spray(s, action.op, action.dose);
      break;
    case 'sprayMode':
      setSprayMode(s, action.mode);
      break;
    case 'tool':
      useTool(s, action.tool);
      break;
  }
  return s;
}
