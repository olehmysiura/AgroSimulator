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
  | { type: 'spray'; op: SprayOp }
  | { type: 'sprayMode'; mode: SprayMode }
  | { type: 'tool'; tool: ToolId }
  | { type: 'quest'; id: QuestId }
  | { type: 'dismissErrors' }
  | { type: 'reset' };

const CLIMATE_NAMES: Record<ClimateMode, string> = {
  normal: 'Норма', storm: 'Злива', drought: 'Посуха', frost: 'Приморозок −2 °C', wind: 'Вітер 9,5 м/с',
};

export function reducer(state: SimState, action: Action): SimState {
  if (action.type === 'restore') return action.state;
  if (action.type === 'quest') {
    const q = loadQuest(action.id);
    if (state.quest) q.questHistory = [...state.questHistory, state.quest];
    else q.questHistory = state.questHistory;
    let seq = state.seq + 1;
    q.log = [...state.log, ...q.log.map((l) => ({ ...l, id: seq++ }))];
    q.mistakes = [...state.mistakes];
    q.diagnostics = [...state.diagnostics];
    q.operations = [...state.operations];
    q.harvests = [...state.harvests];
    q.seq = seq;
    return q;
  }
  if (action.type === 'zone' || action.type === 'reset') {
    const n = action.type === 'zone' ? createInitialState(action.zone, state.day) : createInitialState(state.zone, 95);
    let seq = state.seq + 1;
    n.log = [...state.log, ...n.log.map((l) => ({ ...l, id: seq++ }))];
    n.mistakes = state.mistakes;
    n.diagnostics = state.diagnostics;
    n.operations = state.operations;
    n.questHistory = state.quest ? [...state.questHistory, state.quest] : state.questHistory;
    n.seq = seq;
    n.harvests = state.harvests;
    return n;
  }
  const s: SimState = structuredClone(state);
  s.activeErrors = action.type === 'dismissErrors' ? [] : s.activeErrors;
  switch (action.type) {
    case 'tick':
      for (let i = 0; i < action.days; i++) tick(s);
      break;
    case 'climate':
      s.climate = action.mode;
      s.climateUntil = 9999;
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
      spray(s, action.op);
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
