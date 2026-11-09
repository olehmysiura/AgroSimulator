import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { createInitialState, lastDay } from './sim/engine';
import { reducer, type Action } from './sim/reducer';
import type { SimState, ToolId, ZoneId } from './sim/types';
import { dayOf } from './sim/util';
import TopBar from './components/TopBar';
import LabPanel from './components/LabPanel';
import OpsPanel from './components/OpsPanel';
import FieldView from './components/FieldView';
import LogDock from './components/LogDock';
import ErrorPanel from './components/ErrorPanel';
import InstrumentModal from './components/InstrumentModal';
import ReportModal from './components/ReportModal';
import ResetModal from './components/ResetModal';
import ExplorePlant from './components/explore/ExplorePlant';
import ExploreSoil from './components/explore/ExploreSoil';
import FactorsView from './components/explore/FactorsView';
import { BarChart3, Layers, Mountain, Sprout } from 'lucide-react';

export default function App() {
  const [state, dispatch] = useReducer(reducer, undefined, () => createInitialState('lisostep', dayOf(3, 1)));
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [projector, setProjector] = useState(false);
  const [tool, setTool] = useState<ToolId | null>(null);
  const [toolSnapshot, setToolSnapshot] = useState<SimState | null>(null);
  const [report, setReport] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [center, setCenter] = useState<'field' | 'plant' | 'soil' | 'yield'>('field');
  const history = useRef(new Map<number, SimState>());

  // «Машина часу»: знімки стану по днях
  useEffect(() => {
    const h = history.current;
    for (const k of [...h.keys()]) if (k > state.day || k < state.startDay) h.delete(k);
    h.set(state.day, state);
  }, [state]);

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => dispatch({ type: 'tick', days: 1 }), Math.round(700 / speed));
    return () => clearInterval(id);
  }, [playing, speed]);

  useEffect(() => {
    if (state.day >= lastDay(state)) setPlaying(false);
  }, [state]);

  const act = useCallback((a: Action) => dispatch(a), []);

  const seek = useCallback(
    (target: number) => {
      if (target === state.day) return;
      if (target > state.day) {
        dispatch({ type: 'tick', days: target - state.day });
        return;
      }
      const keys = [...history.current.keys()].filter((k) => k <= target).sort((a, b) => b - a);
      const base = keys.length ? history.current.get(keys[0])! : null;
      if (!base) return;
      dispatch({ type: 'restore', state: base });
      if (target > base.day) dispatch({ type: 'tick', days: target - base.day });
    },
    [state.day],
  );

  const openTool = (t: ToolId) => {
    setPlaying(false);
    setToolSnapshot(state);
    setTool(t);
    dispatch({ type: 'tool', tool: t });
  };

  const fullReset = (zone: ZoneId, startDay: number) => {
    setPlaying(false);
    setTool(null);
    setReport(false);
    setResetOpen(false);
    history.current.clear();
    dispatch({ type: 'fullReset', zone, startDay });
    setResetKey((k) => k + 1); // скидання локального стану панелей (вкладки, фільтри, форми)
  };

  return (
    /* режим проектора: збільшений масштаб усього інтерфейсу (zoom 125%) */
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-200 xl:h-screen xl:overflow-hidden" style={projector ? { zoom: 1.25, height: 'calc(100vh / 1.25)', minHeight: 'calc(100vh / 1.25)' } : undefined}>
      <TopBar
        state={state}
        act={act}
        playing={playing}
        setPlaying={setPlaying}
        speed={speed}
        setSpeed={setSpeed}
        projector={projector}
        setProjector={setProjector}
        seek={seek}
        onReport={() => { setPlaying(false); setReport(true); }}
        onReset={() => { setPlaying(false); setResetOpen(true); }}
      />
      <div key={resetKey} className="flex min-h-0 flex-1 flex-col gap-2 p-2 xl:flex-row">
        <LabPanel state={state} act={act} openTool={openTool} />
        <main className="relative flex min-h-[460px] min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
          <div className="flex shrink-0 gap-1 border-b border-slate-800 bg-slate-950/60 p-1">
            {([['field', 'Поле: розріз', <Layers key="i" className="h-3.5 w-3.5" />], ['plant', 'Дослідження рослини', <Sprout key="i" className="h-3.5 w-3.5" />], ['soil', 'Дослідження ґрунту', <Mountain key="i" className="h-3.5 w-3.5" />], ['yield', 'Урожай і фактори', <BarChart3 key="i" className="h-3.5 w-3.5" />]] as const).map(([id, name, icon]) => (
              <button key={id} type="button" onClick={() => setCenter(id)} className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-semibold transition ${center === id ? 'bg-emerald-600/30 text-emerald-100 ring-1 ring-emerald-500/60' : 'text-slate-300 hover:bg-slate-800'}`}>
                {icon}
                {name}
              </button>
            ))}
          </div>
          {center === 'field' && <FieldView state={state} />}
          {center === 'plant' && <ExplorePlant state={state} />}
          {center === 'soil' && <ExploreSoil state={state} />}
          {center === 'yield' && <FactorsView state={state} />}
          <ErrorPanel errors={state.activeErrors} onClose={() => act({ type: 'dismissErrors' })} />
        </main>
        <OpsPanel state={state} act={act} />
      </div>
      <LogDock key={`log${resetKey}`} log={state.log} compact={projector} />
      {tool && toolSnapshot && <InstrumentModal tool={tool} state={toolSnapshot} onClose={() => setTool(null)} />}
      {report && <ReportModal state={state} onClose={() => setReport(false)} />}
      {resetOpen && <ResetModal zone={state.zone} onClose={() => setResetOpen(false)} onConfirm={fullReset} />}
    </div>
  );
}
