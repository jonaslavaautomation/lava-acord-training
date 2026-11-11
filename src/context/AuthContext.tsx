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
  signUp: (email: string, password: string, fullName: string) => Promise<{ needsConfirmation: boolean }>;
  sendPasswordReset: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
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

  const signUp = useCallback(async (email: string, password: string, fullName: string) => {
    const { data, error } = await supabase.auth.signUp({
      email, password, options: { data: { full_name: fullName }, emailRedirectTo: window.location.origin },
    });
    if (error) throw new Error(error.message);
    return { needsConfirmation: !data.session };
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

  return (
    <AuthContext.Provider value={{ session, profile, loading, isStaff, isAdmin, signIn, signUp, sendPasswordReset, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
