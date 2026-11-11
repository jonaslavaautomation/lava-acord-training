import { useState } from 'react';
import {
  Users,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Target,
  Clock3,
  Search,
  ChevronRight,
  UserCheck,
  GraduationCap,
  Award,
} from 'lucide-react';
import { Topbar } from '../components/Topbar';
import { Badge, ProgressBar, ScoreRing, StatCard, SectionTitle } from '../components/ui';
import { useTrainerData } from '../lib/trainerData';
import { useApp } from '../AppContext';
import { ACORD_MODULES } from '../data/modules';

export function TrainerDashboard() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'attention' | 'completed'>('all');
  const { navigate } = useApp();
  const { students: TRAINER_STUDENTS, activity: TRAINER_ACTIVITY, loading, error } = useTrainerData();

  const totalStudents = TRAINER_STUDENTS.length;
  const activeStudents = TRAINER_STUDENTS.filter((s) => s.status === 'active').length;
  const completedAssessments = TRAINER_STUDENTS.reduce((sum, s) => sum + s.modulesCompleted, 0);
  const scored = TRAINER_STUDENTS.filter((s) => s.averageScore !== null);
  const avgScore = scored.length ? Math.round(scored.reduce((sum, s) => sum + (s.averageScore ?? 0), 0) / scored.length) : 0;
  const needsImprovement = TRAINER_STUDENTS.filter((s) => s.needsAttention).length;

  const filteredStudents = TRAINER_STUDENTS.filter((s) => {
    if (filter === 'attention' && !s.needsAttention) return false;
    if (filter === 'completed' && s.status !== 'completed') return false;
    if (search && !s.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div>
      <Topbar title="Trainer Dashboard" subtitle="Monitor student performance and assessment activity" />
      <div className="px-8 py-6 space-y-6 max-w-[1400px]">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total Students" value={totalStudents} icon={<Users className="w-5 h-5" />} accent="lava" />
          <StatCard label="Currently Training" value={activeStudents} icon={<GraduationCap className="w-5 h-5" />} accent="cyan" trend={`${totalStudents - activeStudents} inactive`} />
          <StatCard label="Completed Assessments" value={completedAssessments} icon={<CheckCircle2 className="w-5 h-5" />} accent="emerald" />
          <StatCard label="Average Student Score" value={`${avgScore}%`} icon={<Target className="w-5 h-5" />} accent="neutral" trendUp={avgScore >= 75} trend={scored.length === 0 ? 'No scores yet' : avgScore >= 75 ? 'On target' : 'Below target'} />
        </div>

        {error && (
          <div className="card p-4 border-lava-600/20 bg-lava-600/5 text-sm text-lava-300 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> Could not load cohort data: {error}
          </div>
        )}
        {!loading && !error && totalStudents === 0 && (
          <div className="card p-5 flex items-center gap-4">
            <Users className="w-5 h-5 text-muted-500" />
            <p className="text-sm text-muted-400 flex-1">No student accounts yet. Students appear here after they create an account on the sign-in page.</p>
            <button onClick={() => navigate('materials')} className="btn-secondary text-xs">Set up Training Materials <ChevronRight className="w-3.5 h-3.5" /></button>
          </div>
        )}

        {/* Alerts */}
        {needsImprovement > 0 && (
          <div className="card p-4 border-amber-500/20 bg-amber-500/5 flex items-center gap-4 animate-fade-in">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-white">{needsImprovement} student{needsImprovement > 1 ? 's' : ''} requiring improvement</h3>
              <p className="text-xs text-muted-400 mt-0.5">
                These students have scores below 70% or have been inactive. Consider scheduling a coaching session.
              </p>
            </div>
            <button onClick={() => setFilter('attention')} className="btn-secondary text-xs">
              Review <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Student table */}
          <div className="lg:col-span-2">
            <SectionTitle
              title="Student Performance"
              subtitle="Individual progress across all modules"
              action={
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 p-1 rounded-lg bg-bg-surface border border-line-subtle">
                    {(['all', 'attention', 'completed'] as const).map((f) => (
                      <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-all capitalize ${
                          filter === f ? 'bg-bg-elevated text-white' : 'text-muted-400 hover:text-slate-200'
                        }`}
                      >
                        {f === 'attention' ? 'Needs Help' : f}
                      </button>
                    ))}
                  </div>
                </div>
              }
            />

            {/* Search */}
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-bg-surface border border-line-subtle mb-3">
              <Search className="w-4 h-4 text-muted-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search students by name..."
                className="bg-transparent text-sm text-slate-200 placeholder:text-muted-600 focus:outline-none flex-1"
              />
            </div>

            <div className="card divide-y divide-line-subtle">
              {filteredStudents.length === 0 && (
                <div className="p-8 text-center text-muted-500 text-sm">No students match this filter.</div>
              )}
              {filteredStudents.map((s) => (
                <div key={s.id} className="flex items-center gap-4 p-4 hover:bg-bg-hover/50 transition-colors group">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-lava-600/80 to-lava-800 flex items-center justify-center text-white text-xs font-semibold shrink-0">
                    {s.avatarInitials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-white">{s.name}</span>
                      {s.needsAttention && <Badge variant="warning"><AlertTriangle className="w-3 h-3" /> Needs Help</Badge>}
                      {s.status === 'completed' && <Badge variant="success"><Award className="w-3 h-3" /> Certified</Badge>}
                      {s.status === 'idle' && <Badge variant="default">Idle</Badge>}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-500">
                      <span>{s.cohort}</span>
                      <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> {s.modulesCompleted}/{ACORD_MODULES.length} done</span>
                      <span className="flex items-center gap-1"><Clock3 className="w-3 h-3" /> {s.lastActive}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-xs text-muted-500 mb-1">Avg Score</div>
                      <div className={`text-sm font-semibold ${s.averageScore !== null ? (s.averageScore >= 80 ? 'text-emerald-400' : s.averageScore >= 60 ? 'text-amber-400' : 'text-lava-400') : 'text-muted-600'}`}>
                        {s.averageScore !== null ? `${s.averageScore}%` : '—'}
                      </div>
                    </div>
                    <div className="w-24">
                      <div className="text-xs text-muted-500 mb-1">Progress</div>
                      <ProgressBar
                        value={Math.round(((s.modulesCompleted + s.modulesInProgress * 0.5) / ACORD_MODULES.length) * 100)}
                        color={s.status === 'completed' ? 'emerald' : s.needsAttention ? 'lava' : 'cyan'}
                        size="sm"
                      />
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-600 group-hover:text-lava-400 transition-colors" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent activity */}
          <div>
            <SectionTitle title="Recent Activity" subtitle="Latest submissions" />
            <div className="card divide-y divide-line-subtle">
              {TRAINER_ACTIVITY.length === 0 && <div className="p-6 text-center text-sm text-muted-500">{loading ? 'Loading…' : 'No submissions yet.'}</div>}
              {TRAINER_ACTIVITY.map((act) => (
                <div key={act.id} className="p-4 hover:bg-bg-hover/50 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-white truncate">{act.studentName}</span>
                    <ScoreRing score={act.score} size={36} strokeWidth={3} />
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-500">
                    <span>{act.moduleName}</span>
                    <span>·</span>
                    <span>Attempt {act.attempt}</span>
                  </div>
                  <div className="text-xs text-muted-600 mt-1">{act.timestamp}</div>
                </div>
              ))}
            </div>

            {/* Quick stats */}
            <div className="mt-4 card p-5">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-4 h-4 text-lava-400" />
                <h3 className="text-sm font-semibold text-white">Cohort Overview</h3>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-muted-400"><UserCheck className="w-4 h-4 text-emerald-400" /> Certified</span>
                  <span className="text-white font-medium">{TRAINER_STUDENTS.filter((s) => s.status === 'completed').length}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-muted-400"><GraduationCap className="w-4 h-4 text-cyan-400" /> Active</span>
                  <span className="text-white font-medium">{activeStudents}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-muted-400"><AlertTriangle className="w-4 h-4 text-amber-400" /> Need coaching</span>
                  <span className="text-white font-medium">{needsImprovement}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
