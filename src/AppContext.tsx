import { createContext, useContext, useState, useCallback, useEffect, useMemo, type ReactNode } from 'react';
import type { View, StudentRecord, AcordId, AttemptResult, AttemptRow, TrainingMaterial, Profile } from './types';
import { useAuth } from './context/AuthContext';
import { listMaterials } from './lib/materialsService';
import { buildModuleProgress, loadStudentRecord, rowToAttempt, startAssessment as rpcStartAssessment } from './lib/assessmentService';

export interface ModuleMaterials {
  videos: TrainingMaterial[];
  pdf: TrainingMaterial | null;
  supporting: TrainingMaterial[];
}

interface AppState {
  view: View;
  activeModuleId: AcordId | null;
  activeAttempt: AttemptResult | null;
  /** The in-progress attempt opened in the assessment workspace (server-created). */
  workingAttempt: AttemptRow | null;
  student: StudentRecord;
  studentLoaded: boolean;
  mode: 'student' | 'trainer';
  materials: TrainingMaterial[];
  materialsLoaded: boolean;
  materialsError: string | null;
  navigate: (view: View) => void;
  openModule: (id: AcordId) => void;
  /** Server-validated: video gate, PDF + grading configured, attempts remaining. Throws a friendly message. */
  startAssessment: (id: AcordId) => Promise<void>;
  showResults: (attempt: AttemptRow | AttemptResult) => void;
  setMode: (mode: 'student' | 'trainer') => void;
  refreshMaterials: () => Promise<void>;
  refreshStudent: () => Promise<void>;
  getModuleMaterials: (id: AcordId) => ModuleMaterials;
}

const AppContext = createContext<AppState | null>(null);
const MODULE_IDS: AcordId[] = ['125', '126', '127', '130', '140'];

function emptyStudent(profile: Profile | null): StudentRecord {
  const name = profile?.full_name || profile?.email?.split('@')[0] || 'Trainee';
  return {
    name,
    role: profile?.role === 'admin' ? 'Administrator' : profile?.role === 'trainer' ? 'Trainer' : 'Virtual Assistant — Trainee',
    email: profile?.email ?? '',
    avatarInitials: name.slice(0, 2).toUpperCase(),
    cohort: profile?.cohort ?? 'No cohort assigned',
    joinedDate: profile ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '',
    totalTrainingHours: 0,
    progress: Object.fromEntries(MODULE_IDS.map((id) => [id, buildModuleProgress(id, [], [], [])])) as StudentRecord['progress'],
  };
}

export function AppProvider({ children }: { children: ReactNode }) {
  const { profile, isStaff } = useAuth();
  const [view, setView] = useState<View>('dashboard');
  const [activeModuleId, setActiveModuleId] = useState<AcordId | null>(null);
  const [activeAttempt, setActiveAttempt] = useState<AttemptResult | null>(null);
  const [workingAttempt, setWorkingAttempt] = useState<AttemptRow | null>(null);
  const [student, setStudent] = useState<StudentRecord>(() => emptyStudent(profile));
  const [studentLoaded, setStudentLoaded] = useState(false);
  const [mode, setModeState] = useState<'student' | 'trainer'>('student');
  const [materials, setMaterials] = useState<TrainingMaterial[]>([]);
  const [materialsLoaded, setMaterialsLoaded] = useState(false);
  const [materialsError, setMaterialsError] = useState<string | null>(null);

  const refreshMaterials = useCallback(async () => {
    try {
      const rows = await listMaterials();
      setMaterials(rows);
      setMaterialsError(null);
    } catch (err) {
      setMaterialsError((err as Error).message);
    } finally {
      setMaterialsLoaded(true);
    }
  }, []);

  const refreshStudentWith = useCallback(async (mats: TrainingMaterial[]) => {
    if (!profile) return;
    try {
      const { record } = await loadStudentRecord(profile, mats);
      setStudent(record);
    } catch (err) {
      console.error('Could not load progress', err);
    } finally {
      setStudentLoaded(true);
    }
  }, [profile]);

  const refreshStudent = useCallback(() => refreshStudentWith(materials), [refreshStudentWith, materials]);

  useEffect(() => {
    if (!profile) return;
    setStudent(emptyStudent(profile));
    refreshMaterials();
  }, [profile, refreshMaterials]);

  useEffect(() => {
    if (profile && materialsLoaded) refreshStudentWith(materials);
  }, [profile, materialsLoaded, materials, refreshStudentWith]);

  // Staff land on the trainer dashboard; students can never enter trainer mode.
  useEffect(() => {
    if (!profile) return;
    if (!isStaff && mode === 'trainer') { setModeState('student'); setView('dashboard'); }
  }, [profile, isStaff, mode]);

  const getModuleMaterials = useCallback((id: AcordId): ModuleMaterials => {
    const mine = materials.filter((m) => m.module_id === id && m.is_current);
    return {
      videos: mine.filter((m) => m.material_type === 'video').sort((a, b) => a.lesson_order - b.lesson_order || a.uploaded_at.localeCompare(b.uploaded_at)),
      pdf: mine.find((m) => m.material_type === 'pdf') ?? null,
      supporting: mine.filter((m) => m.material_type === 'supporting'),
    };
  }, [materials]);

  const navigate = useCallback((v: View) => {
    if ((v === 'trainer' || v === 'materials' || v === 'users') && !isStaff) v = 'dashboard';
    setView(v);
    if (v !== 'module' && v !== 'assessment' && v !== 'results') setActiveModuleId(null);
    if (v !== 'results') setActiveAttempt(null);
    if (v !== 'assessment') setWorkingAttempt(null);
  }, [isStaff]);

  const openModule = useCallback((id: AcordId) => {
    setActiveModuleId(id);
    setActiveAttempt(null);
    setWorkingAttempt(null);
    setView('module');
  }, []);

  const startAssessment = useCallback(async (id: AcordId) => {
    const attempt = await rpcStartAssessment(id);
    setActiveModuleId(id);
    setWorkingAttempt(attempt);
    setView('assessment');
  }, []);

  const showResults = useCallback((attempt: AttemptRow | AttemptResult) => {
    const result = 'moduleId' in attempt ? attempt : rowToAttempt(attempt);
    setActiveModuleId(result.moduleId);
    setActiveAttempt(result);
    setWorkingAttempt(null);
    setView('results');
  }, []);

  const setMode = useCallback((m: 'student' | 'trainer') => {
    if (m === 'trainer' && !isStaff) return;
    setModeState(m);
    setActiveModuleId(null);
    setView(m === 'trainer' ? 'trainer' : 'dashboard');
  }, [isStaff]);

  const value = useMemo<AppState>(() => ({
    view, activeModuleId, activeAttempt, workingAttempt, student, studentLoaded, mode, materials, materialsLoaded, materialsError,
    navigate, openModule, startAssessment, showResults, setMode, refreshMaterials, refreshStudent, getModuleMaterials,
  }), [view, activeModuleId, activeAttempt, workingAttempt, student, studentLoaded, mode, materials, materialsLoaded, materialsError,
    navigate, openModule, startAssessment, showResults, setMode, refreshMaterials, refreshStudent, getModuleMaterials]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
