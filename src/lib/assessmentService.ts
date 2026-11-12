import { supabase, BUCKETS, buildSubmissionPath } from './supabase';
import type {
  AcordId,
  AttemptResult,
  AttemptRow,
  ModuleProgress,
  Profile,
  StudentRecord,
  TrainingMaterial,
  VideoLessonProgress,
} from '@/types';

export const MAX_ATTEMPTS = 3;
export const PASS_SCORE = 80;
const MODULE_IDS: AcordId[] = ['125', '126', '127', '130', '140'];

const ERROR_MESSAGES: Record<string, string> = {
  NOT_AUTHENTICATED: 'Your session has expired. Please sign in again.',
  MODULE_NOT_FOUND: 'This ACORD module does not exist.',
  NO_VIDEO: 'No training video has been uploaded for this module yet.',
  VIDEO_INCOMPLETE: 'Finish the required training video(s) to unlock the assessment.',
  NO_PDF: 'The fillable ACORD PDF for this module has not been uploaded yet.',
  PDF_NOT_FILLABLE: 'The uploaded PDF has no interactive fields yet. A trainer must add fields in the Field Designer.',
  GRADING_NOT_CONFIGURED: 'A trainer has not configured the answer key (field mappings) for this PDF yet.',
  NO_ATTEMPTS_REMAINING: 'You have used all 3 attempts (initial + 2 retakes). Contact your trainer.',
  ATTEMPT_NOT_FOUND: 'Assessment attempt not found.',
  ATTEMPT_ALREADY_SUBMITTED: 'This attempt has already been submitted.',
  PDF_REMOVED: 'The PDF used for this attempt was removed by a trainer. Contact your trainer.',
  INVALID_VALUES: 'The form data could not be read. Please try again.',
  VIDEO_DURATION_UNKNOWN: 'The video length is unknown, so progress could not be recorded.',
  VIDEO_NOT_FOUND: 'This video is no longer available.',
  KNOWLEDGE_CHECK_NOT_PASSED: 'Pass the Knowledge Check for this module first (80% or higher) to unlock the assessment.',
  KNOWLEDGE_CHECK_ALREADY_PASSED: 'You already passed this Knowledge Check.',
  KNOWLEDGE_CHECK_NOT_FOUND: 'This module has no Knowledge Check questions yet.',
  FORBIDDEN: 'You do not have permission to do that.',
  LAST_ADMIN: 'At least one administrator is required.',
};

export function friendlyError(err: unknown): string {
  const msg = (err as { message?: string })?.message ?? String(err);
  const code = Object.keys(ERROR_MESSAGES).find((c) => msg.includes(c));
  return code ? ERROR_MESSAGES[code] : msg;
}

function rpcError(error: { message: string } | null): void {
  if (error) throw new Error(friendlyError(error));
}

// ---------------------------------------------------------------- video progress

export interface VideoHeartbeatResult {
  asset_key: string;
  coverage: number;
  completed: boolean;
  credited: number;
  last_position: number;
}

export async function reportVideoProgress(materialId: string, from: number, to: number, clientDuration: number | null): Promise<VideoHeartbeatResult> {
  const { data, error } = await supabase.rpc('record_video_progress', {
    p_material_id: materialId, p_from: from, p_to: to, p_client_duration: clientDuration,
  });
  rpcError(error);
  return data as VideoHeartbeatResult;
}

// ---------------------------------------------------------------- knowledge check (video -> quiz -> assessment)

export interface KnowledgeCheckQuestion {
  id: string;
  prompt: string;
  options: string[];
}

export interface KnowledgeCheckResultItem {
  id: string;
  prompt: string;
  given: number | null;
  correct: boolean;
  /** Only present once the student has passed. */
  options?: string[];
  correct_index?: number;
  explanation?: string;
}

export interface KnowledgeCheckSubmission {
  score: number;
  correct: number;
  total: number;
  passed: boolean;
  pass_score: number;
  results: KnowledgeCheckResultItem[];
}

export interface KnowledgeCheckStatus {
  question_count: number;
  pass_score: number;
  video_complete: boolean;
  passed: boolean;
  best_score: number | null;
  attempts: number;
  last_attempt: (Omit<KnowledgeCheckSubmission, 'pass_score'> & { created_at: string }) | null;
  questions: KnowledgeCheckQuestion[];
}

