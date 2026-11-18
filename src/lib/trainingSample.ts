import { supabase } from './supabase';
import { downloadMaterialBytes, getFormFields, listMaterials } from './materialsService';
import { buildTrainingSamplePdf } from './trainingSamplePdf';
import { acord27ToFieldValues, AUTHORIZED_REP_STAMP, type Acord27Data } from './acord27Layout';
import { PDFDocument } from 'pdf-lib';
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

/**
 * Builds a watermarked ACORD 27 training sample from the user's OWN information (what the AI read from their
 * question, notes and photos), instead of the practice scenario. Same watermark and 20-minute lifetime; nothing stored.
 */
export async function generateCustomTrainingSample(data: Acord27Data): Promise<TrainingSample> {
  const material = (await listMaterials({ moduleId: '27' })).find((m) => m.material_type === 'pdf' && m.is_current);
  if (!material) throw new Error(SAMPLE_ERRORS.NO_PDF);
  const master = await downloadMaterialBytes(material);
  const names = (await PDFDocument.load(master.slice(), { updateMetadata: false })).getForm().getFields().map((f) => f.getName());
  const values = acord27ToFieldValues(data, names);
  if (!values) throw new Error('This ACORD 27 PDF edition is not supported for custom samples. Use the "Evidence Of Property Ins.pdf" (ACORD 27 2006/07).');
  if (Object.keys(values).length === 0) throw new Error('I could not find any ACORD 27 details in your information. Add the policy, property or lender details and try again.');

  const createdAt = Date.now();
  const expiresAt = createdAt + SAMPLE_LIFETIME_MS;
  const stamps = data.authorized_representative ? [{ text: data.authorized_representative, ...AUTHORIZED_REP_STAMP }] : [];
  const { bytes, fieldCount } = await buildTrainingSamplePdf(master, values, [], { moduleId: '27', createdAt, expiresAt, source: 'built from your information' }, stamps);
  return {
    moduleId: '27',
    fileName: 'TRAINING-SAMPLE-ACORD-27-custom.pdf',
    url: URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' })),
    createdAt,
    expiresAt,
    fieldCount,
  };
}

/** Deletes a sample from the app (its link stops working). */
export function destroyTrainingSample(sample: Pick<TrainingSample, 'url'>): void {
  URL.revokeObjectURL(sample.url);
}

/**
 * Recognises sample requests: "make a sample ACORD 27", "fill an ACORD 27 with this", "create an evidence of property
 * from my dec page". Returns '27', 'other' (a sample of another form), or null (a normal question for the AI).
 */
export function parseSampleRequest(text: string): '27' | 'other' | null {
  const t = text.toLowerCase();
  const forms = t.match(/\bacord\s*#?\s*(27|125|126|127|130|140)\b|\b(27|125|126|127|130|140)\b/g)?.map((f) => f.replace(/\D/g, '')) ?? [];
  const mentions27 = forms.includes('27') || /\bevidence of property\b|\beop\b/.test(t);
  const wantsSample = /\b(sample|example|specimen|mock|demo)\b/.test(t);
  // "fill / create / make an ACORD 27" counts too, but not questions like "how do I fill the ACORD 27?"
  const wantsFilled = /\b(fill|create|generate|make|build|prepare|produce)\b/.test(t) && !/^\s*(how|what|why|where|when|who|which|can i|should i|do i)\b/.test(t);
  if (!wantsSample && !(wantsFilled && mentions27)) return null;
  if (!wantsSample && !mentions27) return null;
  if (wantsSample && !mentions27 && !/\b(acord|form)\b/.test(t)) return null;
  if (forms.some((f) => f !== '27')) return 'other';
  return '27';
}

/**
 * True when the sample should be built from the user's OWN information rather than the practice scenario:
 * a photo is attached, the message contains details (numbers, names, addresses), or it points at earlier messages.
 */
export function isCustomSampleRequest(text: string, hasImages: boolean, hasEarlierInfo: boolean): boolean {
  if (hasImages) return true;
  const rest = text.toLowerCase().replace(/\bacord\s*#?\s*27\b/g, '');
  if (/\d/.test(rest) || rest.length > 120) return true;
  return hasEarlierInfo && /\b(this|these|that|above|attached|uploaded|my|from|based on|using)\b/.test(rest);
}
