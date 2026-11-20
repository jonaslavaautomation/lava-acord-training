import { FileText, ArrowRight, PlayCircle, CheckCircle2, ClipboardCheck, FileCheck2 } from 'lucide-react';
import { useApp } from '../AppContext';
import { ACORD_MODULES } from '../data/modules';
import { Topbar } from '../components/Topbar';
import { ProgressBar, SectionTitle, StepTracker } from '../components/ui';
import { ModuleStatusBadge } from '../components/ModuleStatusBadge';
import { modulePassed, moduleProgressPct } from '../lib/assessmentService';
import { courseSteps, nextStep } from '../lib/nextStep';
import type { AcordId } from '../types';

const HOW_IT_WORKS = [
  { icon: PlayCircle, title: 'Watch the video', text: 'Watch the training video to the end.' },
  { icon: ClipboardCheck, title: 'Pass the Knowledge Check', text: '15 questions from the video. 80% to pass.' },
  { icon: FileCheck2, title: 'Fill out the real form', text: 'Complete the ACORD PDF from an agency email. 80% to pass, 3 attempts.' },
];

export function TrainingList() {
  const { student, openModule } = useApp();
  const count = ACORD_MODULES.length;
  const passed = ACORD_MODULES.filter((m) => modulePassed(student.progress[m.id])).length;
  return (
    <div>
      <Topbar title="ACORD Training" subtitle={`${count} commercial insurance forms`} />
      <div className="px-4 sm:px-6 lg:px-8 py-6 space-y-6 max-w-[1200px]">
        {/* How each course works */}
        <div className="card p-5 animate-fade-in">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
            <h3 className="text-sm font-semibold text-white">How each course works</h3>
            <span className="text-xs text-muted-400">{passed} of {count} passed · pass all {count} to complete the track</span>
          </div>
          <ol className="grid sm:grid-cols-3 gap-3">
            {HOW_IT_WORKS.map((s, i) => (
              <li key={s.title} className="flex gap-3 p-3 rounded-lg bg-bg-base border border-line-subtle">
                <div className="w-9 h-9 rounded-lg bg-lava-600/10 border border-lava-600/20 flex items-center justify-center shrink-0">
                  <s.icon className="w-4 h-4 text-lava-400" />
                </div>
                <div>
                  <div className="text-sm font-medium text-white">{i + 1}. {s.title}</div>
                  <div className="text-xs text-muted-400 mt-0.5 leading-relaxed">{s.text}</div>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <SectionTitle title="All courses" subtitle={`${count} ACORD forms · take them in any order`} />

        <div className="space-y-3">
          {ACORD_MODULES.map((mod, idx) => {
            const p = student.progress[mod.id];
            const pct = moduleProgressPct(p);
            const step = nextStep(p);
            const done = step.tone === 'done';
            return (
              <button
                key={mod.id}
                onClick={() => openModule(mod.id as AcordId)}
                className={`card-hover w-full text-left p-4 sm:p-5 flex items-start sm:items-center gap-4 sm:gap-5 animate-fade-in group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lava-500/60 ${done ? 'border-emerald-500/20' : ''}`}
              >
                <div className={`hidden sm:flex w-12 h-12 rounded-lg border items-center justify-center shrink-0 transition-colors ${done ? 'bg-emerald-500/10 border-emerald-500/25' : 'bg-bg-elevated border-line-subtle group-hover:border-lava-600/30'}`}>
                  {done ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : <FileText className="w-5 h-5 text-lava-400" />}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-x-3 gap-y-1 flex-wrap mb-1">
                    <span className="text-xs text-muted-600 tabular-nums">{idx + 1}.</span>
                    <span className="text-sm font-semibold text-white">{mod.formNumber}</span>
                    <span className="text-sm text-muted-400">{mod.title}</span>
                    <ModuleStatusBadge progress={p} showNotStarted={false} />
                  </div>
                  <p className="text-xs sm:text-sm text-muted-500 leading-relaxed">
                    <span className="text-slate-300">{step.title}.</span> {step.detail}
                  </p>
                  <div className="mt-3 grid sm:grid-cols-[minmax(0,280px)_1fr] gap-3 sm:gap-6 items-center">
                    <StepTracker steps={courseSteps(p)} compact />
                    <div className="flex items-center gap-3">
                      <ProgressBar value={pct} color={done ? 'emerald' : 'lava'} size="sm" className="flex-1 max-w-xs" />
                      <span className="text-xs text-slate-300 tabular-nums w-9">{pct}%</span>
                      <span className="hidden md:flex items-center gap-1.5 text-xs text-muted-500"><PlayCircle className="w-3.5 h-3.5" />{mod.videoDuration}</span>
                    </div>
                  </div>
                </div>

                <ArrowRight className="w-5 h-5 text-muted-600 group-hover:text-lava-400 group-hover:translate-x-0.5 transition-all shrink-0 self-center" />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
