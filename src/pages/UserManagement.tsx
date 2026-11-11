import { useState } from 'react';
import { AlertCircle, Loader2, RotateCcw, Search, Shield, Users } from 'lucide-react';
import { Topbar } from '../components/Topbar';
import { Badge } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useTrainerData } from '../lib/trainerData';
import { supabase } from '../lib/supabase';
import { friendlyError, MAX_ATTEMPTS } from '../lib/assessmentService';
import { ACORD_MODULES } from '../data/modules';
import type { AcordId, AppRole } from '../types';

export function UserManagement() {
  const { isAdmin, profile: me, refreshProfile } = useAuth();
  const { profiles, attempts, loading, error, reload } = useTrainerData();
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const run = async (key: string, fn: () => Promise<{ error: { message: string } | null }>) => {
    setBusy(key); setMessage(null);
    const { error: e } = await fn();
    if (e) setMessage(friendlyError(e));
    await reload();
    setBusy(null);
  };

  const setRole = (id: string, role: AppRole) => run(`role-${id}`, async () => {
    const r = await supabase.rpc('admin_set_role', { p_user_id: id, p_role: role });
    if (id === me?.id) await refreshProfile();
    return r;
  });
  const setCohort = (id: string, cohort: string) => run(`cohort-${id}`, async () => supabase.rpc('admin_set_cohort', { p_user_id: id, p_cohort: cohort }));
  const reset = (id: string, name: string, moduleId: AcordId) => {
    if (!confirm(`Reset all ACORD ${moduleId} attempts for ${name}? Their previous results for this module will be deleted.`)) return;
    run(`reset-${id}-${moduleId}`, async () => supabase.rpc('staff_reset_attempts', { p_user_id: id, p_module_id: moduleId }));
  };

  const shown = profiles.filter((p) => !query || `${p.full_name} ${p.email}`.toLowerCase().includes(query.toLowerCase()));

  return (
    <div>
      <Topbar title="Users & Roles" subtitle="Manage student, trainer and administrator accounts" />
      <div className="px-8 py-6 space-y-5 max-w-[1200px]">
        <div className="card p-4 flex items-start gap-3 border-cyan-500/15 bg-cyan-500/5">
          <Shield className="w-5 h-5 text-cyan-400 mt-0.5 shrink-0" />
          <p className="text-xs text-muted-400 leading-relaxed">
            Roles are enforced by the database. <span className="text-slate-200">Students</span> can view training materials and take assessments;
            <span className="text-slate-200"> Trainers</span> can upload materials, configure answer keys, view all results and reset attempts;
            <span className="text-slate-200"> Administrators</span> can also change roles. {isAdmin ? '' : 'Only administrators can change roles.'}
          </p>
        </div>

        {(error || message) && (
          <div className="card p-3 border-lava-600/20 bg-lava-600/5 text-xs text-lava-300 flex items-center gap-2"><AlertCircle className="w-4 h-4" /> {error || message}</div>
        )}

        <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-bg-surface border border-line-subtle">
          <Search className="w-4 h-4 text-muted-500" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name or email..." className="bg-transparent text-sm text-slate-200 placeholder:text-muted-600 focus:outline-none flex-1" />
        </div>

        <div className="card divide-y divide-line-subtle">
          {loading && <div className="p-6 flex items-center gap-2 text-sm text-muted-400"><Loader2 className="w-4 h-4 animate-spin" /> Loading accounts…</div>}
          {!loading && shown.length === 0 && <div className="p-6 text-center text-sm text-muted-500"><Users className="w-5 h-5 mx-auto mb-2" />No accounts found.</div>}
          {shown.map((p) => {
            const name = p.full_name || p.email || 'User';
            return (
              <div key={p.id} className="p-4 space-y-3">
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-lava-600/80 to-lava-800 flex items-center justify-center text-white text-xs font-semibold shrink-0">
                    {name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('')}
                  </div>
                  <div className="flex-1 min-w-[200px]">
                    <div className="text-sm font-medium text-white">{name} {p.id === me?.id && <span className="text-xs text-muted-500">(you)</span>}</div>
                    <div className="text-xs text-muted-500">{p.email} · joined {new Date(p.created_at).toLocaleDateString()}</div>
                  </div>
                  <input defaultValue={p.cohort ?? ''} placeholder="Cohort, e.g. 2026-Q4" onBlur={(e) => e.target.value !== (p.cohort ?? '') && setCohort(p.id, e.target.value)}
                    className="input text-xs py-1.5 w-40" />
                  {isAdmin ? (
                    <select value={p.role} disabled={busy === `role-${p.id}`} onChange={(e) => setRole(p.id, e.target.value as AppRole)} className="input text-xs py-1.5 w-32 cursor-pointer">
                      <option value="student">Student</option>
                      <option value="trainer">Trainer</option>
                      <option value="admin">Administrator</option>
                    </select>
                  ) : (
                    <Badge variant={p.role === 'student' ? 'default' : 'lava'}>{p.role}</Badge>
                  )}
                </div>
                {p.role === 'student' && (
                  <div className="flex items-center gap-2 flex-wrap pl-[52px]">
                    {ACORD_MODULES.map((m) => {
                      const used = attempts.filter((a) => a.user_id === p.id && a.module_id === m.id && a.status === 'submitted');
                      const best = used.length ? Math.max(...used.map((a) => a.score)) : null;
                      const any = attempts.some((a) => a.user_id === p.id && a.module_id === m.id);
                      return (
                        <div key={m.id} className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-bg-base border border-line-subtle text-[11px]">
                          <span className="text-slate-300">{m.id}</span>
                          <span className="text-muted-500">{used.length}/{MAX_ATTEMPTS}</span>
                          {best !== null && <span className={best >= 80 ? 'text-emerald-400' : 'text-amber-400'}>{best}%</span>}
                          {any && (
                            <button onClick={() => reset(p.id, name, m.id)} disabled={busy !== null} title="Reset attempts for this module" className="text-muted-500 hover:text-lava-400">
                              {busy === `reset-${p.id}-${m.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
