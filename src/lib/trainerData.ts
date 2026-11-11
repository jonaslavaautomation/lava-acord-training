import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
import { MAX_ATTEMPTS, PASS_SCORE } from './assessmentService';
import type { AcordId, AttemptRow, Profile, TrainerActivity, TrainerStudent } from '@/types';

const MODULES: AcordId[] = ['125', '126', '127', '130', '140'];

export function relativeTime(iso: string | null): string {
  if (!iso) return 'Never';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hour${h > 1 ? 's' : ''} ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d} day${d > 1 ? 's' : ''} ago`;
  const w = Math.round(d / 7);
  return `${w} week${w > 1 ? 's' : ''} ago`;
}

export interface TrainerData {
  students: TrainerStudent[];
  activity: TrainerActivity[];
  profiles: Profile[];
  attempts: AttemptRow[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

/** Real cohort data for trainers/admins (RLS lets staff read all profiles, progress and attempts). */
export function useTrainerData(): TrainerData {
  const [state, setState] = useState<Omit<TrainerData, 'reload'>>({ students: [], activity: [], profiles: [], attempts: [], loading: true, error: null });

  const reload = useCallback(async () => {
    try {
      const [p, a, v] = await Promise.all([
        supabase.from('profiles').select('*').order('full_name'),
        supabase.from('assessment_attempts').select('id,user_id,module_id,attempt_number,status,score,submitted_at,started_at,student_name,passed').not('user_id', 'is', null),
        supabase.from('video_progress').select('user_id,module_id,completed,last_heartbeat_at'),
      ]);
      if (p.error) throw p.error;
      if (a.error) throw a.error;
      if (v.error) throw v.error;
      const profiles = (p.data ?? []) as Profile[];
      const attempts = (a.data ?? []) as AttemptRow[];
      const videos = (v.data ?? []) as { user_id: string; module_id: AcordId; completed: boolean; last_heartbeat_at: string | null }[];
      const names = new Map(profiles.map((x) => [x.id, x.full_name || x.email || 'Trainee']));

      const students: TrainerStudent[] = profiles.filter((x) => x.role === 'student').map((s) => {
        const mine = attempts.filter((x) => x.user_id === s.id && x.status === 'submitted');
        const vids = videos.filter((x) => x.user_id === s.id);
        let completed = 0; let inProgress = 0; const bests: number[] = [];
        for (const mod of MODULES) {
          const ma = mine.filter((x) => x.module_id === mod);
          const best = ma.length ? Math.max(...ma.map((x) => x.score)) : null;
          if (best !== null) bests.push(best);
          if ((best !== null && best >= PASS_SCORE) || ma.length >= MAX_ATTEMPTS) completed++;
          else if (ma.length > 0 || vids.some((x) => x.module_id === mod) || attempts.some((x) => x.user_id === s.id && x.module_id === mod)) inProgress++;
        }
        const times = [...mine.map((x) => x.submitted_at), ...vids.map((x) => x.last_heartbeat_at), ...attempts.filter((x) => x.user_id === s.id).map((x) => x.started_at)].filter(Boolean) as string[];
        const last = times.sort()[times.length - 1] ?? null;
        const idle = !last || Date.now() - new Date(last).getTime() > 3 * 86400000;
        const avg = bests.length ? Math.round(bests.reduce((x, y) => x + y, 0) / bests.length) : null;
        const name = s.full_name || s.email || 'Trainee';
        return {
          id: s.id,
          name,
          avatarInitials: name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join(''),
          cohort: s.cohort ?? '—',
          modulesCompleted: completed,
          modulesInProgress: inProgress,
          averageScore: avg,
          lastActive: relativeTime(last),
          status: completed === MODULES.length ? 'completed' : idle ? 'idle' : 'active',
          needsAttention: (avg !== null && avg < 70) || (idle && inProgress > 0),
        };
      });

      const activity: TrainerActivity[] = attempts
        .filter((x) => x.status === 'submitted' && x.submitted_at)
        .sort((x, y) => (y.submitted_at ?? '').localeCompare(x.submitted_at ?? ''))
        .slice(0, 10)
        .map((x) => ({ id: x.id, studentName: names.get(x.user_id) ?? x.student_name, moduleName: `ACORD ${x.module_id}`, score: x.score, attempt: x.attempt_number, timestamp: relativeTime(x.submitted_at) }));

      setState({ students, activity, profiles, attempts, loading: false, error: null });
    } catch (err) {
      setState((s) => ({ ...s, loading: false, error: (err as Error).message }));
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);
  return { ...state, reload };
}
