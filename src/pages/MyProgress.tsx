import { TrendingUp, CheckCircle2, Clock3, Target, BookOpen, Award, BarChart3 } from 'lucide-react';
import { useApp } from '../AppContext';
import { ACORD_MODULES, MODULE_MAP } from '../data/modules';
import { Topbar } from '../components/Topbar';
import { Badge, ProgressBar, ScoreRing, StatCard, SectionTitle } from '../components/ui';
import type { AcordId } from '../types';

export function MyProgress() {
  const { student, openModule } = useApp();
  const progress = student.progress;

  const completed = Object.values(progress).filter((p) => p.status === 'completed').length;
  const inProgress = Object.values(progress).filter((p) => p.status === 'in-progress').length;
  const notStarted = Object.values(progress).filter((p) => p.status === 'not-started').length;
  const scores = Object.values(progress).filter((p) => p.bestScore !== null).map((p) => p.bestScore!);
  const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  const videosComplete = Object.values(progress).filter((p) => p.videoCompleted).length;

  const overallProgress = Math.round(
    (Object.values(progress).reduce((acc, p) => {
      let s = 0;
      if (p.videoCompleted) s += 30;
      if (p.status === 'completed') s += 40;
      if (p.bestScore !== null) s += (p.bestScore / 100) * 30;
      return acc + s;
    }, 0) / (ACORD_MODULES.length * 100)) * 100,
  );

  const moduleScores = ACORD_MODULES.map((mod) => ({
    id: mod.id,
    label: mod.formNumber,
    score: progress[mod.id].bestScore ?? 0,
    hasScore: progress[mod.id].bestScore !== null,
  }));

  const maxScore = 100;

  return (
    <div>
      <Topbar title="My Progress" subtitle="Track your competency across all ACORD forms" />
      <div className="px-8 py-6 space-y-6 max-w-[1200px]">
        {/* Overall progress hero */}
        <div className="card p-6 relative overflow-hidden animate-fade-in">
          <div className="absolute top-0 right-0 w-64 h-64 bg-lava-600/5 rounded-full blur-3xl" />
          <div className="relative flex items-center gap-8 flex-wrap">
            <ScoreRing score={overallProgress} size={96} strokeWidth={7} />
            <div className="flex-1 min-w-[280px]">
              <h2 className="text-lg font-semibold text-white mb-1">Certification Progress</h2>
              <p className="text-sm text-muted-400 mb-4">
                {completed} of {ACORD_MODULES.length} modules completed · {overallProgress}% overall
              </p>
              <div className="grid grid-cols-3 gap-3 max-w-md">
                <div className="p-3 rounded-lg bg-bg-base border border-line-subtle">
                  <div className="flex items-center gap-1.5 text-emerald-400 mb-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span className="text-xs">Completed</span>
                  </div>
                  <div className="text-lg font-semibold text-white">{completed}</div>
                </div>
                <div className="p-3 rounded-lg bg-bg-base border border-line-subtle">
                  <div className="flex items-center gap-1.5 text-amber-400 mb-1">
                    <Clock3 className="w-3.5 h-3.5" />
                    <span className="text-xs">In Progress</span>
                  </div>
                  <div className="text-lg font-semibold text-white">{inProgress}</div>
                </div>
                <div className="p-3 rounded-lg bg-bg-base border border-line-subtle">
                  <div className="flex items-center gap-1.5 text-muted-500 mb-1">
                    <BookOpen className="w-3.5 h-3.5" />
                    <span className="text-xs">Not Started</span>
                  </div>
                  <div className="text-lg font-semibold text-white">{notStarted}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Average Score" value={`${avgScore}%`} icon={<Target className="w-5 h-5" />} accent="lava" />
          <StatCard label="Videos Completed" value={`${videosComplete}/${ACORD_MODULES.length}`} icon={<BookOpen className="w-5 h-5" />} accent="emerald" />
          <StatCard label="Training Hours" value={`${student.totalTrainingHours}h`} icon={<Clock3 className="w-5 h-5" />} accent="cyan" />
          <StatCard label="Best Score" value={scores.length ? `${Math.max(...scores)}%` : '—'} icon={<Award className="w-5 h-5" />} accent="neutral" />
        </div>

        {/* Score chart */}
        <div className="card p-6">
          <div className="flex items-center gap-2 mb-5">
            <BarChart3 className="w-4 h-4 text-lava-400" />
            <h3 className="text-sm font-semibold text-white">Module Score Comparison</h3>
          </div>
          <div className="space-y-4">
            {moduleScores.map((ms) => (
              <div key={ms.id} className="flex items-center gap-4">
                <div className="w-24 text-sm text-slate-300 shrink-0">{ms.label}</div>
                <div className="flex-1 relative h-7 rounded-lg bg-bg-base border border-line-subtle overflow-hidden">
                  <div
                    className={`h-full rounded-lg transition-all duration-700 flex items-center justify-end pr-2 ${
                      ms.score >= 80 ? 'bg-emerald-500/20 border-r-2 border-emerald-500' : ms.score >= 60 ? 'bg-amber-500/20 border-r-2 border-amber-500' : ms.hasScore ? 'bg-lava-600/20 border-r-2 border-lava-600' : ''
                    }`}
                    style={{ width: `${Math.max(ms.score, ms.hasScore ? 5 : 2)}%` }}
                  >
                    {ms.hasScore && <span className="text-xs font-medium text-white">{ms.score}%</span>}
                  </div>
                  {!ms.hasScore && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-600">No assessment yet</span>}
                </div>
                <div className="w-32 shrink-0">
                  {ms.score >= 80 ? <Badge variant="success">Competent</Badge> : ms.score >= 60 ? <Badge variant="warning">Developing</Badge> : ms.hasScore ? <Badge variant="error">Needs Work</Badge> : <Badge variant="default">Pending</Badge>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Per-module detail */}
        <SectionTitle title="Module Details" subtitle="Per-module progress and attempt history" />
        <div className="space-y-3">
          {ACORD_MODULES.map((mod) => {
            const p = progress[mod.id];
            const moduleProgress = p.videoCompleted ? (p.bestScore !== null ? 100 : 70) : Math.round(p.videoProgress * 0.7);
            return (
              <div key={mod.id} className="card-hover p-5 cursor-pointer" onClick={() => openModule(mod.id as AcordId)}>
                <div className="flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-semibold text-white">{mod.formNumber}</span>
                      <span className="text-sm text-muted-400">— {mod.title}</span>
                      {p.status === 'completed' && <Badge variant="success"><CheckCircle2 className="w-3 h-3" /> Complete</Badge>}
                      {p.status === 'in-progress' && <Badge variant="warning">In Progress</Badge>}
                      {p.status === 'not-started' && <Badge variant="default">Not Started</Badge>}
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="flex-1">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-muted-500">Progress</span>
                          <span className="text-slate-300">{moduleProgress}%</span>
                        </div>
                        <ProgressBar value={moduleProgress} color={p.status === 'completed' ? 'emerald' : 'lava'} size="sm" />
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-400">
                        <span>Best: <span className="text-slate-200 font-medium">{p.bestScore !== null ? `${p.bestScore}%` : '—'}</span></span>
                        <span>Attempts: <span className="text-slate-200 font-medium">{p.attemptsUsed}/3</span></span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
