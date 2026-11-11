import {
  LayoutDashboard,
  GraduationCap,
  ClipboardList,
  TrendingUp,
  History,
  Settings,
  Flame,
  ChevronRight,
  Users,
  FolderUp,
  LogOut,
  UserCog,
} from 'lucide-react';
import { useApp } from '../AppContext';
import { useAuth } from '../context/AuthContext';
import type { View } from '../types';

interface NavEntry {
  id: View;
  label: string;
  icon: typeof LayoutDashboard;
}

const studentNav: NavEntry[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'training', label: 'ACORD Training', icon: GraduationCap },
  { id: 'my-assessments', label: 'My Assessments', icon: ClipboardList },
  { id: 'progress', label: 'My Progress', icon: TrendingUp },
  { id: 'history', label: 'Training History', icon: History },
  { id: 'settings', label: 'Settings', icon: Settings },
];

const trainerNav: NavEntry[] = [
  { id: 'trainer', label: 'Trainer Dashboard', icon: LayoutDashboard },
  { id: 'materials', label: 'Training Materials', icon: FolderUp },
  { id: 'users', label: 'Users & Roles', icon: UserCog },
  { id: 'training', label: 'ACORD Training', icon: GraduationCap },
];

export function Sidebar() {
  const { view, navigate, mode, setMode, student } = useApp();
  const { isStaff, signOut } = useAuth();
  const nav = mode === 'trainer' ? trainerNav : studentNav;
  const isActive = (id: View) => view === id || (id === 'training' && (view === 'module' || view === 'assessment' || view === 'results'));

  return (
    <aside className="w-64 shrink-0 h-screen sticky top-0 border-r border-line-subtle bg-bg-surface/50 backdrop-blur-xl flex flex-col">
      <div className="px-5 py-5 border-b border-line-subtle">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-lava-600 flex items-center justify-center shadow-glow">
            <Flame className="w-5 h-5 text-white" strokeWidth={2.5} />
          </div>
          <div>
            <div className="text-sm font-semibold text-white tracking-tight leading-tight">LAVA</div>
            <div className="text-[10px] text-muted-500 uppercase tracking-wider leading-tight">ACORD Training</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <div className="px-3 py-2 text-[10px] font-semibold text-muted-600 uppercase tracking-wider">
          {mode === 'trainer' ? 'Trainer' : 'Trainee'}
        </div>
        {nav.map((entry) => {
          const Icon = entry.icon;
          const active = isActive(entry.id);
          return (
            <button
              key={entry.id}
              onClick={() => navigate(entry.id)}
              className={`nav-item w-full ${active ? 'nav-item-active' : ''}`}
            >
              <Icon className={`w-[18px] h-[18px] ${active ? 'text-lava-400' : ''}`} strokeWidth={2} />
              <span className="flex-1 text-left">{entry.label}</span>
              {active && <ChevronRight className="w-4 h-4 text-muted-500" />}
            </button>
          );
        })}

        {mode === 'student' && isStaff && (
          <div className="pt-4">
            <button
              onClick={() => setMode('trainer')}
              className="nav-item w-full text-cyan-400/80 hover:text-cyan-400"
            >
              <Users className="w-[18px] h-[18px]" strokeWidth={2} />
              <span className="flex-1 text-left">Trainer View</span>
            </button>
          </div>
        )}
        {mode === 'trainer' && (
          <div className="pt-4">
            <button
              onClick={() => setMode('student')}
              className="nav-item w-full text-muted-400"
            >
              <LayoutDashboard className="w-[18px] h-[18px]" strokeWidth={2} />
              <span className="flex-1 text-left">Back to Trainee</span>
            </button>
          </div>
        )}
      </nav>

      <div className="px-3 py-4 border-t border-line-subtle space-y-1">
        <button
          onClick={() => navigate('settings')}
          className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-bg-hover transition-colors group"
        >
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-lava-600 to-lava-800 flex items-center justify-center text-white text-xs font-semibold shrink-0">
            {student.avatarInitials}
          </div>
          <div className="flex-1 min-w-0 text-left">
            <div className="text-sm font-medium text-white truncate">{student.name}</div>
            <div className="text-xs text-muted-500 truncate">{student.role}</div>
          </div>
        </button>
        <button onClick={signOut} className="nav-item w-full text-muted-500">
          <LogOut className="w-[18px] h-[18px]" strokeWidth={2} />
          <span className="flex-1 text-left">Sign out</span>
        </button>
      </div>
    </aside>
  );
}
