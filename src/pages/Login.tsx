import { useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, Lock, Mail } from 'lucide-react';
import { BrandLockup } from '../components/BrandLockup';
import { useAuth } from '../context/AuthContext';

type Mode = 'signin' | 'reset';

/** Administrator / trainer sign-in. Only reachable at /admin; trainees use the start screen. */
export function Login() {
  const { signIn, sendPasswordReset } = useAuth();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null); setInfo(null);
    try {
      if (mode === 'signin') {
        await signIn(email.trim(), password);
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
        <div className="flex flex-col items-center gap-3 mb-8">
          <BrandLockup size="lg" />
          <div className="text-[11px] text-muted-500 uppercase tracking-wider leading-tight">ACORD Training Simulator</div>
        </div>

        <form onSubmit={submit} className="card p-7 space-y-4">
          <div>
            <h1 className="text-xl font-semibold text-white tracking-tight">
              {mode === 'signin' ? 'Administrator sign in' : 'Reset your password'}
            </h1>
            <p className="text-sm text-muted-400 mt-1">For administrators and trainers only.</p>
          </div>

          <Field icon={<Mail className="w-4 h-4" />} label="Email">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="input pl-9" placeholder="you@agency.com" autoComplete="email" />
          </Field>
          {mode === 'signin' && (
            <Field icon={<Lock className="w-4 h-4" />} label="Password">
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="input pl-9" placeholder="••••••••" autoComplete="current-password" />
            </Field>
          )}

          {error && <div className="flex items-start gap-2 p-3 rounded-lg bg-lava-600/10 border border-lava-600/20 text-xs text-lava-300"><AlertCircle className="w-4 h-4 shrink-0" /> {error}</div>}
          {info && <div className="flex items-start gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300"><CheckCircle2 className="w-4 h-4 shrink-0" /> {info}</div>}

          <button type="submit" disabled={busy} className="btn-primary w-full py-3">
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            {mode === 'signin' ? 'Sign in' : 'Send reset link'}
          </button>

          <div className="flex items-center justify-end text-xs pt-1">
            {mode === 'signin' ? (
              <button type="button" onClick={() => { setMode('reset'); setError(null); }} className="text-muted-400 hover:text-white">Forgot password?</button>
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
