import {
  TrendingUp,
  CheckCircle2,
  Clock3,
  Target,
  ArrowRight,
  PlayCircle,
  CheckCircle,
  AlertCircle,
  RotateCcw,
  FileText,
} from 'lucide-react';
import { useApp } from '../AppContext';
import { ACORD_MODULES } from '../data/modules';
import { Topbar } from '../components/Topbar';
import { StatCard, ProgressBar, Badge, ScoreRing, SectionTitle } from '../components/ui';
import type { AcordId } from '../types';

export function Dashboard() {
  const { student, openModule, navigate } = useApp();
  const progress = student.progress;

  const overallProgress = Math.round(
    (Object.values(progress).reduce((acc, p) => {
      let moduleScore = 0;
      if (p.videoCompleted) moduleScore += 30;
      if (p.status === 'completed') moduleScore += 40;
      if (p.bestScore !== null) moduleScore += (p.bestScore / 100) * 30;
      return acc + moduleScore;
    }, 0) /
      (ACORD_MODULES.length * 100)) *
      100,
  );

  const completed = Object.values(progress).filter((p) => p.status === 'completed').length;
  const pending = ACORD_MODULES.length - completed;
  const scores = Object.values(progress).filter((p) => p.bestScore !== null).map((p) => p.bestScore!);
  const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;

  const recentAttempts = Object.values(progress)
    .flatMap((p) => p.attempts.map((a) => ({ ...a, moduleName: ACORD_MODULES.find((m) => m.id === a.moduleId)?.formNumber ?? a.moduleId })))
    .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
    .slice(0, 5);

  return (
    <div>
      <Topbar title="Welcome to LAVA ACORD Training" subtitle="Your commercial insurance form competency dashboard" />
      <div className="px-8 py-6 space-y-8 max-w-[1400px]">
        {/* Welcome banner */}
        <div className="card p-6 bg-gradient-to-r from-bg-surface to-bg-elevated relative overflow-hidden animate-fade-in">
          <div className="absolute top-0 right-0 w-64 h-64 bg-lava-600/5 rounded-full blur-3xl" />
          <div className="relative flex items-center justify-between flex-wrap gap-6">
            <div>
              <h2 className="text-2xl font-semibold text-white tracking-tight mb-1">
                Welcome back, {student.name.split(' ')[0]}
              </h2>
              <p className="text-sm text-muted-400 max-w-lg">
                You're making steady progress through the ACORD certification track. Complete your remaining modules
                to reach full competency status.
              </p>
            </div>
            <div className="flex items-center gap-6">
              <ScoreRing score={overallProgress} size={72} />
              <div>
                <div className="text-xs text-muted-500 uppercase tracking-wider mb-1">Overall Progress</div>
                <div className="text-sm text-white">{completed} of {ACORD_MODULES.length} modules complete</div>
                <button
                  onClick={() => navigate('training')}
                  className="mt-2 text-xs text-lava-400 hover:text-lava-300 flex items-center gap-1 transition-colors"
                >
                  Continue training <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Completed Modules" value={`${completed}/${ACORD_MODULES.length}`} icon={<CheckCircle2 className="w-5 h-5" />} accent="emerald" trend={`${pending} remaining`} />
          <StatCard label="Pending Modules" value={pending} icon={<Clock3 className="w-5 h-5" />} accent="cyan" />
          <StatCard label="Average Assessment Score" value={`${avgScore}%`} icon={<Target className="w-5 h-5" />} accent="lava" trend={avgScore >= 80 ? 'Above target' : 'Below target'} trendUp={avgScore >= 80} />
          <StatCard label="Total Training Hours" value={`${student.totalTrainingHours}h`} icon={<TrendingUp className="w-5 h-5" />} accent="neutral" />
        </div>

        {/* Module cards */}
        <div>
          <SectionTitle title="ACORD Training Modules" subtitle="Select a form to begin or continue training" />
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {ACORD_MODULES.map((mod) => {
              const p = progress[mod.id];
              const moduleProgress = p.videoCompleted ? (p.bestScore !== null ? 100 : 70) : Math.round(p.videoProgress * 0.7);
              return (
                <div key={mod.id} className="card-hover p-5 flex flex-col animate-fade-in group">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-lg bg-bg-elevated border border-line-subtle flex items-center justify-center group-hover:border-lava-600/30 transition-colors">
                        <FileText className="w-5 h-5 text-lava-400" />
                      </div>
                      <div>
                        <div className="text-xs text-muted-500 uppercase tracking-wider">{mod.category}</div>
                        <div className="text-sm font-semibold text-white">{mod.formNumber}</div>
                      </div>
                    </div>
                    <StatusBadge status={p.status} />
                  </div>

                  <h3 className="text-base font-semibold text-white tracking-tight mb-1">{mod.title}</h3>
                  <p className="text-sm text-muted-400 leading-relaxed mb-4 flex-1">{mod.description}</p>

                  <div className="space-y-3 mb-4">
                    <div>
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="text-muted-500">Training progress</span>
                        <span className="text-slate-300 font-medium">{moduleProgress}%</span>
                      </div>
                      <ProgressBar value={moduleProgress} color={p.status === 'completed' ? 'emerald' : 'lava'} size="sm" />
                    </div>

                    <div className="flex items-center gap-4 text-xs">
                      <div className="flex items-center gap-1.5">
                        {p.videoCompleted ? (
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <PlayCircle className="w-3.5 h-3.5 text-muted-500" />
                        )}
                        <span className={p.videoCompleted ? 'text-emerald-400' : 'text-muted-500'}>
                          {p.videoCompleted ? 'Video complete' : 'Video pending'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Target className="w-3.5 h-3.5 text-muted-500" />
                        <span className="text-muted-400">
                          {p.bestScore !== null ? `${p.bestScore}% best` : 'No score'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-line-subtle">
                    <div className="flex items-center gap-1.5 text-xs">
                      <RotateCcw className="w-3.5 h-3.5 text-muted-500" />
                      <span className="text-muted-400">{p.attemptsRemaining} attempts left</span>
                    </div>
                    <button
                      onClick={() => openModule(mod.id as AcordId)}
                      className="btn-primary text-xs px-3 py-2"
                    >
                      {p.status === 'not-started' ? 'Start Training' : p.status === 'completed' ? 'Review' : 'Continue'}
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent activity */}
        <div>
          <SectionTitle title="Recent Assessment Activity" subtitle="Your latest submissions across all modules" />
          <div className="card divide-y divide-line-subtle">
            {recentAttempts.length === 0 && (
              <div className="p-8 text-center text-muted-500 text-sm">No assessments submitted yet.</div>
            )}
            {recentAttempts.map((att) => (
              <div key={att.id} className="flex items-center gap-4 p-4 hover:bg-bg-hover/50 transition-colors">
                <ScoreRing score={att.score} size={44} strokeWidth={4} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white">{att.moduleName} — Attempt {att.attemptNumber}</div>
                  <div className="text-xs text-muted-500">
                    {att.correct} correct · {att.incorrect} incorrect · {att.missing} missing · {att.completionTimeMin} min
                  </div>
                </div>
                <div className="text-xs text-muted-500">
                  {new Date(att.completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </div>
                <Badge variant={att.score >= 80 ? 'success' : att.score >= 60 ? 'warning' : 'error'}>
                  {att.score >= 80 ? 'Pass' : att.score >= 60 ? 'Review' : 'Retake'}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: 'not-started' | 'in-progress' | 'completed' }) {
  if (status === 'completed') return <Badge variant="success"><CheckCircle className="w-3 h-3" /> Complete</Badge>;
  if (status === 'in-progress') return <Badge variant="warning"><AlertCircle className="w-3 h-3" /> In Progress</Badge>;
  return <Badge variant="default"><Clock3 className="w-3 h-3" /> Not Started</Badge>;
}
