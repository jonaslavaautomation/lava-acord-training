import { useState } from 'react';
import { ClipboardList, Target, Clock3, CheckCircle2, XCircle, MinusCircle, ChevronRight } from 'lucide-react';
import { useApp } from '../AppContext';
import { ACORD_MODULES, MODULE_MAP } from '../data/modules';
import { Topbar } from '../components/Topbar';
import { Badge, ScoreRing, ProgressBar, SectionTitle } from '../components/ui';
import type { AcordId, AttemptResult } from '../types';

export function MyAssessments() {
  const { student, showResults } = useApp();
  const [selectedModule, setSelectedModule] = useState<AcordId | 'all'>('all');

  const allAttempts: (AttemptResult & { moduleId: AcordId })[] = [];
  ACORD_MODULES.forEach((mod) => {
    student.progress[mod.id].attempts.forEach((att) => {
      allAttempts.push({ ...att, moduleId: mod.id });
    });
  });
  allAttempts.sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());

  const filtered = selectedModule === 'all' ? allAttempts : allAttempts.filter((a) => a.moduleId === selectedModule);
  const avgScore = filtered.length ? Math.round(filtered.reduce((sum, a) => sum + a.score, 0) / filtered.length) : 0;

  return (
    <div>
      <Topbar title="My Assessments" subtitle="All your ACORD form assessment attempts" />
      <div className="px-8 py-6 space-y-6 max-w-[1200px]">
        {/* Summary */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card p-5">
            <div className="text-xs text-muted-500 uppercase tracking-wider mb-2">Total Attempts</div>
            <div className="stat-value">{allAttempts.length}</div>
          </div>
          <div className="card p-5">
            <div className="text-xs text-muted-500 uppercase tracking-wider mb-2">Average Score</div>
            <div className="stat-value">{avgScore}%</div>
          </div>
          <div className="card p-5">
            <div className="text-xs text-muted-500 uppercase tracking-wider mb-2">Passing Attempts</div>
            <div className="stat-value text-emerald-400">{allAttempts.filter((a) => a.score >= 80).length}</div>
          </div>
          <div className="card p-5">
            <div className="text-xs text-muted-500 uppercase tracking-wider mb-2">Best Single Score</div>
            <div className="stat-value">{allAttempts.length ? Math.max(...allAttempts.map((a) => a.score)) : 0}%</div>
          </div>
        </div>

        {/* Module filter */}
        <div className="flex items-center gap-1 p-1 rounded-lg bg-bg-surface border border-line-subtle w-fit overflow-x-auto">
          <button
            onClick={() => setSelectedModule('all')}
            className={`px-3 py-2 rounded-md text-xs font-medium transition-all whitespace-nowrap ${
              selectedModule === 'all' ? 'bg-bg-elevated text-white' : 'text-muted-400 hover:text-slate-200'
            }`}
          >
            All Modules
          </button>
          {ACORD_MODULES.map((mod) => (
            <button
              key={mod.id}
              onClick={() => setSelectedModule(mod.id)}
              className={`px-3 py-2 rounded-md text-xs font-medium transition-all whitespace-nowrap ${
                selectedModule === mod.id ? 'bg-bg-elevated text-white' : 'text-muted-400 hover:text-slate-200'
              }`}
            >
              {mod.formNumber}
            </button>
          ))}
        </div>

        {/* Attempts list */}
        <SectionTitle title="Attempt History" subtitle={`${filtered.length} assessment${filtered.length !== 1 ? 's' : ''}`} />
        <div className="card divide-y divide-line-subtle">
          {filtered.length === 0 && (
            <div className="p-8 text-center text-muted-500 text-sm flex flex-col items-center gap-2">
              <ClipboardList className="w-8 h-8 text-muted-600" />
              No assessments submitted yet. Start a training module to take your first assessment.
            </div>
          )}
          {filtered.map((att) => {
            const mod = MODULE_MAP[att.moduleId];
            return (
              <div key={att.id} className="flex items-center gap-5 p-4 hover:bg-bg-hover/50 transition-colors group">
                <ScoreRing score={att.score} size={52} strokeWidth={4} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-white">{mod.formNumber}</span>
                    <span className="text-sm text-muted-400">— {mod.title}</span>
                    <Badge variant="info">Attempt {att.attemptNumber}</Badge>
                    {att.score >= 80 ? (
                      <Badge variant="success"><CheckCircle2 className="w-3 h-3" /> Pass</Badge>
                    ) : (
                      <Badge variant="warning">Below threshold</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-500">
                    <span className="flex items-center gap-1"><Target className="w-3.5 h-3.5" /> {att.correct} correct</span>
                    <span className="flex items-center gap-1"><XCircle className="w-3.5 h-3.5" /> {att.incorrect} incorrect</span>
                    <span className="flex items-center gap-1"><MinusCircle className="w-3.5 h-3.5" /> {att.missing} missing</span>
                    <span className="flex items-center gap-1"><Clock3 className="w-3.5 h-3.5" /> {att.completionTimeMin} min</span>
                  </div>
                </div>
                <div className="text-xs text-muted-500 text-right">
                  {new Date(att.completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  <div className="text-muted-600 mt-0.5">
                    {new Date(att.completedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                  </div>
                </div>
                <button
                  onClick={() => showResults(att)}
                  title="View results and feedback"
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <ChevronRight className="w-5 h-5 text-muted-500 hover:text-lava-400" />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
