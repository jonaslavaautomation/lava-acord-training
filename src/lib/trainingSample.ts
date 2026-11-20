import { supabase } from './supabase';
import { downloadMaterialBytes, getFormFields, listMaterials } from './materialsService';
import { buildTrainingSamplePdf } from './trainingSamplePdf';
import { acord27ToFieldValues, AUTHORIZED_REP_STAMP, type Acord27Data } from './acord27Layout';
import { acord25ToFieldValues, type Acord25Data } from './acord25Layout';
import { PDFDocument } from 'pdf-lib';
import type { AcordId } from '@/types';

/** Forms that can be sampled. The server enforces the same list (get_training_sample). */
export const SAMPLE_FORMS: AcordId[] = ['27', '25'];
export type SampleForm = '27' | '25';
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
  SAMPLE_NOT_AVAILABLE: 'Training samples are only available for the ACORD 27 and ACORD 25. (For the ACORD 25, run supabase/migrations/20261119090000_acord_25_module.sql in Supabase first.)',
  NO_PDF: 'Upload the fillable PDF for this form in Training Materials first.',
  GRADING_NOT_CONFIGURED: 'The answer key for this form is not set up yet. Run the answer-key SQL in Supabase, or open Field Mapping & Grading.',
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
 * Builds a watermarked training sample (ACORD 27 or ACORD 25) from the user's OWN information (what the AI read from
 * their question, notes and photos), instead of the practice scenario. Same watermark and 20-minute lifetime; nothing stored.
 */
export async function generateCustomTrainingSample(moduleId: SampleForm, data: Acord27Data | Acord25Data): Promise<TrainingSample> {
  const material = (await listMaterials({ moduleId })).find((m) => m.material_type === 'pdf' && m.is_current);
  if (!material) throw new Error(SAMPLE_ERRORS.NO_PDF);
  const master = await downloadMaterialBytes(material);
  const names = (await PDFDocument.load(master.slice(), { updateMetadata: false })).getForm().getFields().map((f) => f.getName());
  const values = moduleId === '27' ? acord27ToFieldValues(data as Acord27Data, names) : acord25ToFieldValues(data as Acord25Data, names);
  if (!values) {
    throw new Error(moduleId === '27'
      ? 'This ACORD 27 PDF edition is not supported for custom samples. Use the "Evidence Of Property Ins.pdf" (ACORD 27 2006/07).'
      : 'This ACORD 25 PDF edition is not supported for custom samples. Use the ACORD 25 (2016/03) fillable PDF.');
  }
  if (Object.keys(values).length === 0) {
    throw new Error(`I could not find any ACORD ${moduleId} details in your information. Add the policy, insured or ${moduleId === '27' ? 'lender' : 'certificate holder'} details and try again.`);
  }

  const createdAt = Date.now();
  const expiresAt = createdAt + SAMPLE_LIFETIME_MS;
  // The ACORD 27 edition has no field for the authorized representative, so the name is printed on the page.
  const rep = moduleId === '27' ? (data as Acord27Data).authorized_representative : undefined;
  const stamps = rep ? [{ text: rep, ...AUTHORIZED_REP_STAMP }] : [];
  const { bytes, fieldCount } = await buildTrainingSamplePdf(master, values, [], { moduleId, createdAt, expiresAt, source: 'built from your information' }, stamps);
  return {
    moduleId,
    fileName: `TRAINING-SAMPLE-ACORD-${moduleId}-custom.pdf`,
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
 * Recognises sample requests: "make a sample ACORD 27", "fill an ACORD 25 with this", "create a COI from my dec page".
 * Returns the form ('27' or '25'), 'other' (a sample of another form), or null (a normal question for the AI).
 */
export function parseSampleRequest(text: string): SampleForm | 'other' | null {
  const t = text.toLowerCase();
  const forms = t.match(/\bacord\s*#?\s*(25|27|125|126|127|130|140)\b|\b(25|27|125|126|127|130|140)\b/g)?.map((f) => f.replace(/\D/g, '')) ?? [];
  const mentions27 = forms.includes('27') || /\bevidence of property\b|\beop\b/.test(t);
  const mentions25 = forms.includes('25') || /\bcois?\b|\bcertificates? of (liability )?insurance\b|\bcertificate of liability\b/.test(t);
  const wantsSample = /\b(sample|example|specimen|mock|demo)\b/.test(t);
  // "fill / create / make an ACORD 27" counts too, but not questions like "how do I fill the ACORD 27?"
  const wantsFilled = /\b(fill|create|generate|make|build|prepare|produce|issue)\b/.test(t) && !/^\s*(how|what|why|where|when|who|which|can i|should i|do i)\b/.test(t);
  const mentionsForm = mentions27 || mentions25;
  if (!wantsSample && !(wantsFilled && mentionsForm)) return null;
  if (wantsSample && !mentionsForm && !/\b(acord|form)\b/.test(t)) return null;
  if (forms.some((f) => f !== '27' && f !== '25')) return 'other';
  if (mentions25 && !mentions27) return '25';
  if (mentions27 && !mentions25) return '27';
  if (mentions27 && mentions25) return forms.lastIndexOf('25') > forms.lastIndexOf('27') ? '25' : '27';
  return 'other'; // "a sample form" without saying which
}

/**
 * True when the sample should be built from the user's OWN information rather than the practice scenario:
 * a photo is attached, the message contains details (numbers, names, addresses), or it points at earlier messages.
 */
export function isCustomSampleRequest(text: string, hasImages: boolean, hasEarlierInfo: boolean): boolean {
  if (hasImages) return true;
  const rest = text.toLowerCase().replace(/\bacord\s*#?\s*(27|25)\b/g, '');
  if (/\d/.test(rest) || rest.length > 120) return true;
  return hasEarlierInfo && /\b(this|these|that|above|attached|uploaded|my|from|based on|using)\b/.test(rest);
}
