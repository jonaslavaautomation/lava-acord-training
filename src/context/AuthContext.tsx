import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/types';

interface AuthState {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  isStaff: boolean;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  /** True for trainees who started with their name only (Supabase anonymous session). */
  isTrainee: boolean;
  startTraining: (details: TraineeDetails) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

export interface TraineeDetails {
  firstName: string;
  lastName: string;
  agencyName: string;
  trainerName: string;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (uid: string | undefined) => {
    if (!uid) { setProfile(null); return; }
    // The profile row is created by a database trigger on sign-up; retry briefly in case it lags.
    for (let i = 0; i < 4; i++) {
      const { data } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle();
      if (data) { setProfile(data as Profile); return; }
      await new Promise((r) => setTimeout(r, 400));
    }
    setProfile(null);
  }, []);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      await loadProfile(data.session?.user.id);
      if (active) setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      // Defer DB calls out of the auth callback (supabase-js recommendation).
      setTimeout(() => { loadProfile(s?.user.id); }, 0);
    });
    return () => { active = false; sub.subscription.unsubscribe(); };
  }, [loadProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
  }, []);

  const startTraining = useCallback(async (d: TraineeDetails) => {
    const clean = (v: string) => v.trim().replace(/\s+/g, ' ');
    const { error } = await supabase.auth.signInAnonymously({
      options: {
        data: {
          first_name: clean(d.firstName), last_name: clean(d.lastName),
          agency_name: clean(d.agencyName), trainer_name: clean(d.trainerName),
          full_name: `${clean(d.firstName)} ${clean(d.lastName)}`,
        },
      },
    });
    if (error) {
      if (/anonymous/i.test(error.message)) {
        throw new Error('Trainee access is not switched on yet. Please ask your administrator to enable anonymous sign-ins in Supabase.');
      }
      throw new Error(error.message);
    }
  }, []);

  const sendPasswordReset = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
    if (error) throw new Error(error.message);
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
  }, []);

  const refreshProfile = useCallback(() => loadProfile(session?.user.id), [loadProfile, session?.user.id]);

  const isStaff = profile?.role === 'trainer' || profile?.role === 'admin';
  const isAdmin = profile?.role === 'admin';
  const isTrainee = !!session?.user.is_anonymous;

  return (
    <AuthContext.Provider value={{ session, profile, loading, isStaff, isAdmin, isTrainee, signIn, startTraining, sendPasswordReset, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
