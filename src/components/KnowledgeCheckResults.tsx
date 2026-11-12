import { useCallback, useEffect, useMemo, useState } from 'react';
import { ClipboardCheck, Loader2, RotateCcw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { resetKnowledgeCheck } from '../lib/assessmentService';
import { Badge, SectionTitle } from './ui';
import type { AcordId } from '../types';

interface AttemptRow {
  user_id: string;
  module_id: AcordId;
  score: number;
  correct: number;
  total: number;
  passed: boolean;
  created_at: string;
  profiles: { full_name: string | null; email: string | null } | null;
}

interface Summary {
  userId: string;
  name: string;
  moduleId: AcordId;
  attempts: number;
  best: number;
  bestCorrect: string;
  passed: boolean;
  last: string;
}

/** Trainer view: each student's Knowledge Check result per ACORD form. */
export function KnowledgeCheckResults() {
  const [rows, setRows] = useState<AttemptRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error: e } = await supabase.from('knowledge_check_attempts')
      .select('user_id,module_id,score,correct,total,passed,created_at,profiles(full_name,email)')
      .order('created_at', { ascending: false }).limit(1000);
    if (e) {
      // Feature not installed yet: hide quietly.
      if (/knowledge_check_attempts/.test(e.message)) { setRows([]); return; }
      setError(e.message);
      return;
    }
    setRows((data ?? []) as unknown as AttemptRow[]);
  }, []);

  useEffect(() => { load(); }, [load]);

  const summaries: Summary[] = useMemo(() => {
    const map = new Map<string, Summary>();
    for (const r of rows ?? []) {
      const k = `${r.user_id}:${r.module_id}`;
      const s = map.get(k);
      const name = r.profiles?.full_name || r.profiles?.email || 'Student';
      if (!s) {
        map.set(k, { userId: r.user_id, name, moduleId: r.module_id, attempts: 1, best: r.score, bestCorrect: `${r.correct}/${r.total}`, passed: r.passed, last: r.created_at });
      } else {
        s.attempts += 1;
        if (r.score > s.best) { s.best = r.score; s.bestCorrect = `${r.correct}/${r.total}`; }
        s.passed ||= r.passed;
      }
    }
    return [...map.values()].sort((a, b) => b.last.localeCompare(a.last));
  }, [rows]);

  const reset = async (s: Summary) => {
    if (!window.confirm(`Reset ${s.name}'s ACORD ${s.moduleId} Knowledge Check? They will need to pass it again before the assessment.`)) return;
    setBusy(`${s.userId}:${s.moduleId}`);
    try {
      await resetKnowledgeCheck(s.userId, s.moduleId);
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <section>
      <SectionTitle title="Knowledge Check Results" subtitle="Video comprehension quiz (15 questions per form, 80% to pass) taken before the PDF assessment" />
      <div className="card overflow-hidden">
        {error && <div className="p-4 text-sm text-lava-300">{error}</div>}
        {rows === null && !error && <div className="p-6 flex items-center gap-2 text-sm text-muted-400"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>}
        {rows !== null && summaries.length === 0 && (
          <div className="p-6 flex items-center gap-3 text-sm text-muted-400"><ClipboardCheck className="w-4 h-4" /> No Knowledge Check attempts yet.</div>
        )}
        {summaries.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-muted-500 border-b border-line-subtle">
                  <th className="px-4 py-3 font-semibold">Student</th>
                  <th className="px-4 py-3 font-semibold">Form</th>
                  <th className="px-4 py-3 font-semibold">Best score</th>
                  <th className="px-4 py-3 font-semibold">Attempts</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Last attempt</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {summaries.map((s) => (
                  <tr key={`${s.userId}:${s.moduleId}`} className="border-b border-line-subtle last:border-0">
                    <td className="px-4 py-3 text-slate-200">{s.name}</td>
                    <td className="px-4 py-3 text-muted-400">ACORD {s.moduleId}</td>
                    <td className="px-4 py-3 tabular-nums text-slate-200">{s.best}% <span className="text-muted-500 text-xs">({s.bestCorrect})</span></td>
                    <td className="px-4 py-3 tabular-nums text-muted-400">{s.attempts}</td>
                    <td className="px-4 py-3">{s.passed ? <Badge variant="success">Passed</Badge> : <Badge variant="warning">Not passed</Badge>}</td>
                    <td className="px-4 py-3 text-muted-500 text-xs">{new Date(s.last).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => reset(s)} disabled={busy !== null} className="btn-ghost text-xs" title="Clear this student's attempts so they retake the quiz">
                        {busy === `${s.userId}:${s.moduleId}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />} Reset
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
