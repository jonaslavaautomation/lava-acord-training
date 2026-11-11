import type { ReactNode } from 'react';

interface ProgressBarProps {
  value: number;
  max?: number;
  className?: string;
  color?: 'lava' | 'emerald' | 'cyan';
  size?: 'sm' | 'md';
}

export function ProgressBar({ value, max = 100, className = '', color = 'lava', size = 'md' }: ProgressBarProps) {
  const pct = Math.min(100, (value / max) * 100);
  const colorMap = {
    lava: 'bg-lava-600',
    emerald: 'bg-emerald-500',
    cyan: 'bg-cyan-500',
  };
  return (
    <div className={`${size === 'sm' ? 'h-1' : 'h-1.5'} w-full bg-bg-base rounded-full overflow-hidden ${className}`}>
      <div
        className={`h-full ${colorMap[color]} rounded-full transition-all duration-700 ease-out`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

interface BadgeProps {
  children: ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info' | 'lava';
}

export function Badge({ children, variant = 'default' }: BadgeProps) {
  const variants = {
    default: 'bg-bg-elevated text-muted-400 border border-line-subtle',
    success: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
    warning: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
    error: 'bg-lava-600/10 text-lava-400 border border-lava-600/20',
    info: 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20',
    lava: 'bg-lava-600/15 text-lava-300 border border-lava-600/30',
  };
  return <span className={`badge ${variants[variant]}`}>{children}</span>;
}

interface StatCardProps {
  label: string;
  value: string | number;
  icon: ReactNode;
  trend?: string;
  trendUp?: boolean;
  accent?: 'lava' | 'emerald' | 'cyan' | 'neutral';
}

export function StatCard({ label, value, icon, trend, trendUp, accent = 'neutral' }: StatCardProps) {
  const accentMap = {
    lava: 'text-lava-400 bg-lava-600/10',
    emerald: 'text-emerald-400 bg-emerald-500/10',
    cyan: 'text-cyan-400 bg-cyan-500/10',
    neutral: 'text-muted-400 bg-bg-elevated',
  };
  return (
    <div className="card-hover p-5 animate-fade-in">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${accentMap[accent]}`}>
          {icon}
        </div>
        {trend && (
          <span className={`text-xs font-medium ${trendUp ? 'text-emerald-400' : 'text-muted-500'}`}>
            {trend}
          </span>
        )}
      </div>
      <div className="stat-value">{value}</div>
      <div className="text-sm text-muted-400 mt-1">{label}</div>
    </div>
  );
}

interface ScoreRingProps {
  score: number;
  size?: number;
  strokeWidth?: number;
}

export function ScoreRing({ score, size = 64, strokeWidth = 5 }: ScoreRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#e11d48';
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#1E2436" strokeWidth={strokeWidth} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <span className="absolute text-sm font-semibold" style={{ color }}>
        {score}
      </span>
    </div>
  );
}

interface SectionTitleProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}

export function SectionTitle({ title, subtitle, action }: SectionTitleProps) {
  return (
    <div className="flex items-end justify-between mb-5">
      <div>
        <h2 className="text-lg font-semibold text-white tracking-tight">{title}</h2>
        {subtitle && <p className="text-sm text-muted-400 mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
