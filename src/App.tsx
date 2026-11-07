import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { createInitialState } from './sim/engine';
import { reducer, type Action } from './sim/reducer';
import type { SimState, ToolId } from './sim/types';
import TopBar from './components/TopBar';
import LabPanel from './components/LabPanel';
import OpsPanel from './components/OpsPanel';
import FieldView from './components/FieldView';
import LogDock from './components/LogDock';
import ErrorPanel from './components/ErrorPanel';
import InstrumentModal from './components/InstrumentModal';
import ReportModal from './components/ReportModal';

export default function App() {
  const [state, dispatch] = useReducer(reducer, undefined, () => createInitialState('lisostep', 95));
  const [playing, setPlaying] = useState(false);
  const [tool, setTool] = useState<ToolId | null>(null);
  const [toolSnapshot, setToolSnapshot] = useState<SimState | null>(null);
  const [report, setReport] = useState(false);
  const history = useRef(new Map<number, SimState>());

  // «Машина часу»: знімки стану по днях
  useEffect(() => {
    const h = history.current;
    for (const k of [...h.keys()]) if (k > state.day) h.delete(k);
    h.set(state.day, state);
  }, [state]);

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => dispatch({ type: 'tick', days: 1 }), 650);
    return () => clearInterval(id);
  }, [playing]);

  useEffect(() => {
    if (state.day >= 365) setPlaying(false);
  }, [state.day]);

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

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-200 xl:h-screen xl:overflow-hidden">
      <TopBar state={state} act={act} playing={playing} setPlaying={setPlaying} seek={seek} onReport={() => { setPlaying(false); setReport(true); }} />
      <div className="flex min-h-0 flex-1 flex-col gap-2 p-2 xl:flex-row">
        <LabPanel state={state} act={act} openTool={openTool} />
        <main className="relative flex min-h-[420px] min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
          <FieldView state={state} />
          <ErrorPanel errors={state.activeErrors} onClose={() => act({ type: 'dismissErrors' })} />
        </main>
        <OpsPanel state={state} act={act} />
      </div>
      <LogDock log={state.log} />
      {tool && toolSnapshot && <InstrumentModal tool={tool} state={toolSnapshot} onClose={() => setTool(null)} />}
      {report && <ReportModal state={state} onClose={() => setReport(false)} />}
    </div>
  );
}
