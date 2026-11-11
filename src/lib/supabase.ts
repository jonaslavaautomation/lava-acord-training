import { createClient } from '@supabase/supabase-js';
import type { AcordId, MaterialType } from '@/types';

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!SUPABASE_URL || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Check .env for VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
}

export const supabase = createClient(SUPABASE_URL, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

/** Private buckets — files are served through short-lived signed URLs only. */
export const BUCKETS = {
  /** Trainer-managed masters: videos, fillable ACORD PDFs, supporting materials. */
  TRAINING: 'lava-acord-training',
  /** Each student's completed assessment copies: <user_id>/<module>/<attempt_id>.pdf */
  SUBMISSIONS: 'assessment-submissions',
} as const;

export const MATERIAL_FOLDERS: Record<MaterialType, string> = {
  video: 'Videos',
  pdf: 'Fillable PDF',
  supporting: 'Supporting Materials',
};

/** "LAVA ACORD Training" is the bucket; each module is a top-level folder inside it. */
export function moduleFolder(moduleId: AcordId): string {
  return `ACORD ${moduleId}`;
}

export function sanitizeFileName(name: string): string {
  const cleaned = name
    .normalize('NFKD')
    .replace(/[^\w.\- ()]+/g, '_')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.slice(-120) || 'file';
}

/**
 * Organized storage path, e.g. "ACORD 125/Fillable PDF/20261111-1a2b3c-ACORD_125_2016-03.pdf".
 * A unique prefix keeps every version as its own object so history is preserved.
 */
export function buildMaterialPath(moduleId: AcordId, type: MaterialType, fileName: string): string {
  const stamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
  const rand = Math.random().toString(36).slice(2, 8);
  return `${moduleFolder(moduleId)}/${MATERIAL_FOLDERS[type]}/${stamp}-${rand}-${sanitizeFileName(fileName)}`;
}

export function buildSubmissionPath(userId: string, moduleId: AcordId, attemptId: string): string {
  return `${userId}/ACORD ${moduleId}/${attemptId}.pdf`;
}
