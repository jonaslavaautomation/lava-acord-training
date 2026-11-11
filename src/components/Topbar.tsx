import { Search, Bell, Clock } from 'lucide-react';
import { useApp } from '../AppContext';

interface TopbarProps {
  title: string;
  subtitle?: string;
}

export function Topbar({ title, subtitle }: TopbarProps) {
  const { student } = useApp();
  return (
    <header className="sticky top-0 z-20 border-b border-line-subtle bg-bg-base/80 backdrop-blur-xl">
      <div className="flex items-center justify-between px-8 py-4">
        <div>
          <h1 className="text-xl font-semibold text-white tracking-tight">{title}</h1>
          {subtitle && <p className="text-sm text-muted-400 mt-0.5">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2 px-3 py-2 rounded-lg bg-bg-surface border border-line-subtle w-72">
            <Search className="w-4 h-4 text-muted-500" />
            <input
              type="text"
              placeholder="Search modules, assessments..."
              className="bg-transparent text-sm text-slate-200 placeholder:text-muted-600 focus:outline-none flex-1"
            />
            <kbd className="text-[10px] text-muted-600 bg-bg-base px-1.5 py-0.5 rounded border border-line-subtle">⌘K</kbd>
          </div>
          <button className="relative w-10 h-10 rounded-lg bg-bg-surface border border-line-subtle flex items-center justify-center hover:border-line-strong transition-colors">
            <Bell className="w-[18px] h-[18px] text-muted-400" />
            <span className="absolute top-2 right-2.5 w-2 h-2 rounded-full bg-lava-600" />
          </button>
          <div className="hidden lg:flex items-center gap-2 px-3 py-2 rounded-lg bg-bg-surface border border-line-subtle">
            <Clock className="w-4 h-4 text-cyan-400" />
            <span className="text-xs text-muted-400">{student.totalTrainingHours}h trained</span>
          </div>
        </div>
      </div>
    </header>
  );
}
