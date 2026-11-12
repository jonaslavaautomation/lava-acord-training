import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle, CheckCircle2, ClipboardCheck, Loader2, Lock, RotateCcw, XCircle } from 'lucide-react';
import { Badge, ProgressBar } from './ui';
import {
  getKnowledgeCheck,
  submitKnowledgeCheck,
  type KnowledgeCheckQuestion,
  type KnowledgeCheckStatus,
  type KnowledgeCheckSubmission,
} from '../lib/assessmentService';
import type { AcordId } from '../types';

/** 'unavailable' = feature not installed in the database (does not block the assessment). */
export type KnowledgeCheckGate = 'loading' | 'unavailable' | 'locked' | 'required' | 'passed';

interface Props {
  moduleId: AcordId;
  formNumber: string;
  videoComplete: boolean;
  onGateChange: (gate: KnowledgeCheckGate) => void;
}

/** Fisher–Yates shuffle of option positions, so the correct answer is not always in the same place. */
function shuffledOrder(n: number): number[] {
  const order = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

export function KnowledgeCheck({ moduleId, formNumber, videoComplete, onGateChange }: Props) {
  const [status, setStatus] = useState<KnowledgeCheckStatus | null | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [taking, setTaking] = useState(false);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [orders, setOrders] = useState<Record<string, number[]>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<KnowledgeCheckSubmission | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      setStatus(await getKnowledgeCheck(moduleId));
    } catch (err) {
      setLoadError((err as Error).message);
      setStatus(null);
    }
  }, [moduleId]);

  // Reload when the video flips to complete (the server only hands out questions after that).
  useEffect(() => { load(); }, [load, videoComplete]);

  useEffect(() => {
    if (status === undefined) onGateChange('loading');
    else if (status === null || status.question_count === 0) onGateChange(loadError ? 'required' : 'unavailable');
    else if (status.passed) onGateChange('passed');
    else onGateChange(status.video_complete ? 'required' : 'locked');
  }, [status, loadError, onGateChange]);

  const questions: KnowledgeCheckQuestion[] = useMemo(() => status?.questions ?? [], [status]);
  const answered = questions.filter((q) => answers[q.id] !== undefined).length;

  const begin = () => {
    setOrders(Object.fromEntries(questions.map((q) => [q.id, shuffledOrder(q.options.length)])));
    setAnswers({});
    setResult(null);
    setSubmitError(null);
    setTaking(true);
  };

  const submit = async () => {
    if (answered < questions.length) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const r = await submitKnowledgeCheck(moduleId, answers);
      setResult(r);
      setTaking(false);
      await load();
      window.scrollTo({ top: document.getElementById('knowledge-check')?.offsetTop ?? 0, behavior: 'smooth' });
    } catch (err) {
      setSubmitError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  if (status === undefined) {
    return <div className="card p-6 flex items-center gap-2 text-sm text-muted-400"><Loader2 className="w-4 h-4 animate-spin" /> Loading Knowledge Check…</div>;
  }
  if (status === null || status.question_count === 0) {
    return loadError
      ? <div className="card p-4 text-sm text-lava-300 flex items-center gap-2"><AlertCircle className="w-4 h-4" /> Could not load the Knowledge Check: {loadError}</div>
      : null;
  }

  const passMark = Math.ceil((status.pass_score / 100) * status.question_count);

  // ---------------- locked (video not finished)
  if (!status.video_complete && !status.passed) {
    return (
      <div className="card p-6 flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-bg-elevated border border-line-subtle flex items-center justify-center shrink-0"><Lock className="w-6 h-6 text-muted-600" /></div>
        <div>
          <h3 className="text-base font-semibold text-white">{status.question_count}-question Knowledge Check</h3>
          <p className="text-sm text-muted-400 mt-0.5">Unlocks after you finish the training video. You need {status.pass_score}% ({passMark} of {status.question_count}) to unlock the {formNumber} assessment.</p>
        </div>
      </div>
    );
  }

  // ---------------- passed
  if (status.passed && !taking) {
    const review = result?.passed ? result.results : status.last_attempt?.results ?? [];
    const last = result?.passed ? result : status.last_attempt;
    return (
      <div className="card p-6 space-y-4 border-emerald-500/20">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0"><CheckCircle2 className="w-6 h-6 text-emerald-400" /></div>
          <div className="flex-1 min-w-[200px]">
            <h3 className="text-base font-semibold text-white">Knowledge Check passed{last ? ` — ${last.correct}/${last.total} (${last.score}%)` : ''}</h3>
            <p className="text-sm text-muted-400 mt-0.5">The {formNumber} assessment is unlocked. Review the answers below before you start.</p>
          </div>
          <Badge variant="success"><CheckCircle className="w-3 h-3" /> Passed</Badge>
        </div>
        {review.length > 0 && <ReviewList items={review} />}
      </div>
    );
  }

  // ---------------- taking the quiz
  if (taking) {
    return (
      <div className="card p-6 space-y-5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h3 className="text-base font-semibold text-white">{formNumber} Knowledge Check</h3>
            <p className="text-xs text-muted-500 mt-0.5">Answer all {questions.length} questions · pass mark {status.pass_score}% ({passMark}/{questions.length})</p>
          </div>
          <span className="text-xs text-muted-400 tabular-nums">{answered}/{questions.length} answered</span>
        </div>
        <ProgressBar value={answered} max={questions.length} size="sm" />

        <ol className="space-y-4">
          {questions.map((q, i) => (
            <li key={q.id} className="p-4 rounded-lg bg-bg-base border border-line-subtle">
              <p className="text-sm font-medium text-white mb-3"><span className="text-muted-500 mr-1.5">{i + 1}.</span>{q.prompt}</p>
              <div className="space-y-1.5" role="radiogroup" aria-label={`Question ${i + 1}`}>
                {(orders[q.id] ?? q.options.map((_, k) => k)).map((optIdx) => {
                  const selected = answers[q.id] === optIdx;
                  return (
                    <label key={optIdx} className={`flex items-start gap-3 p-2.5 rounded-md border cursor-pointer transition-colors ${selected ? 'border-lava-500/60 bg-lava-600/10' : 'border-line-subtle hover:border-line'}`}>
                      <input type="radio" name={q.id} className="mt-0.5 accent-lava-500" checked={selected}
                        onChange={() => setAnswers((a) => ({ ...a, [q.id]: optIdx }))} />
                      <span className="text-sm text-slate-200">{q.options[optIdx]}</span>
                    </label>
                  );
                })}
              </div>
            </li>
          ))}
        </ol>

        {submitError && <p className="text-xs text-lava-300 flex items-center gap-1.5"><AlertCircle className="w-3.5 h-3.5" /> {submitError}</p>}
        <div className="flex items-center justify-end gap-3 flex-wrap">
          <button onClick={() => setTaking(false)} className="btn-ghost text-sm" disabled={submitting}>Cancel</button>
          <button onClick={submit} disabled={answered < questions.length || submitting} className="btn-primary px-5 py-2.5 text-sm">
            {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Grading…</> : answered < questions.length ? `Answer all questions (${questions.length - answered} left)` : 'Submit Knowledge Check'}
          </button>
        </div>
      </div>
    );
  }

  // ---------------- ready / failed
  const failed = result && !result.passed ? result : null;
  return (
    <div className="card p-6 space-y-4">
      <div className="flex items-center gap-4 flex-wrap">
        <div className="w-12 h-12 rounded-xl bg-lava-600/10 border border-lava-600/20 flex items-center justify-center shrink-0"><ClipboardCheck className="w-6 h-6 text-lava-400" /></div>
        <div className="flex-1 min-w-[220px]">
          <h3 className="text-base font-semibold text-white">{status.question_count}-question Knowledge Check</h3>
          <p className="text-sm text-muted-400 mt-0.5">
            Check your understanding of the {formNumber} training. Score {status.pass_score}% or higher ({passMark} of {status.question_count}) to unlock the assessment.
            {status.attempts > 0 && ` Attempts so far: ${status.attempts} · best ${status.best_score ?? 0}%.`}
          </p>
        </div>
        <button onClick={begin} className="btn-primary px-5 py-2.5 text-sm">
          {status.attempts > 0 ? <><RotateCcw className="w-4 h-4" /> Retake Knowledge Check</> : <><ClipboardCheck className="w-4 h-4" /> Start Knowledge Check</>}
        </button>
      </div>

      {failed && (
        <div className="p-4 rounded-lg bg-amber-500/5 border border-amber-500/20 space-y-3">
          <p className="text-sm text-amber-300 font-medium">
            You scored {failed.correct}/{failed.total} ({failed.score}%). You need {failed.pass_score}% to pass — review the training video and try again.
          </p>
          <p className="text-xs text-muted-400">Questions to review (the correct answers are shown after you pass):</p>
          <ul className="space-y-1">
            {failed.results.map((r, i) => !r.correct && (
              <li key={r.id} className="flex items-start gap-2 text-xs text-slate-300"><XCircle className="w-3.5 h-3.5 text-lava-400 mt-0.5 shrink-0" /> {i + 1}. {r.prompt}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ReviewList({ items }: { items: KnowledgeCheckSubmission['results'] }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button onClick={() => setOpen((o) => !o)} className="text-xs text-muted-400 hover:text-white">{open ? 'Hide' : 'Show'} answer review</button>
      {open && (
        <ol className="mt-3 space-y-2">
          {items.map((r, i) => (
            <li key={r.id} className={`p-3 rounded-lg bg-bg-base border ${r.correct ? 'border-emerald-500/15' : 'border-lava-600/20'}`}>
              <p className="text-sm text-white flex items-start gap-2">
                {r.correct ? <CheckCircle className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" /> : <XCircle className="w-4 h-4 text-lava-400 mt-0.5 shrink-0" />}
                <span><span className="text-muted-500 mr-1">{i + 1}.</span>{r.prompt}</span>
              </p>
              {r.options && r.correct_index !== undefined && (
                <p className="text-xs text-emerald-300 mt-1.5 ml-6">Answer: {r.options[r.correct_index]}</p>
              )}
              {!r.correct && r.options && r.given !== null && (
                <p className="text-xs text-lava-300 mt-0.5 ml-6">Your answer: {r.options[r.given]}</p>
              )}
              {r.explanation && <p className="text-xs text-muted-400 mt-1 ml-6">{r.explanation}</p>}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
