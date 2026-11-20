import type { ModuleProgress } from '@/types';
import { modulePassed } from './assessmentService';

/** The three steps of every course: watch the video, pass the Knowledge Check, fill out the form. */
export type StepState = 'done' | 'current' | 'todo';

export interface CourseSteps {
  video: StepState;
  quiz: StepState;
  form: StepState;
}

/**
 * Step states from the progress record. The Knowledge Check result isn't part of the progress record, but an
 * assessment can only be started after passing it, so any submitted attempt means the quiz was passed.
 */
export function courseSteps(p: ModuleProgress): CourseSteps {
  if (modulePassed(p)) return { video: 'done', quiz: 'done', form: 'done' };
  if (!p.videoCompleted) return { video: 'current', quiz: 'todo', form: 'todo' };
  if (p.attemptsUsed === 0) return { video: 'done', quiz: 'current', form: 'todo' };
  return { video: 'done', quiz: 'done', form: 'current' };
}

export interface NextStep {
  title: string;
  detail: string;
  button: string;
  tone: 'start' | 'continue' | 'retry' | 'blocked' | 'done';
}

/** Plain-English "what to do next" for one course. */
export function nextStep(p: ModuleProgress): NextStep {
  if (modulePassed(p)) {
    return { title: 'Passed', detail: `Best score ${p.bestScore}%. You can review this course any time.`, button: 'Review', tone: 'done' };
  }
  if (!p.videoCompleted) {
    return p.videoProgress > 0
      ? { title: 'Finish the training video', detail: `${Math.round(p.videoProgress)}% watched. Watch to the end to unlock the Knowledge Check.`, button: 'Continue video', tone: 'continue' }
      : { title: 'Watch the training video', detail: 'Start with the video. The Knowledge Check unlocks when you finish it.', button: 'Start course', tone: 'start' };
  }
  if (p.attemptsUsed === 0) {
    return { title: 'Knowledge Check, then fill out the form', detail: 'Pass the 15-question Knowledge Check (80%), then complete the real ACORD form.', button: 'Continue', tone: 'continue' };
  }
  if (p.attemptsRemaining <= 0) {
    return { title: 'No attempts left', detail: `Best score ${p.bestScore ?? 0}%. Ask your trainer to reset this course.`, button: 'View course', tone: 'blocked' };
  }
  return {
    title: 'Try the form again',
    detail: `Best score ${p.bestScore ?? 0}% (80% to pass). ${p.attemptsRemaining} attempt${p.attemptsRemaining === 1 ? '' : 's'} left.`,
    button: 'Retake form',
    tone: 'retry',
  };
}
