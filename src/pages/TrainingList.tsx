import { FileText, ArrowRight, PlayCircle, CheckCircle, Target, RotateCcw, Clock3 } from 'lucide-react';
import { useApp } from '../AppContext';
import { ACORD_MODULES } from '../data/modules';
import { Topbar } from '../components/Topbar';
import { ProgressBar, Badge, SectionTitle } from '../components/ui';
import type { AcordId } from '../types';

export function TrainingList() {
  const { student, openModule } = useApp();
  return (
    <div>
      <Topbar title="ACORD Training" subtitle="Master the five core commercial insurance forms" />
      <div className="px-8 py-6 space-y-6 max-w-[1200px]">
        <div className="card p-5 flex items-center gap-4 animate-fade-in">
          <div className="w-12 h-12 rounded-lg bg-lava-600/10 border border-lava-600/20 flex items-center justify-center">
            <FileText className="w-6 h-6 text-lava-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-white">ACORD Certification Track</h3>
            <p className="text-sm text-muted-400 mt-0.5">
              Complete all five modules to earn your ACORD Form Competency certificate. Each module includes a training
              video, realistic agency email scenario, and a graded form completion assessment.
            </p>
          </div>
        </div>

        <SectionTitle title="All Modules" subtitle="Five ACORD forms · 3 attempts each" />

        <div className="space-y-3">
          {ACORD_MODULES.map((mod, idx) => {
            const p = student.progress[mod.id];
            const moduleProgress = p.videoCompleted ? (p.bestScore !== null ? 100 : 70) : Math.round(p.videoProgress * 0.7);
            return (
              <div
                key={mod.id}
                onClick={() => openModule(mod.id as AcordId)}
                className="card-hover p-5 cursor-pointer flex items-center gap-5 animate-fade-in group"
              >
                <div className="text-2xl font-bold text-muted-600 tabular-nums w-8 text-center">{idx + 1}</div>
                <div className="w-12 h-12 rounded-lg bg-bg-elevated border border-line-subtle flex items-center justify-center group-hover:border-lava-600/30 transition-colors shrink-0">
                  <FileText className="w-5 h-5 text-lava-400" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-sm font-semibold text-white">{mod.formNumber}</span>
                    <span className="text-sm text-muted-400">— {mod.title}</span>
                    {p.status === 'completed' && <Badge variant="success"><CheckCircle className="w-3 h-3" /> Complete</Badge>}
                    {p.status === 'in-progress' && <Badge variant="warning">In Progress</Badge>}
                  </div>
                  <p className="text-sm text-muted-500 leading-relaxed line-clamp-1">{mod.description}</p>
                  <div className="mt-3 flex items-center gap-6">
                    <div className="flex-1 max-w-xs">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-muted-500">Progress</span>
                        <span className="text-slate-300">{moduleProgress}%</span>
                      </div>
                      <ProgressBar value={moduleProgress} color={p.status === 'completed' ? 'emerald' : 'lava'} size="sm" />
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-400">
                      <span className="flex items-center gap-1.5">
                        {p.videoCompleted ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> : <PlayCircle className="w-3.5 h-3.5 text-muted-500" />}
                        {mod.videoDuration}
                      </span>
                      <span className="flex items-center gap-1.5"><Target className="w-3.5 h-3.5" />{p.bestScore !== null ? `${p.bestScore}%` : '—'}</span>
                      <span className="flex items-center gap-1.5"><RotateCcw className="w-3.5 h-3.5" />{p.attemptsRemaining} left</span>
                    </div>
                  </div>
                </div>

                <ArrowRight className="w-5 h-5 text-muted-600 group-hover:text-lava-400 group-hover:translate-x-0.5 transition-all shrink-0" />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
