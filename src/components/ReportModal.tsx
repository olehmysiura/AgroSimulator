import { Printer, X } from 'lucide-react';
import { useState } from 'react';
import { CROPS, TOOLS, ZONES } from '../sim/data';
import { yieldForecast } from '../sim/engine';
import { QUESTS } from '../sim/quests';
import type { SimState } from '../sim/types';
import { clamp, fmt, formatDay } from '../sim/util';

function grade(score: number) {
  if (score >= 90) return ['A', 'відмінно'];
  if (score >= 82) return ['B', 'добре'];
  if (score >= 74) return ['C', 'добре'];
  if (score >= 64) return ['D', 'задовільно'];
  if (score >= 60) return ['E', 'задовільно'];
  return ['FX', 'незадовільно'];
}

export default function ReportModal({ state: s, onClose }: { state: SimState; onClose: () => void }) {
  const [student, setStudent] = useState('');
  const [group, setGroup] = useState('');
  const quests = [...s.questHistory, ...(s.quest ? [s.quest] : [])];
  const irrelevant = s.diagnostics.filter((d) => !d.relevant).length;
  const solved = quests.filter((q) => q.solved);
  const noDiag = solved.filter((q) => !q.diagnosed).length;
  const failed = quests.filter((q) => q.failed).length;
  const score = Math.round(clamp(100 - s.mistakes.length * 8 - irrelevant * 3 - noDiag * 5 - failed * 10, 0, 100));
  const [ects, nat] = grade(score);
  const y = yieldForecast(s);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-3 print:static print:bg-white" onClick={onClose}>
      <div className="thin-scroll max-h-[94vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-5 text-xs text-slate-200 shadow-2xl print:max-h-none print:border-0 print:bg-white print:text-black" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-slate-50 print:text-black">Атестаційний звіт · AgroSim UA</h3>
            <p className="text-slate-400">Віртуальна лабораторія агронома · {ZONES[s.zone].name}, {ZONES[s.zone].region} · станом на {formatDay(s.day, true)}</p>
          </div>
          <div className="flex gap-1 print:hidden">
            <button type="button" onClick={() => window.print()} className="flex items-center gap-1 rounded-lg bg-slate-800 px-2.5 py-1.5 hover:bg-slate-700"><Printer className="h-3.5 w-3.5" />Друк</button>
            <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800" aria-label="Закрити"><X className="h-4 w-4" /></button>
          </div>
        </div>

        <div className="mb-4 grid gap-2 sm:grid-cols-2">
          <label className="flex flex-col gap-1"><span className="text-slate-400">ПІБ здобувача</span><input value={student} onChange={(e) => setStudent(e.target.value)} className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-slate-100" /></label>
          <label className="flex flex-col gap-1"><span className="text-slate-400">Група</span><input value={group} onChange={(e) => setGroup(e.target.value)} className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-slate-100" /></label>
        </div>

        <div className="mb-4 grid gap-2 sm:grid-cols-4">
          <Card label="Інтегральний бал" value={`${score} / 100`} />
          <Card label="ECTS / національна" value={`${ects} · ${nat}`} />
          <Card label="Агрономічні помилки" value={String(s.mistakes.length)} bad={s.mistakes.length > 0} />
          <Card label="Виклики розв'язано" value={`${solved.length} / ${quests.length}`} />
        </div>

        <Section title="Ситуаційні виклики">
          {quests.length === 0 && <p className="text-slate-500">Виклики не виконувались.</p>}
          {quests.map((q, i) => (
            <div key={i} className="border-b border-slate-800 py-1.5">
              <div className="flex justify-between gap-2">
                <span className="font-semibold">{QUESTS[q.id].title}</span>
                <span className={q.solved ? 'text-emerald-400' : q.failed ? 'text-red-400' : 'text-amber-300'}>{q.solved ? 'розв\'язано' : q.failed ? 'провалено' : 'не завершено'}</span>
              </div>
              <div className="text-slate-400">Інструментальна діагностика: {q.diagnosed ? 'виконана' : 'не виконана'}{q.notes.length ? ` · ${q.notes.join('; ')}` : ''}</div>
            </div>
          ))}
        </Section>

        <Section title="Розбір помилок">
          {s.mistakes.length === 0 && <p className="text-emerald-400">Помилок не зафіксовано.</p>}
          {s.mistakes.map((m) => (
            <div key={m.id} className="mb-2 rounded-lg border border-red-900/70 bg-red-950/30 p-2 print:border-red-300 print:bg-white">
              <div className="font-semibold text-red-300 print:text-red-700">{formatDay(m.day, true)} · {m.action}</div>
              <div className="mt-0.5 text-slate-300 print:text-black"><b>Причина:</b> {m.cause}</div>
              <div className="text-slate-300 print:text-black"><b>Наслідки:</b> {m.consequence}</div>
            </div>
          ))}
        </Section>

        <div className="grid gap-4 md:grid-cols-2">
          <Section title="Прогноз біологічної врожайності">
            {s.crop ? (
              <>
                <div className="mb-1 font-semibold">{CROPS[s.crop.id].name}: {fmt(y.tha, 2)} т/га ({y.pct}% від потенціалу {fmt(y.potential)} т/га)</div>
                <div className="mb-1 text-slate-400">Досяжно без подальших стресів: {fmt(y.secured, 2)} т/га ({y.securedPct}%)</div>
                {y.losses.map((l) => (
                  <div key={l.id} className="flex justify-between border-b border-slate-800 py-0.5"><span className="text-slate-400">{l.name}</span><span className="font-mono text-amber-300">−{fmt(l.tha, 2)} т/га ({fmt(l.pct, 0)}%)</span></div>
                ))}
                {y.losses.length === 0 && <div className="text-emerald-400">Втрат урожаю не зафіксовано.</div>}
              </>
            ) : <p className="text-slate-500">Культура не висіяна.</p>}
            {s.harvests.map((h, i) => <div key={i} className="mt-1 text-emerald-300">Зібрано {formatDay(h.day, true)}: {CROPS[h.crop].name} — {fmt(h.yield, 2)} т/га ({h.pct}%)</div>)}
          </Section>
          <Section title={`Діагностика (${s.diagnostics.length}, нерелевантних ${irrelevant})`}>
            {s.diagnostics.slice(-14).map((d, i) => (
              <div key={i} className="flex justify-between border-b border-slate-800 py-0.5"><span>{formatDay(d.day, true)} · {TOOLS[d.tool].short}</span><span className={d.relevant ? 'text-emerald-400' : 'text-amber-300'}>{d.relevant ? 'доречно' : 'не за симптомом'}</span></div>
            ))}
          </Section>
        </div>

        <Section title={`Журнал операцій (${s.operations.length})`}>
          <div className="columns-1 gap-4 sm:columns-2">
            {s.operations.map((o, i) => <div key={i} className="break-inside-avoid py-0.5"><span className="text-slate-500">{formatDay(o.day, true)}</span> · {o.name}</div>)}
          </div>
        </Section>
        <p className="mt-4 text-[10px] text-slate-500">Формула: 100 − 8×помилка − 3×нерелевантний прилад у кризі − 5×рішення без діагностики − 10×провалений виклик.</p>
      </div>
    </div>
  );
}

function Card({ label, value, bad }: { label: string; value: string; bad?: boolean }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950 p-2.5 print:bg-white">
      <div className="text-[10px] uppercase text-slate-400">{label}</div>
      <div className={`font-mono text-base font-bold ${bad ? 'text-red-400' : 'text-emerald-300'} print:text-black`}>{value}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-4">
      <h4 className="mb-1.5 border-b border-slate-700 pb-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-300 print:text-black">{title}</h4>
      {children}
    </section>
  );
}