/** Returns null when the Knowledge Check feature is not installed in the database yet. */
export async function getKnowledgeCheck(moduleId: AcordId): Promise<KnowledgeCheckStatus | null> {
  const { data, error } = await supabase.rpc('get_knowledge_check', { p_module_id: moduleId });
  if (error) {
    if (/get_knowledge_check/.test(error.message) && /(not find|does not exist)/i.test(error.message)) return null;
    throw new Error(friendlyError(error));
  }
  return data as KnowledgeCheckStatus;
}

/** answers: question id -> chosen option index (index into the question's original options array). */
export async function submitKnowledgeCheck(moduleId: AcordId, answers: Record<string, number>): Promise<KnowledgeCheckSubmission> {
  const { data, error } = await supabase.rpc('submit_knowledge_check', { p_module_id: moduleId, p_answers: answers });
  rpcError(error);
  return data as KnowledgeCheckSubmission;
}

export async function resetKnowledgeCheck(userId: string, moduleId: AcordId): Promise<void> {
  const { error } = await supabase.rpc('staff_reset_knowledge_check', { p_user_id: userId, p_module_id: moduleId });
  rpcError(error);
}

// ---------------------------------------------------------------- assessments

export async function startAssessment(moduleId: AcordId): Promise<AttemptRow> {
  const { data, error } = await supabase.rpc('start_assessment', { p_module_id: moduleId });
  rpcError(error);
  return data as AttemptRow;
}

export async function saveDraft(attemptId: string, values: Record<string, string>): Promise<void> {
  const { error } = await supabase.rpc('save_assessment_draft', { p_attempt_id: attemptId, p_values: values });
  rpcError(error);
}

export async function submitAssessment(attemptId: string, values: Record<string, string>): Promise<AttemptRow> {
  const { data, error } = await supabase.rpc('submit_assessment', { p_attempt_id: attemptId, p_values: values });
  rpcError(error);
  return data as AttemptRow;
}

export async function getRequiredFields(materialId: string): Promise<string[]> {
  const { data, error } = await supabase.rpc('get_required_fields', { p_material_id: materialId });
  if (error) return [];
  return ((data ?? []) as unknown[]).map((r) => (typeof r === 'string' ? r : String((r as Record<string, unknown>).get_required_fields ?? '')));
}

/** Upload the generated completed copy to the student's private folder and link it to the attempt. */
export async function storeCompletedPdf(userId: string, attempt: AttemptRow, bytes: Uint8Array): Promise<string> {
  const path = buildSubmissionPath(userId, attempt.module_id, attempt.id);
  const { error } = await supabase.storage.from(BUCKETS.SUBMISSIONS)
    .upload(path, new Blob([bytes], { type: 'application/pdf' }), { contentType: 'application/pdf', upsert: false });
  if (error && !/exists/i.test(error.message)) throw new Error(error.message);
  const { error: e2 } = await supabase.rpc('attach_completed_pdf', { p_attempt_id: attempt.id, p_path: path });
  rpcError(e2);
  return path;
}

export async function getCompletedPdfUrl(path: string, downloadName?: string): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKETS.SUBMISSIONS)
    .createSignedUrl(path, 60 * 30, downloadName ? { download: downloadName } : undefined);
  if (error || !data) throw new Error(error?.message ?? 'Could not open completed PDF');
  return data.signedUrl;
}

export function rowToAttempt(r: AttemptRow): AttemptResult {
  return {
    id: r.id,
    moduleId: r.module_id,
    attemptNumber: r.attempt_number,
    score: r.score,
    correct: r.correct,
    incorrect: r.incorrect,
    missing: r.missing,
    totalFields: r.total_fields,
    completedAt: r.submitted_at ?? r.started_at ?? new Date().toISOString(),
    completionTimeMin: r.completion_time_min,
    fieldResults: r.field_results ?? [],
    passed: r.passed,
    feedbackRevealed: r.feedback_revealed,
    completedPdfPath: r.completed_pdf_path,
    materialId: r.material_id,
  };
}

// ---------------------------------------------------------------- student record

