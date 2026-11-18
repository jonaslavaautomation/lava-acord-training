import { supabase } from './supabase';
import { downloadMaterialBytes, getFormFields, listMaterials } from './materialsService';
import { buildTrainingSamplePdf } from './trainingSamplePdf';
import type { AcordId } from '@/types';

/** Forms that can be sampled. The server enforces the same list (get_training_sample). */
export const SAMPLE_FORMS: AcordId[] = ['27'];
/** How long a generated sample stays available before it is deleted from the app. */
export const SAMPLE_LIFETIME_MS = 20 * 60 * 1000;

export interface TrainingSample {
  moduleId: AcordId;
  fileName: string;
  url: string;          // blob: URL, revoked when the sample expires
  createdAt: number;
  expiresAt: number;
  fieldCount: number;
}

const SAMPLE_ERRORS: Record<string, string> = {
  SAMPLE_NOT_AVAILABLE: 'Training samples are only available for the ACORD 27.',
  NO_PDF: 'Upload the ACORD 27 fillable PDF in Training Materials first.',
  GRADING_NOT_CONFIGURED: 'The ACORD 27 answer key is not set up yet. Run the answer-key SQL in Supabase, or open Field Mapping & Grading.',
  FORBIDDEN: 'Only trainers and administrators can create training samples.',
};

function sampleError(message: string): Error {
  const code = Object.keys(SAMPLE_ERRORS).find((c) => message.includes(c));
  if (code) return new Error(SAMPLE_ERRORS[code]);
  if (/get_training_sample/.test(message) && /(not find|does not exist)/i.test(message)) {
    return new Error('Training samples are not set up in the database yet. Run supabase/migrations/20261117120000_training_samples.sql in Supabase.');
  }
  return new Error(message);
}

/**
 * Builds a watermarked "TRAINING PURPOSES ONLY" copy of the current fillable form, filled with the practice
 * scenario's correct answers. Everything happens in memory: nothing is uploaded or saved.
 */
export async function generateTrainingSample(moduleId: AcordId): Promise<TrainingSample> {
  if (!SAMPLE_FORMS.includes(moduleId)) throw new Error(SAMPLE_ERRORS.SAMPLE_NOT_AVAILABLE);

  const { data, error } = await supabase.rpc('get_training_sample', { p_module_id: moduleId });
  if (error) throw sampleError(error.message);
  const sample = data as { material_id: string; file_name: string; values: Record<string, string> };

  const material = (await listMaterials({ moduleId })).find((m) => m.id === sample.material_id);
  if (!material) throw new Error(SAMPLE_ERRORS.NO_PDF);
  const [master, customFields] = await Promise.all([downloadMaterialBytes(material), getFormFields(material.id)]);

  const createdAt = Date.now();
  const expiresAt = createdAt + SAMPLE_LIFETIME_MS;
  const { bytes: out, fieldCount } = await buildTrainingSamplePdf(master, sample.values, customFields.filter((f) => f.source === 'custom'), { moduleId, createdAt, expiresAt });
  const url = URL.createObjectURL(new Blob([out], { type: 'application/pdf' }));
  return {
    moduleId,
    fileName: `TRAINING-SAMPLE-ACORD-${moduleId}.pdf`,
    url,
    createdAt,
    expiresAt,
    fieldCount,
  };
}

/** Deletes a sample from the app (its link stops working). */
export function destroyTrainingSample(sample: Pick<TrainingSample, 'url'>): void {
  URL.revokeObjectURL(sample.url);
}

/** Recognises "make a sample ACORD 27"-style requests. Returns the requested form, 'other' for a non-sample form, or null. */
export function parseSampleRequest(text: string): '27' | 'other' | null {
  const t = text.toLowerCase();
  if (!/\b(sample|example|specimen|mock|demo)\b/.test(t) || !/\b(acord|form|evidence|eop)\b/.test(t)) return null;
  const forms = t.match(/\b(27|125|126|127|130|140)\b/g) ?? [];
  if (forms.some((f) => f !== '27')) return 'other';
  return '27';
}
