import { History, PlayCircle, CheckCircle2, Send, FileText, Clock3 } from 'lucide-react';
import { useApp } from '../AppContext';
import { ACORD_MODULES, MODULE_MAP } from '../data/modules';
import { Topbar } from '../components/Topbar';
import { Badge, SectionTitle } from '../components/ui';
import type { AttemptResult, AcordId } from '../types';

interface TimelineEvent {
  id: string;
  type: 'video' | 'assessment' | 'start';
  moduleId: AcordId;
  timestamp: string;
  title: string;
  detail: string;
  attempt?: AttemptResult;
}

export function TrainingHistory() {
  const { student } = useApp();

  const events: TimelineEvent[] = [
    { id: 'e0', type: 'start', moduleId: '125', timestamp: '2026-10-28T09:00:00Z', title: 'Training Started', detail: 'Joined Cohort 2026-Q4 and began ACORD training' },
  ];

  ACORD_MODULES.forEach((mod) => {
    const p = student.progress[mod.id];
    if (p.videoProgress > 0 || p.videoCompleted) {
      events.push({
        id: `vid-${mod.id}`,
        type: 'video',
        moduleId: mod.id,
        timestamp: p.videoCompleted ? `2026-11-0${mod.id === '125' ? 5 : mod.id === '126' ? 8 : mod.id === '127' ? 9 : mod.id === '140' ? 6 : 1}T10:00:00Z` : '2026-11-10T08:00:00Z',
        title: p.videoCompleted ? 'Video Completed' : 'Video In Progress',
        detail: `${mod.formNumber} training video — ${mod.videoDuration}`,
      });
    }
    p.attempts.forEach((att) => {
      events.push({
        id: `att-${att.id}`,
        type: 'assessment',
        moduleId: mod.id,
        timestamp: att.completedAt,
        title: `Assessment Submitted — Attempt ${att.attemptNumber}`,
        detail: `Scored ${att.score}% in ${att.completionTimeMin} minutes`,
        attempt: att,
      });
    });
  });

  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return (
    <div>
      <Topbar title="Training History" subtitle="Complete timeline of your learning journey" />
      <div className="px-8 py-6 space-y-6 max-w-[1000px]">
        <div className="card p-5 flex items-center gap-4 animate-fade-in">
          <div className="w-12 h-12 rounded-lg bg-lava-600/10 border border-lava-600/20 flex items-center justify-center">
            <History className="w-6 h-6 text-lava-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-white">Activity Timeline</h3>
            <p className="text-sm text-muted-400 mt-0.5">Every video view, assessment attempt, and milestone in chronological order.</p>
          </div>
          <Badge variant="info">{events.length} events</Badge>
        </div>

        <SectionTitle title="Timeline" subtitle={`${student.name} · ${student.cohort}`} />

        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-5 top-0 bottom-0 w-px bg-line" />

          <div className="space-y-1">
            {events.map((event) => {
              const mod = MODULE_MAP[event.moduleId];
              const Icon = event.type === 'video' ? (event.title.includes('Completed') ? CheckCircle2 : PlayCircle) : event.type === 'assessment' ? Send : FileText;
              const iconColor = event.type === 'video' && event.title.includes('Completed') ? 'text-emerald-400 bg-emerald-500/10' : event.type === 'assessment' ? (event.attempt && event.attempt.score >= 80 ? 'text-emerald-400 bg-emerald-500/10' : 'text-lava-400 bg-lava-600/10') : 'text-cyan-400 bg-cyan-500/10';

              return (
                <div key={event.id} className="relative flex items-start gap-4 p-3 rounded-lg hover:bg-bg-hover/30 transition-colors">
                  <div className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${iconColor} border-2 border-bg-base`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0 pt-1.5">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-sm font-medium text-white">{event.title}</span>
                      <Badge variant="default">{mod.formNumber}</Badge>
                      {event.attempt && (
                        <Badge variant={event.attempt.score >= 80 ? 'success' : event.attempt.score >= 60 ? 'warning' : 'error'}>
                          {event.attempt.score}%
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-400">{event.detail}</p>
                    {event.attempt && (
                      <div className="flex items-center gap-4 mt-1.5 text-xs text-muted-500">
                        <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> {event.attempt.correct} correct</span>
                        <span className="flex items-center gap-1"><Clock3 className="w-3 h-3" /> {event.attempt.completionTimeMin} min</span>
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-muted-500 text-right shrink-0 pt-2">
                    {new Date(event.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    <div className="text-muted-600 mt-0.5">
                      {new Date(event.timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
