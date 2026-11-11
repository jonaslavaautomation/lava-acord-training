import { User, Mail, Calendar, Users, Clock, Bell, Globe, Shield, ChevronRight } from 'lucide-react';
import { useApp } from '../AppContext';
import { Topbar } from '../components/Topbar';
import { Badge } from '../components/ui';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

export function Settings() {
  const { student } = useApp();
  const { profile, refreshProfile } = useAuth();
  const [name, setName] = useState(profile?.full_name ?? '');
  const [saved, setSaved] = useState(false);
  const saveName = async () => {
    const { error } = await supabase.rpc('update_my_profile', { p_full_name: name });
    if (!error) { await refreshProfile(); setSaved(true); setTimeout(() => setSaved(false), 2000); }
  };
  const [notifications, setNotifications] = useState({ email: true, reminders: true, results: true, weekly: false });
  const [theme, setTheme] = useState('dark');

  return (
    <div>
      <Topbar title="Settings" subtitle="Manage your profile and training preferences" />
      <div className="px-8 py-6 space-y-6 max-w-[900px]">
        {/* Profile */}
        <div className="card p-6 animate-fade-in">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-lava-600 to-lava-800 flex items-center justify-center text-white text-xl font-semibold">
              {student.avatarInitials}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">{student.name}</h2>
              <p className="text-sm text-muted-400">{student.role}</p>
              <Badge variant="lava"><Users className="w-3 h-3" /> {student.cohort}</Badge>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="p-3 rounded-lg bg-bg-base border border-line-subtle">
              <div className="flex items-center gap-2 text-xs text-muted-500 mb-1"><User className="w-4 h-4" /> Full Name</div>
              <div className="flex items-center gap-2">
                <input value={name} onChange={(e) => setName(e.target.value)} className="input text-sm py-1.5" />
                <button onClick={saveName} disabled={!name.trim() || name === profile?.full_name} className="btn-secondary text-xs py-1.5">{saved ? 'Saved' : 'Save'}</button>
              </div>
            </div>
            <SettingField icon={<Mail className="w-4 h-4" />} label="Email" value={student.email} />
            <SettingField icon={<Calendar className="w-4 h-4" />} label="Joined" value={student.joinedDate} />
            <SettingField icon={<Clock className="w-4 h-4" />} label="Training Hours" value={`${student.totalTrainingHours}h`} />
          </div>
        </div>

        {/* Notifications */}
        <div className="card p-6">
          <div className="flex items-center gap-2 mb-5">
            <Bell className="w-4 h-4 text-lava-400" />
            <h3 className="text-sm font-semibold text-white">Notifications</h3>
          </div>
          <div className="space-y-4">
            <ToggleRow
              label="Email notifications"
              description="Receive assessment results and updates via email"
              value={notifications.email}
              onChange={(v) => setNotifications((n) => ({ ...n, email: v }))}
            />
            <ToggleRow
              label="Training reminders"
              description="Get reminded about pending modules and expiring attempts"
              value={notifications.reminders}
              onChange={(v) => setNotifications((n) => ({ ...n, reminders: v }))}
            />
            <ToggleRow
              label="Results notifications"
              description="Notify me immediately when an assessment is graded"
              value={notifications.results}
              onChange={(v) => setNotifications((n) => ({ ...n, results: v }))}
            />
            <ToggleRow
              label="Weekly progress summary"
              description="A digest of your training progress every Monday"
              value={notifications.weekly}
              onChange={(v) => setNotifications((n) => ({ ...n, weekly: v }))}
            />
          </div>
        </div>

        {/* Appearance */}
        <div className="card p-6">
          <div className="flex items-center gap-2 mb-5">
            <Globe className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-semibold text-white">Appearance</h3>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-bg-base border border-line-subtle">
              <div>
                <div className="text-sm font-medium text-white">Theme</div>
                <div className="text-xs text-muted-400 mt-0.5">The platform is optimized for dark mode</div>
              </div>
              <div className="flex items-center gap-1 p-1 rounded-lg bg-bg-elevated border border-line-subtle">
                <button
                  onClick={() => setTheme('dark')}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${theme === 'dark' ? 'bg-lava-600 text-white' : 'text-muted-400'}`}
                >
                  Dark
                </button>
                <button
                  onClick={() => setTheme('light')}
                  disabled
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all opacity-40 cursor-not-allowed ${theme === 'light' ? 'bg-lava-600 text-white' : 'text-muted-400'}`}
                >
                  Light
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Security */}
        <div className="card p-6">
          <div className="flex items-center gap-2 mb-5">
            <Shield className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-semibold text-white">Security</h3>
          </div>
          <div className="space-y-2">
            <SettingsLink label="Change Password" detail="Last changed 30 days ago" />
            <SettingsLink label="Two-Factor Authentication" detail="Not enabled" />
            <SettingsLink label="Active Sessions" detail="1 device connected" />
            <SettingsLink label="Data & Privacy" detail="Manage your training data" />
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingField({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="p-3 rounded-lg bg-bg-base border border-line-subtle">
      <div className="flex items-center gap-2 text-xs text-muted-500 mb-1">
        {icon} {label}
      </div>
      <div className="text-sm text-slate-200">{value}</div>
    </div>
  );
}

function ToggleRow({ label, description, value, onChange }: { label: string; description: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-bg-base border border-line-subtle">
      <div>
        <div className="text-sm font-medium text-white">{label}</div>
        <div className="text-xs text-muted-400 mt-0.5">{description}</div>
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${value ? 'bg-lava-600' : 'bg-line-strong'}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${value ? 'translate-x-5' : ''}`} />
      </button>
    </div>
  );
}

function SettingsLink({ label, detail }: { label: string; detail: string }) {
  return (
    <button className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-bg-hover/50 transition-colors text-left">
      <div>
        <div className="text-sm font-medium text-white">{label}</div>
        <div className="text-xs text-muted-500 mt-0.5">{detail}</div>
      </div>
      <ChevronRight className="w-4 h-4 text-muted-600" />
    </button>
  );
}
