import {
  LayoutDashboard,
  GraduationCap,
  ClipboardList,
  TrendingUp,
  History,
  Settings,
  ChevronRight,
  Users,
  FolderUp,
  LogOut,
  UserCog,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useApp } from '../AppContext';
import { BrandLockup } from './BrandLockup';
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

/** The Topbar's menu button (small screens) opens the sidebar by sending this event. */
export const OPEN_NAV_EVENT = 'lava:open-nav';

export function Sidebar() {
  const { view, navigate: go, mode, setMode, student } = useApp();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const show = () => setOpen(true);
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener(OPEN_NAV_EVENT, show);
    window.addEventListener('keydown', esc);
    return () => { window.removeEventListener(OPEN_NAV_EVENT, show); window.removeEventListener('keydown', esc); };
  }, []);
  // On small screens the menu closes after choosing a page.
  const navigate = (v: View) => { setOpen(false); go(v); };
  const { isStaff, isTrainee, signOut } = useAuth();
  const exit = () => {
    if (isTrainee && !confirm('Exit training?\n\nYou have no password, so after exiting you will start over as a new trainee. To keep your progress, just close the tab instead and come back on this same browser.')) return;
    signOut();
  };
  const nav = mode === 'trainer' ? trainerNav : studentNav;
  const isActive = (id: View) => view === id || (id === 'training' && (view === 'module' || view === 'assessment' || view === 'results'));

  return (
    <>
    {open && <div className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setOpen(false)} aria-hidden="true" />}
    <aside
      className={`w-64 shrink-0 h-screen flex flex-col border-r border-line-subtle
        fixed inset-y-0 left-0 z-50 bg-bg-surface transition-transform duration-200 ease-out
        lg:sticky lg:top-0 lg:z-auto lg:translate-x-0 lg:bg-bg-surface/50 lg:backdrop-blur-xl
        ${open ? 'translate-x-0 shadow-elevated' : '-translate-x-full'}`}
      aria-label="Main menu"
    >
      <div className="px-5 py-5 border-b border-line-subtle flex items-start justify-between gap-2">
        <div>
          <BrandLockup size="sm" />
          <div className="text-[10px] text-muted-500 uppercase tracking-wider leading-tight mt-2.5">ACORD Training Simulator</div>
        </div>
        <button onClick={() => setOpen(false)} className="lg:hidden -mr-2 p-2 rounded-lg text-muted-400 hover:text-white hover:bg-bg-hover" aria-label="Close menu">
          <X className="w-5 h-5" />
        </button>
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
              className={`nav-item w-full relative ${active ? 'nav-item-active' : ''}`}
              aria-current={active ? 'page' : undefined}
            >
              {active && <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full bg-lava-500" />}
              <Icon className={`w-[18px] h-[18px] ${active ? 'text-lava-400' : ''}`} strokeWidth={2} />
              <span className="flex-1 text-left">{entry.label}</span>
              {active && <ChevronRight className="w-4 h-4 text-muted-500" />}
            </button>
          );
        })}

        {mode === 'student' && isStaff && (
          <div className="pt-4">
            <button
              onClick={() => { setOpen(false); setMode('trainer'); }}
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
              onClick={() => { setOpen(false); setMode('student'); }}
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
        <button onClick={exit} className="nav-item w-full text-muted-500">
          <LogOut className="w-[18px] h-[18px]" strokeWidth={2} />
          <span className="flex-1 text-left">{isTrainee ? 'Exit training' : 'Sign out'}</span>
        </button>
      </div>
    </aside>
    </>
  );
}