interface VideoProgressRow {
  user_id: string;
  asset_key: string;
  module_id: AcordId;
  coverage: number;
  completed: boolean;
  watched_seconds: number;
  last_position: number;
  last_heartbeat_at: string | null;
}

export function buildModuleProgress(
  moduleId: AcordId,
  videos: TrainingMaterial[],
  progressRows: VideoProgressRow[],
  attemptRows: AttemptRow[],
): ModuleProgress {
  const vids: Record<string, VideoLessonProgress> = {};
  for (const r of progressRows.filter((p) => p.module_id === moduleId)) {
    vids[r.asset_key] = {
      assetKey: r.asset_key, coverage: Number(r.coverage), completed: r.completed,
      watchedSeconds: Number(r.watched_seconds), lastPosition: Number(r.last_position),
    };
  }
  const moduleVideos = videos.filter((v) => v.module_id === moduleId && v.material_type === 'video' && v.is_current);
  const required = moduleVideos.filter((v) => v.is_required);
  const gate = required.length > 0 ? required : moduleVideos;
  const videoCompleted = gate.length > 0 && gate.every((v) => vids[v.asset_key]?.completed);
  const videoProgress = gate.length > 0
    ? Math.round(gate.reduce((s, v) => s + (vids[v.asset_key]?.coverage ?? 0), 0) / gate.length)
    : 0;

  const attempts = attemptRows
    .filter((a) => a.module_id === moduleId && a.status === 'submitted')
    .sort((a, b) => a.attempt_number - b.attempt_number)
    .map(rowToAttempt);
  const bestScore = attempts.length ? Math.max(...attempts.map((a) => a.score)) : null;
  const latestScore = attempts.length ? attempts[attempts.length - 1].score : null;
  const anyVideo = Object.keys(vids).length > 0;
  const status: ModuleProgress['status'] = (bestScore !== null && bestScore >= PASS_SCORE) || attempts.length >= MAX_ATTEMPTS
    ? 'completed'
    : anyVideo || attempts.length > 0 || attemptRows.some((a) => a.module_id === moduleId) ? 'in-progress' : 'not-started';

  return {
    moduleId,
    status,
    videoCompleted,
    videoProgress: videoCompleted ? 100 : videoProgress,
    attemptsUsed: attempts.length,
    attemptsRemaining: Math.max(0, MAX_ATTEMPTS - attempts.length),
    bestScore,
    latestScore,
    attempts,
    videos: vids,
  };
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || '?';
}

export async function loadStudentRecord(profile: Profile, materials: TrainingMaterial[]): Promise<{ record: StudentRecord; inProgress: AttemptRow[] }> {
  const [{ data: vp, error: e1 }, { data: at, error: e2 }] = await Promise.all([
    supabase.from('video_progress').select('*').eq('user_id', profile.id),
    supabase.from('assessment_attempts').select('*').eq('user_id', profile.id).order('attempt_number'),
  ]);
  if (e1) throw new Error(e1.message);
  if (e2) throw new Error(e2.message);
  const progressRows = (vp ?? []) as VideoProgressRow[];
  const attemptRows = (at ?? []) as AttemptRow[];

  const progress = Object.fromEntries(
    MODULE_IDS.map((id) => [id, buildModuleProgress(id, materials, progressRows, attemptRows)]),
  ) as Record<AcordId, ModuleProgress>;

  const seconds = progressRows.reduce((s, r) => s + Number(r.watched_seconds || 0), 0)
    + attemptRows.reduce((s, r) => s + (r.completion_seconds ?? 0), 0);

  const name = profile.full_name || profile.email?.split('@')[0] || 'Trainee';
  return {
    record: {
      name,
      role: profile.role === 'admin' ? 'Administrator' : profile.role === 'trainer' ? 'Trainer' : 'Virtual Assistant — Trainee',
      email: profile.email ?? '',
      avatarInitials: initials(name),
      cohort: profile.cohort ?? 'No cohort assigned',
      joinedDate: new Date(profile.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      totalTrainingHours: Math.round((seconds / 3600) * 10) / 10,
      progress,
    },
    inProgress: attemptRows.filter((a) => a.status === 'in_progress'),
  };
}
