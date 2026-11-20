import { AlertCircle, CheckCircle, Clock3, XCircle } from 'lucide-react';
import { Badge } from './ui';
import { modulePassed } from '../lib/assessmentService';
import type { ModuleProgress } from '../types';

/** Trainee-facing course status: Passed, Not passed (all attempts used), In Progress or Not Started. */
export function ModuleStatusBadge({ progress, showNotStarted = true }: { progress: ModuleProgress; showNotStarted?: boolean }) {
  if (modulePassed(progress)) return <Badge variant="success"><CheckCircle className="w-3 h-3" /> Passed · {progress.bestScore}%</Badge>;
  if (progress.status === 'completed') return <Badge variant="lava"><XCircle className="w-3 h-3" /> Not passed</Badge>;
  if (progress.status === 'in-progress') return <Badge variant="warning"><AlertCircle className="w-3 h-3" /> In Progress</Badge>;
  return showNotStarted ? <Badge variant="default"><Clock3 className="w-3 h-3" /> Not Started</Badge> : null;
}
