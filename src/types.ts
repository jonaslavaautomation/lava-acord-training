export type View =
  | 'dashboard'
  | 'training'
  | 'module'
  | 'assessment'
  | 'results'
  | 'my-assessments'
  | 'progress'
  | 'history'
  | 'settings'
  | 'trainer'
  | 'materials'
  | 'users';

export type ModuleStatus = 'not-started' | 'in-progress' | 'completed';

export type AcordId = '125' | '126' | '127' | '130' | '140';

export interface ScenarioEmail {
  from: string;
  fromName: string;
  to: string;
  subject: string;
  date: string;
  body: string;
  attachments?: string[];
}

export interface AcordModule {
  id: AcordId;
  formNumber: string;
  title: string;
  description: string;
  category: string;
  videoTitle: string;
  videoDescription: string;
  videoDuration: string;
  introduction: {
    purpose: string;
    agencyRole: string;
    keySections: { title: string; description: string }[];
    learningObjectives: string[];
  };
  scenario: ScenarioEmail;
}

export interface AttemptResult {
  id: string;
  moduleId: AcordId;
  attemptNumber: number;
  score: number;
  correct: number;
  incorrect: number;
  missing: number;
  totalFields: number;
  completedAt: string;
  completionTimeMin: number;
  fieldResults: FieldResult[];
  passed: boolean;
  feedbackRevealed: boolean;
  completedPdfPath: string | null;
  materialId: string | null;
}

export interface FieldResult {
  fieldId: string;
  label: string;
  status: 'correct' | 'incorrect' | 'missing';
  /** null while expected answers are hidden (before the student passes or uses the final attempt) */
  expected: string | null;
  given: string;
  feedback: string;
  points?: number;
  earned?: number;
  required?: boolean;
  page?: number;
}

export interface VideoLessonProgress {
  assetKey: string;
  coverage: number;
  completed: boolean;
  watchedSeconds: number;
  lastPosition: number;
}

export interface ModuleProgress {
  moduleId: AcordId;
  status: ModuleStatus;
  videoCompleted: boolean;
  videoProgress: number;
  attemptsUsed: number;
  attemptsRemaining: number;
  bestScore: number | null;
  latestScore: number | null;
  attempts: AttemptResult[];
  videos: Record<string, VideoLessonProgress>;
}

export type AppRole = 'student' | 'trainer' | 'admin';

export interface Profile {
  id: string;
  email: string | null;
  full_name: string;
  role: AppRole;
  cohort: string | null;
  created_at: string;
}

export interface StudentRecord {
  name: string;
  role: string;
  email: string;
  avatarInitials: string;
  cohort: string;
  joinedDate: string;
  totalTrainingHours: number;
  progress: Record<AcordId, ModuleProgress>;
}

export interface TrainerStudent {
  id: string;
  name: string;
  avatarInitials: string;
  cohort: string;
  modulesCompleted: number;
  modulesInProgress: number;
  averageScore: number | null;
  lastActive: string;
  status: 'active' | 'idle' | 'completed';
  needsAttention: boolean;
}

export interface TrainerActivity {
  id: string;
  studentName: string;
  moduleName: string;
  score: number;
  attempt: number;
  timestamp: string;
}

// ============================================================
// File-based training materials & PDF integration (Supabase)
// ============================================================

export type MaterialType = 'video' | 'pdf' | 'supporting';

export interface TrainingMaterial {
  id: string;
  module_id: AcordId;
  material_type: MaterialType;
  asset_key: string;
  title: string | null;
  description: string | null;
  lesson_order: number;
  is_required: boolean;
  is_current: boolean;
  version: string | null;
  version_number: number;
  file_name: string;
  file_size: number;
  storage_path: string;
  storage_bucket: string;
  mime_type: string | null;
  duration_seconds: number | null;
  page_count: number | null;
  is_fillable: boolean;
  is_encrypted: boolean;
  field_count: number;
  uploaded_at: string;
  uploaded_by: string | null;
}

export type PdfFieldType = 'text' | 'checkbox' | 'radio' | 'dropdown' | 'date' | 'signature' | 'button' | 'unknown';

export interface PdfFieldOption {
  value: string;
  label: string;
}

/** Field catalog entry (stored in pdf_form_fields; no answers). rect = [x1, y1, x2, y2] in PDF points. */
export interface PdfFieldInfo {
  name: string;
  type: PdfFieldType;
  page: number;
  rect: number[] | null;
  options: PdfFieldOption[];
  multiline: boolean;
  maxLength: number | null;
  readOnly: boolean;
  tooltip: string | null;
  source: 'acroform' | 'custom';
}

/** A single on-page widget (one field may have several, e.g. radio buttons). */
export interface PdfWidget {
  id: string;
  fieldName: string;
  type: PdfFieldType;
  page: number;
  rect: number[];
  /** checkbox on-value / radio button value */
  exportValue?: string;
  options: PdfFieldOption[];
  multiline: boolean;
  maxLength: number | null;
  readOnly: boolean;
  comb: boolean;
  textAlign: 'left' | 'center' | 'right';
  fontSize: number | null;
  tooltip: string | null;
}

export type MatchType = 'exact' | 'contains' | 'any-of' | 'keywords' | 'present';
export type MissingRule = 'penalize' | 'expect_blank' | 'optional';

export interface PdfFieldMapping {
  id?: string;
  module_id: AcordId;
  material_id: string;
  pdf_field_name: string;
  pdf_field_type: string;
  scenario_label: string;
  scenario_fact_key: string | null;
  expected_value: string;
  match_type: MatchType;
  points: number;
  required: boolean;
  missing_rule: MissingRule;
  feedback_hint: string | null;
  is_scored: boolean;
  page_number: number;
}

export interface ScenarioFact {
  id: string;
  module_id: AcordId;
  fact_key: string;
  label: string;
  value: string;
  match_type: MatchType;
  points: number;
  value_kind: string;
}

export interface UploadProgress {
  fileName: string;
  fileSize: number;
  progress: number;
  status: 'analyzing' | 'uploading' | 'saving' | 'completed' | 'error';
  error?: string;
}

export interface AttemptRow {
  id: string;
  module_id: AcordId;
  material_id: string | null;
  attempt_number: number;
  status: 'in_progress' | 'submitted';
  started_at: string | null;
  submitted_at: string | null;
  score: number;
  correct: number;
  incorrect: number;
  missing: number;
  total_fields: number;
  completion_time_min: number;
  completion_seconds: number | null;
  field_values: Record<string, string> | null;
  draft_values: Record<string, string> | null;
  field_results: FieldResult[] | null;
  completed_pdf_path: string | null;
  feedback_revealed: boolean;
  passed: boolean;
  user_id: string;
  student_name: string;
}
