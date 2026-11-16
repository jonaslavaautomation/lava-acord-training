import { useState } from 'react';
import { AlertCircle, ArrowRight, Building2, GraduationCap, Loader2, User } from 'lucide-react';
import { BrandLockup } from '../components/BrandLockup';
import { useAuth } from '../context/AuthContext';

/** Trainees (VAs) start here: no account or password, just who they are. */
export function TraineeStart() {
  const { startTraining } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [agencyName, setAgencyName] = useState('');
  const [trainerName, setTrainerName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      await startTraining({ firstName, lastName, agencyName, trainerName });
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md animate-fade-in">
        <div className="flex flex-col items-center gap-3 mb-8">
          <BrandLockup size="lg" />
          <div className="text-[11px] text-muted-500 uppercase tracking-wider leading-tight">ACORD Training Simulator</div>
        </div>

        <form onSubmit={submit} className="card p-7 space-y-4">
          <div>
            <h1 className="text-xl font-semibold text-white tracking-tight">Welcome! Let's get you started</h1>
            <p className="text-sm text-muted-400 mt-1">Tell us who you are. No account or password needed.</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field icon={<User className="w-4 h-4" />} label="First name">
              <input value={firstName} onChange={(e) => setFirstName(e.target.value)} required maxLength={60} className="input pl-9" placeholder="Maria" autoComplete="given-name" />
            </Field>
            <Field icon={<User className="w-4 h-4" />} label="Last name">
              <input value={lastName} onChange={(e) => setLastName(e.target.value)} required maxLength={60} className="input pl-9" placeholder="Santos" autoComplete="family-name" />
            </Field>
          </div>
          <Field icon={<Building2 className="w-4 h-4" />} label="Insurance agency">
            <input value={agencyName} onChange={(e) => setAgencyName(e.target.value)} required maxLength={120} className="input pl-9" placeholder="Agency you are connected with" autoComplete="organization" />
          </Field>
          <Field icon={<GraduationCap className="w-4 h-4" />} label="Trainer">
            <input value={trainerName} onChange={(e) => setTrainerName(e.target.value)} required maxLength={120} className="input pl-9" placeholder="Name of your trainer" />
          </Field>

          {error && <div className="flex items-start gap-2 p-3 rounded-lg bg-lava-600/10 border border-lava-600/20 text-xs text-lava-300"><AlertCircle className="w-4 h-4 shrink-0" /> {error}</div>}

          <button type="submit" disabled={busy || !firstName.trim() || !lastName.trim() || !agencyName.trim() || !trainerName.trim()} className="btn-primary w-full py-3">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
            Start training
          </button>

          <p className="text-[11px] text-muted-500 leading-relaxed">
            Your progress is saved on this browser. Use the same computer and browser each time you come back, and don't clear its browsing data.
          </p>
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
