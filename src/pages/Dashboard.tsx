import { CheckCircle2, Clock3, Target, ArrowRight, PlayCircle, FileText, Trophy, Lock, RotateCcw, Sparkles } from 'lucide-react';
import { useApp } from '../AppContext';
import { ACORD_MODULES } from '../data/modules';
import { Topbar } from '../components/Topbar';
import { StatCard, ProgressBar, Badge, ScoreRing, SectionTitle, StepTracker } from '../components/ui';
import { ModuleStatusBadge } from '../components/ModuleStatusBadge';
import { modulePassed, moduleProgressPct } from '../lib/assessmentService';
import { courseSteps, nextStep, type NextStep } from '../lib/nextStep';
import type { AcordId, AcordModule, ModuleProgress } from '../types';

const TONE_ICON: Record<NextStep['tone'], typeof PlayCircle> = {
  start: PlayCircle,
  continue: ArrowRight,
  retry: RotateCcw,
  blocked: Lock,
  done: CheckCircle2,
};

export function Dashboard() {
  const { student, openModule, navigate } = useApp();
  const progress = student.progress;
  const firstName = student.name.split(' ')[0] || 'there';

  const overallProgress = Math.round(
    ACORD_MODULES.reduce((acc, m) => acc + moduleProgressPct(progress[m.id]), 0) / ACORD_MODULES.length,
  );
  const passed = ACORD_MODULES.filter((m) => modulePassed(progress[m.id])).length;
  const inProgress = ACORD_MODULES.filter((m) => {
    const p = progress[m.id];
    return !modulePassed(p) && (p.videoProgress > 0 || p.attemptsUsed > 0);
  }).length;
  const videosDone = ACORD_MODULES.filter((m) => progress[m.id].videoCompleted).length;
  const scores = ACORD_MODULES.map((m) => progress[m.id].bestScore).filter((s): s is number => s !== null);
  const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
  const isNew = ACORD_MODULES.every((m) => progress[m.id].videoProgress === 0 && progress[m.id].attemptsUsed === 0);

  // Next course: one already started comes first (in course order), otherwise the first one not passed yet.
  const started = (p: ModuleProgress) => p.videoProgress > 0 || p.attemptsUsed > 0;
  const nextModule: AcordModule | undefined =
    ACORD_MODULES.find((m) => !modulePassed(progress[m.id]) && started(progress[m.id]) && progress[m.id].attemptsRemaining > 0)
    ?? ACORD_MODULES.find((m) => !modulePassed(progress[m.id]) && progress[m.id].attemptsRemaining > 0)
    ?? ACORD_MODULES.find((m) => !modulePassed(progress[m.id]));

  const recentAttempts = Object.values(progress)
    .flatMap((p) => p.attempts.map((a) => ({ ...a, moduleName: ACORD_MODULES.find((m) => m.id === a.moduleId)?.formNumber ?? a.moduleId })))
    .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
    .slice(0, 5);

  return (
    <div>
      <Topbar title={isNew ? `Welcome, ${firstName}!` : `Welcome back, ${firstName}`} subtitle="LAVA ACORD Training" />
      <div className="px-4 sm:px-6 lg:px-8 py-6 space-y-8 max-w-[1400px]">
        {/* Next step */}
        {nextModule ? (
          <NextStepHero module={nextModule} progress={progress[nextModule.id]} isNew={isNew}
            overall={overallProgress} passed={passed} onOpen={() => openModule(nextModule.id as AcordId)} />
        ) : (
          <div className="card p-6 sm:p-8 relative overflow-hidden border-emerald-500/30 animate-fade-in">
            <div className="absolute -top-16 -right-16 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl" />
            <div className="relative flex items-center gap-5 flex-wrap">
              <div className="w-14 h-14 rounded-2xl bg-amber-400/10 border border-amber-400/30 flex items-center justify-center">
                <Trophy className="w-7 h-7 text-amber-400" />
              </div>
              <div className="flex-1 min-w-[220px]">
                <h2 className="text-xl sm:text-2xl font-semibold text-white tracking-tight">You passed every course!</h2>
                <p className="text-sm text-muted-400 mt-1">All {ACORD_MODULES.length} ACORD forms are complete. Great work, {firstName}.</p>
              </div>
              <button onClick={() => navigate('progress')} className="btn-secondary">See my progress <ArrowRight className="w-4 h-4" /></button>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatCard label="Courses passed" value={`${passed}/${ACORD_MODULES.length}`} icon={<CheckCircle2 className="w-5 h-5" />} accent="emerald" />
          <StatCard label="In progress" value={inProgress} icon={<Clock3 className="w-5 h-5" />} accent="cyan" />
          <StatCard label="Average best score" value={avgScore === null ? '—' : `${avgScore}%`} icon={<Target className="w-5 h-5" />} accent="lava"
            trend={avgScore === null ? undefined : avgScore >= 80 ? 'Passing' : 'Below 80%'} trendUp={avgScore !== null && avgScore >= 80} />
          <StatCard label="Videos completed" value={`${videosDone}/${ACORD_MODULES.length}`} icon={<PlayCircle className="w-5 h-5" />} accent="neutral" />
        </div>

        {/* Courses */}
        <div>
          <SectionTitle title="Your courses" subtitle="Each course: watch the video, pass the Knowledge Check, then fill out the real ACORD form" />
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {ACORD_MODULES.map((mod) => {
              const p = progress[mod.id];
              const step = nextStep(p);
              const pct = moduleProgressPct(p);
              const isNext = nextModule?.id === mod.id;
              return (
                <div key={mod.id}
                  className={`card-hover p-5 flex flex-col animate-fade-in group ${isNext ? 'border-lava-600/40' : ''} ${step.tone === 'done' ? 'border-emerald-500/20' : ''}`}>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-11 h-11 rounded-lg border flex items-center justify-center shrink-0 transition-colors ${step.tone === 'done' ? 'bg-emerald-500/10 border-emerald-500/25' : 'bg-bg-elevated border-line-subtle group-hover:border-lava-600/30'}`}>
                        {step.tone === 'done' ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : <FileText className="w-5 h-5 text-lava-400" />}
                      </div>
                      <div className="min-w-0">
                        <div className="text-[11px] text-muted-500 uppercase tracking-wider">{mod.category}</div>
                        <div className="text-sm font-semibold text-white">{mod.formNumber}</div>
                      </div>
                    </div>
                    {isNext ? <Badge variant="lava"><Sparkles className="w-3 h-3" /> Up next</Badge> : <ModuleStatusBadge progress={p} showNotStarted={false} />}
                  </div>

                  <h3 className="text-base font-semibold text-white tracking-tight">{mod.title}</h3>
                  <p className="text-sm text-muted-400 leading-relaxed mt-1 mb-4 flex-1 line-clamp-2">{mod.description}</p>

                  <div className="mb-4"><StepTracker steps={courseSteps(p)} compact /></div>

                  <div className="flex items-center gap-3 mb-4">
                    <ProgressBar value={pct} color={step.tone === 'done' ? 'emerald' : 'lava'} size="sm" className="flex-1" />
                    <span className="text-xs text-slate-300 font-medium tabular-nums w-9 text-right">{pct}%</span>
                  </div>

                  <div className="flex items-center justify-between gap-3 pt-4 border-t border-line-subtle">
                    <span className="text-xs text-muted-400 flex items-center gap-1.5 min-w-0">
                      <PlayCircle className="w-3.5 h-3.5 shrink-0" /> {mod.videoDuration} video
                      {p.bestScore !== null && <><span className="text-muted-600">·</span> best {p.bestScore}%</>}
                    </span>
                    <button onClick={() => openModule(mod.id as AcordId)}
                      className={`${isNext ? 'btn-primary' : 'btn-secondary'} text-xs px-3 py-2 shrink-0`}>
                      {step.button} <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent activity */}
        <div>
          <SectionTitle title="Recent form attempts" subtitle="Your latest graded submissions" />
          <div className="card divide-y divide-line-subtle">
            {recentAttempts.length === 0 && (
              <div className="p-8 text-center">
                <FileText className="w-8 h-8 text-muted-600 mx-auto mb-2" />
                <p className="text-sm text-slate-300">No forms submitted yet</p>
                <p className="text-xs text-muted-500 mt-1">Your graded ACORD forms will show up here.</p>
              </div>
            )}
            {recentAttempts.map((att) => (
              <div key={att.id} className="flex items-center gap-3 sm:gap-4 p-4 hover:bg-bg-hover/50 transition-colors">
                <ScoreRing score={att.score} size={44} strokeWidth={4} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white">{att.moduleName} · Attempt {att.attemptNumber}</div>
                  <div className="text-xs text-muted-500 truncate">
                    {att.correct} correct · {att.incorrect} incorrect · {att.missing} missing · {att.completionTimeMin} min
                  </div>
                </div>
                <div className="hidden sm:block text-xs text-muted-500">
                  {new Date(att.completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </div>
                <Badge variant={att.score >= 80 ? 'success' : 'warning'}>{att.score >= 80 ? 'Passed' : 'Not passed'}</Badge>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function NextStepHero({ module: mod, progress: p, isNew, overall, passed, onOpen }: {
  module: AcordModule; progress: ModuleProgress; isNew: boolean; overall: number; passed: number; onOpen: () => void;
}) {
  const step = nextStep(p);
  const Icon = TONE_ICON[step.tone];
  return (
    <div className="card p-5 sm:p-7 relative overflow-hidden border-lava-600/30 animate-fade-in">
      <div className="absolute -top-24 -right-24 w-80 h-80 bg-lava-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="relative grid lg:grid-cols-[1fr_auto] gap-6 items-center">
        <div className="min-w-0">
          <div className="text-xs font-semibold text-lava-300 uppercase tracking-wider mb-2">
            {isNew ? 'Start here' : 'Your next step'}
          </div>
          <h2 className="text-xl sm:text-2xl font-semibold text-white tracking-tight">
            {mod.formNumber}: {mod.title}
          </h2>
          <p className="text-sm text-slate-300 mt-1.5">
            <span className="font-medium text-white">{step.title}.</span> {step.detail}
          </p>
          <div className="mt-5 max-w-md"><StepTracker steps={courseSteps(p)} /></div>
          <button onClick={onOpen} className="btn-primary mt-6 px-5 py-3">
            <Icon className="w-4 h-4" /> {step.button}
          </button>
        </div>
        <div className="flex lg:flex-col items-center gap-4 lg:gap-2 lg:pl-8 lg:border-l border-line-subtle">
          <ScoreRing score={overall} size={84} strokeWidth={6} kind="progress" />
          <div className="lg:text-center">
            <div className="text-xs text-muted-500 uppercase tracking-wider">Overall</div>
            <div className="text-sm text-white mt-0.5">{passed} of {ACORD_MODULES.length} passed</div>
          </div>
        </div>
      </div>
    </div>
  );
}
