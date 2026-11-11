import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  MinusCircle,
  Clock3,
  Target,
  TrendingUp,
  Lightbulb,
  RotateCcw,
  FileText,
  ArrowRight,
  Award,
  Download,
  Loader2,
  EyeOff,
  AlertCircle,
} from 'lucide-react';
import { useApp } from '../AppContext';
import { MODULE_MAP } from '../data/modules';
import { Topbar } from '../components/Topbar';
import { Badge, ProgressBar, ScoreRing, StatCard } from '../components/ui';
import { useState } from 'react';
import { friendlyError, getCompletedPdfUrl, MAX_ATTEMPTS, PASS_SCORE } from '../lib/assessmentService';

export function Results() {
  const { activeAttempt, activeModuleId, student, navigate, openModule, startAssessment } = useApp();
  const [filter, setFilter] = useState<'all' | 'correct' | 'incorrect' | 'missing'>('all');
  const [busy, setBusy] = useState<null | 'pdf' | 'retake'>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  if (!activeAttempt || !activeModuleId) {
    return (
      <div>
        <Topbar title="No results available" />
        <div className="px-8 py-12 text-center text-muted-400">No assessment results to display.</div>
      </div>
    );
  }

  const mod = MODULE_MAP[activeModuleId];
  const att = activeAttempt;
  const progress = student.progress[activeModuleId];
  const passed = att.score >= PASS_SCORE;
  const canRetake = progress.attemptsRemaining > 0;

  const filteredResults = att.fieldResults.filter((r) => {
    if (filter === 'all') return true;
    return r.status === filter;
  });

  const pct = (n: number) => (att.totalFields > 0 ? Math.round((n / att.totalFields) * 100) : 0);

  const downloadPdf = async () => {
    if (!att.completedPdfPath) return;
    setBusy('pdf'); setActionError(null);
    try {
      window.open(await getCompletedPdfUrl(att.completedPdfPath, `${mod.formNumber.replace(' ', '_')}_attempt_${att.attemptNumber}.pdf`), '_blank', 'noopener');
    } catch (err) {
      setActionError(friendlyError(err));
    } finally {
      setBusy(null);
    }
  };

  const retake = async () => {
    setBusy('retake'); setActionError(null);
    try {
      await startAssessment(activeModuleId);
    } catch (err) {
      setActionError(friendlyError(err));
      setBusy(null);
    }
  };

  const recommendations: string[] = [];
  if (att.missing > 0) recommendations.push(`Review the scenario email more carefully — ${att.missing} field${att.missing > 1 ? 's were' : ' was'} left empty. The email contains all required information.`);
  if (att.incorrect > att.correct * 0.3) recommendations.push('Slow down when entering data. Double-check each value against the source email before moving to the next field.');
  if (att.completionTimeMin < 15) recommendations.push('Your completion time was fast — accuracy is prioritized over speed. Take more time to verify your entries.');
  if (att.score >= 80 && att.score < 90) recommendations.push('Strong performance. Focus on the specific incorrect fields below to push your score above 90%.');
  if (att.score < 60) recommendations.push('Re-watch the training video before your next attempt to reinforce the form structure and key fields.');
  if (recommendations.length === 0) recommendations.push('Excellent work. You\'re ready to move on to the next ACORD module.');

  return (
    <div>
      <Topbar title="Assessment Results" subtitle={`${mod.formNumber} — ${mod.title}`} />
      <div className="px-8 py-6 space-y-6 max-w-[1100px]">
        <button onClick={() => navigate('module')} className="flex items-center gap-2 text-sm text-muted-400 hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Module
        </button>

        {/* Hero score */}
        <div className={`card p-8 relative overflow-hidden animate-scale-in ${passed ? 'border-emerald-500/20' : 'border-lava-600/20'}`}>
          <div className={`absolute top-0 right-0 w-72 h-72 rounded-full blur-3xl ${passed ? 'bg-emerald-500/5' : 'bg-lava-600/5'}`} />
          <div className="relative flex items-center gap-8 flex-wrap">
            <ScoreRing score={att.score} size={120} strokeWidth={8} />
            <div className="flex-1 min-w-[250px]">
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-2xl font-semibold text-white tracking-tight">
                  {passed ? 'Passed' : 'Below Threshold'}
                </h2>
                {passed && att.score >= 90 && <Badge variant="success"><Award className="w-3 h-3" /> Excellent</Badge>}
                {passed && att.score < 90 && <Badge variant="success"><CheckCircle2 className="w-3 h-3" /> Passing</Badge>}
                {!passed && <Badge variant="error"><XCircle className="w-3 h-3" /> Needs Improvement</Badge>}
              </div>
              <p className="text-sm text-muted-400 max-w-md mb-3">
                {mod.formNumber} · Attempt {att.attemptNumber} of {MAX_ATTEMPTS} · {passed
                  ? 'You\'ve met the 80% competency threshold for this module.'
                  : 'A score of 80% or higher is required to pass this module.'}
              </p>
              <div className="flex items-center gap-4 text-sm">
                <span className="flex items-center gap-1.5 text-muted-400">
                  <Clock3 className="w-4 h-4 text-cyan-400" />
                  Completed in <span className="text-slate-200 tabular-nums">{att.completionTimeMin} min</span>
                </span>
                <span className="flex items-center gap-1.5 text-muted-400">
                  <Target className="w-4 h-4 text-lava-400" />
                  {att.correct}/{att.totalFields} fields correct
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Correct Answers" value={att.correct} icon={<CheckCircle2 className="w-5 h-5" />} accent="emerald" />
          <StatCard label="Incorrect Answers" value={att.incorrect} icon={<XCircle className="w-5 h-5" />} accent="lava" />
          <StatCard label="Missing Information" value={att.missing} icon={<MinusCircle className="w-5 h-5" />} accent="cyan" />
          <StatCard label="Completion Time" value={`${att.completionTimeMin}m`} icon={<Clock3 className="w-5 h-5" />} accent="neutral" />
        </div>

        {/* Accuracy vs speed */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-lava-400" />
            <h3 className="text-sm font-semibold text-white">Performance Breakdown</h3>
            <span className="text-xs text-muted-500 ml-auto">Accuracy is prioritized over speed</span>
          </div>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-muted-400">Accuracy</span>
                <span className="text-slate-200 font-medium">{att.score}%</span>
              </div>
              <ProgressBar value={att.score} color={att.score >= 80 ? 'emerald' : 'lava'} />
            </div>
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-muted-400">Completeness</span>
                <span className="text-slate-200 font-medium">{pct(att.correct + att.incorrect)}%</span>
              </div>
              <ProgressBar value={pct(att.correct + att.incorrect)} color="cyan" />
            </div>
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-muted-400">Fields attempted</span>
                <span className="text-slate-200 font-medium">{att.correct + att.incorrect} of {att.totalFields}</span>
              </div>
              <ProgressBar value={pct(att.correct + att.incorrect)} color="lava" />
            </div>
          </div>
        </div>

        {/* Recommendations */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Lightbulb className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-semibold text-white">Recommendations for Improvement</h3>
          </div>
          <ul className="space-y-2.5">
            {recommendations.map((rec, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-slate-300 leading-relaxed">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-2 shrink-0" />
                {rec}
              </li>
            ))}
          </ul>
        </div>

        {!att.feedbackRevealed && (
          <div className="card p-4 flex items-start gap-3 border-cyan-500/15 bg-cyan-500/5">
            <EyeOff className="w-5 h-5 text-cyan-400 mt-0.5 shrink-0" />
            <p className="text-xs text-cyan-300/80 leading-relaxed">
              Expected answers stay hidden while you still have retakes, so each attempt measures what you can find in the
              scenario email yourself. They are revealed once you pass or use your final attempt.
            </p>
          </div>
        )}

        {/* Detailed feedback */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white">Detailed Field Feedback</h3>
            <div className="flex items-center gap-1 p-1 rounded-lg bg-bg-surface border border-line-subtle">
              {(['all', 'correct', 'incorrect', 'missing'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-all capitalize ${
                    filter === f ? 'bg-bg-elevated text-white' : 'text-muted-400 hover:text-slate-200'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            {filteredResults.length === 0 && (
              <div className="card p-6 text-center text-sm text-muted-500">No fields in this category.</div>
            )}
            {filteredResults.map((fr) => (
              <div key={fr.fieldId} className="card p-4 flex items-start gap-4 animate-fade-in">
                <div className="shrink-0 mt-0.5">
                  {fr.status === 'correct' && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
                  {fr.status === 'incorrect' && <XCircle className="w-5 h-5 text-lava-400" />}
                  {fr.status === 'missing' && <MinusCircle className="w-5 h-5 text-amber-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-white">{fr.label}</span>
                    <Badge variant={fr.status === 'correct' ? 'success' : fr.status === 'incorrect' ? 'error' : 'warning'}>
                      {fr.status}
                    </Badge>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-2 mb-2">
                    <div className="text-xs">
                      <span className="text-muted-500">Your answer: </span>
                      <span className={`font-mono ${fr.status === 'correct' ? 'text-emerald-400' : fr.status === 'missing' ? 'text-muted-600 italic' : 'text-lava-400'}`}>
                        {fr.given}
                      </span>
                    </div>
                    <div className="text-xs">
                      <span className="text-muted-500">Expected: </span>
                      {fr.expected !== null && fr.expected !== undefined
                        ? <span className="font-mono text-slate-300">{fr.expected}</span>
                        : <span className="italic text-muted-600">Hidden until final attempt</span>}
                    </div>
                  </div>
                  <p className="text-xs text-muted-400 leading-relaxed">{fr.feedback}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        {actionError && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-lava-600/5 border border-lava-600/20">
            <AlertCircle className="w-4 h-4 text-lava-400 mt-0.5 shrink-0" />
            <p className="text-xs text-lava-300">{actionError}</p>
          </div>
        )}
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={() => navigate('training')} className="btn-secondary">
            <FileText className="w-4 h-4" /> All Modules
          </button>
          <button onClick={() => openModule(activeModuleId)} className="btn-secondary">
            <ArrowLeft className="w-4 h-4" /> Back to Module
          </button>
          {att.completedPdfPath ? (
            <button onClick={downloadPdf} disabled={busy !== null} className="btn-secondary">
              {busy === 'pdf' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Completed PDF
            </button>
          ) : (
            <span className="text-xs text-muted-500">Completed PDF copy unavailable for this attempt</span>
          )}
          {canRetake && !passed && (
            <button onClick={retake} disabled={busy !== null} className="btn-primary ml-auto">
              {busy === 'retake' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />} Retake Assessment ({progress.attemptsRemaining} left)
            </button>
          )}
          {(!canRetake || passed) && (
            <button onClick={() => navigate('training')} className="btn-primary ml-auto">
              Continue Training <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
