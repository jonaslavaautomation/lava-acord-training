import { Menu, Trophy } from 'lucide-react';
import { useApp } from '../AppContext';
import { ACORD_MODULES } from '../data/modules';
import { modulePassed } from '../lib/assessmentService';
import { OPEN_NAV_EVENT } from './Sidebar';

interface TopbarProps {
  title: string;
  subtitle?: string;
}

export function Topbar({ title, subtitle }: TopbarProps) {
  const { student, mode } = useApp();
  const passed = Object.values(student.progress).filter(modulePassed).length;
  const total = ACORD_MODULES.length;
  return (
    <header className="sticky top-0 z-20 border-b border-line-subtle bg-bg-base/85 backdrop-blur-xl">
      <div className="flex items-center gap-3 px-4 sm:px-6 lg:px-8 py-3.5 sm:py-4">
        <button
          onClick={() => window.dispatchEvent(new Event(OPEN_NAV_EVENT))}
          className="lg:hidden -ml-1 p-2 rounded-lg text-muted-400 hover:text-white hover:bg-bg-hover"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg sm:text-xl font-semibold text-white tracking-tight truncate">{title}</h1>
          {subtitle && <p className="text-xs sm:text-sm text-muted-400 mt-0.5 truncate">{subtitle}</p>}
        </div>
        {mode === 'student' && (
          <div
            className="hidden sm:flex items-center gap-2.5 pl-2.5 pr-3 py-1.5 rounded-full bg-bg-surface border border-line-subtle shrink-0"
            title={`${passed} of ${total} courses passed`}
          >
            <Trophy className={`w-4 h-4 ${passed === total ? 'text-amber-400' : 'text-emerald-400'}`} />
            <div className="w-20 h-1.5 bg-bg-base rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full transition-all duration-700" style={{ width: `${(passed / total) * 100}%` }} />
            </div>
            <span className="text-xs text-slate-300 tabular-nums font-medium">{passed}/{total} passed</span>
          </div>
        )}
      </div>
    </header>
  );
}
