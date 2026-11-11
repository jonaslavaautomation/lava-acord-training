import { useState } from 'react';
import { AlertCircle, CheckCircle2, Flame, Loader2, Lock, Mail, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

type Mode = 'signin' | 'signup' | 'reset';

export function Login() {
  const { signIn, signUp, sendPasswordReset } = useAuth();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null); setInfo(null);
    try {
      if (mode === 'signin') {
        await signIn(email.trim(), password);
      } else if (mode === 'signup') {
        if (password.length < 8) throw new Error('Use at least 8 characters for your password.');
        const { needsConfirmation } = await signUp(email.trim(), password, fullName.trim());
        if (needsConfirmation) {
          setInfo('Check your email to confirm your account, then sign in.');
          setMode('signin');
        }
      } else {
        await sendPasswordReset(email.trim());
        setInfo('If an account exists for that email, a password reset link has been sent.');
        setMode('signin');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md animate-fade-in">
        <div className="flex items-center gap-3 justify-center mb-8">
          <div className="w-11 h-11 rounded-xl bg-lava-600 flex items-center justify-center shadow-glow">
            <Flame className="w-6 h-6 text-white" strokeWidth={2.5} />
          </div>
          <div>
            <div className="text-lg font-semibold text-white tracking-tight leading-tight">LAVA</div>
            <div className="text-[11px] text-muted-500 uppercase tracking-wider leading-tight">ACORD Training Simulator</div>
          </div>
        </div>

        <form onSubmit={submit} className="card p-7 space-y-4">
          <div>
            <h1 className="text-xl font-semibold text-white tracking-tight">
              {mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create your account' : 'Reset your password'}
            </h1>
            <p className="text-sm text-muted-400 mt-1">
              {mode === 'signup' ? 'New accounts start as trainees. An administrator can grant trainer access.' : 'Students, trainers and administrators sign in here.'}
            </p>
          </div>

          {mode === 'signup' && (
            <Field icon={<User className="w-4 h-4" />} label="Full name">
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} required className="input pl-9" placeholder="Alex Rivera" autoComplete="name" />
            </Field>
          )}
          <Field icon={<Mail className="w-4 h-4" />} label="Email">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="input pl-9" placeholder="you@agency.com" autoComplete="email" />
          </Field>
          {mode !== 'reset' && (
            <Field icon={<Lock className="w-4 h-4" />} label="Password">
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="input pl-9" placeholder="••••••••"
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} minLength={mode === 'signup' ? 8 : undefined} />
            </Field>
          )}

          {error && <div className="flex items-start gap-2 p-3 rounded-lg bg-lava-600/10 border border-lava-600/20 text-xs text-lava-300"><AlertCircle className="w-4 h-4 shrink-0" /> {error}</div>}
          {info && <div className="flex items-start gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300"><CheckCircle2 className="w-4 h-4 shrink-0" /> {info}</div>}

          <button type="submit" disabled={busy} className="btn-primary w-full py-3">
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            {mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Send reset link'}
          </button>

          <div className="flex items-center justify-between text-xs pt-1">
            {mode === 'signin' ? (
              <>
                <button type="button" onClick={() => { setMode('signup'); setError(null); }} className="text-lava-400 hover:text-lava-300">Create an account</button>
                <button type="button" onClick={() => { setMode('reset'); setError(null); }} className="text-muted-400 hover:text-white">Forgot password?</button>
              </>
            ) : (
              <button type="button" onClick={() => { setMode('signin'); setError(null); }} className="text-muted-400 hover:text-white">← Back to sign in</button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <div className="relative mt-1.5">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-500">{icon}</span>
        {children}
      </div>
    </label>
  );
}
