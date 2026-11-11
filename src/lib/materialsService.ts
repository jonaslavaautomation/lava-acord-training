import { supabase, BUCKETS, buildMaterialPath } from './supabase';
import { uploadResumable } from './upload';
import { formatFileSize, type PdfAnalysis } from './pdf';
import type {
  AcordId,
  MaterialType,
  PdfFieldInfo,
  PdfFieldMapping,
  ScenarioFact,
  TrainingMaterial,
} from '@/types';

export const VIDEO_EXTS = ['.mp4', '.webm', '.ogg', '.ogv', '.mov', '.m4v'];
export const VIDEO_MIME: Record<string, string> = {
  '.mp4': 'video/mp4', '.m4v': 'video/mp4', '.webm': 'video/webm', '.ogg': 'video/ogg', '.ogv': 'video/ogg', '.mov': 'video/quicktime',
};
export const MAX_VIDEO_BYTES = 5 * 1024 * 1024 * 1024; // Supabase resumable-upload ceiling
export const MAX_PDF_BYTES = 50 * 1024 * 1024;
export const MAX_SUPPORTING_BYTES = 100 * 1024 * 1024;

function ext(name: string): string {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i).toLowerCase() : '';
}

export function validateVideoFile(file: File): string | null {
  if (!file.type.startsWith('video/') && !VIDEO_EXTS.includes(ext(file.name))) {
    return 'Unsupported video format. Upload MP4, WebM, MOV, M4V or OGG.';
  }
  if (file.size > MAX_VIDEO_BYTES) return `File too large (${formatFileSize(file.size)}). Maximum is 5 GB.`;
  if (file.size === 0) return 'The file is empty.';
  return null;
}

export function validatePdfFile(file: File): string | null {
  if (file.type !== 'application/pdf' && ext(file.name) !== '.pdf') return 'Unsupported file type. Upload a PDF.';
  if (file.size > MAX_PDF_BYTES) return `File too large (${formatFileSize(file.size)}). Maximum PDF size is 50 MB.`;
  if (file.size === 0) return 'The file is empty.';
  return null;
}

export function validateSupportingFile(file: File): string | null {
  if (file.size > MAX_SUPPORTING_BYTES) return `File too large (${formatFileSize(file.size)}). Maximum is 100 MB.`;
  if (file.size === 0) return 'The file is empty.';
  return null;
}

/** Read a video's duration in the browser (stored server-side to validate watch progress). */
export function probeVideoDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement('video');
    v.preload = 'metadata';
    const done = (d: number | null) => { URL.revokeObjectURL(url); resolve(d); };
    v.onloadedmetadata = () => done(Number.isFinite(v.duration) && v.duration > 0 ? Math.round(v.duration * 100) / 100 : null);
    v.onerror = () => done(null);
    setTimeout(() => done(null), 15000);
    v.src = url;
  });
}

function rowToMaterial(r: Record<string, unknown>): TrainingMaterial {
  return { ...(r as unknown as TrainingMaterial), file_size: Number(r.file_size ?? 0), duration_seconds: r.duration_seconds == null ? null : Number(r.duration_seconds) };
}

// ---------------------------------------------------------------- queries

/** Current materials for one or all modules (RLS hides archived versions from students). */
export async function listMaterials(opts: { moduleId?: AcordId; includeHistory?: boolean } = {}): Promise<TrainingMaterial[]> {
  let q = supabase.from('training_materials').select('*')
    .order('material_type').order('lesson_order').order('version_number', { ascending: false });
  if (opts.moduleId) q = q.eq('module_id', opts.moduleId);
  if (!opts.includeHistory) q = q.eq('is_current', true);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToMaterial);
}

const signedUrlCache = new Map<string, { url: string; expires: number }>();

export async function getSignedUrl(material: Pick<TrainingMaterial, 'storage_bucket' | 'storage_path'>, opts: { download?: string } = {}): Promise<string> {
  const key = `${material.storage_bucket}/${material.storage_path}/${opts.download ?? ''}`;
  const hit = signedUrlCache.get(key);
  if (hit && hit.expires > Date.now() + 60_000) return hit.url;
  const ttl = 60 * 60 * 4;
  const { data, error } = await supabase.storage.from(material.storage_bucket)
    .createSignedUrl(material.storage_path, ttl, opts.download ? { download: opts.download } : undefined);
  if (error || !data) throw new Error(error?.message ?? 'Could not create file link');
  signedUrlCache.set(key, { url: data.signedUrl, expires: Date.now() + ttl * 1000 });
  return data.signedUrl;
}

export async function downloadBytes(bucket: string, path: string): Promise<Uint8Array> {
  const { data, error } = await supabase.storage.from(bucket).download(path);
  if (error || !data) throw new Error(`Download failed: ${error?.message ?? 'unknown error'}`);
  return new Uint8Array(await data.arrayBuffer());
}

export function downloadMaterialBytes(m: TrainingMaterial): Promise<Uint8Array> {
  return downloadBytes(m.storage_bucket, m.storage_path);
}

// ---------------------------------------------------------------- uploads

export interface UploadMaterialInput {
  moduleId: AcordId;
  type: MaterialType;
  file: File;
  /** Replace an existing lesson/asset (creates a new version). Omit to add a new asset. PDFs always use the module's single slot. */
  assetKey?: string;
  title?: string;
  description?: string;
  lessonOrder?: number;
  isRequired?: boolean;
  versionLabel?: string;
  durationSeconds?: number | null;
  pdf?: PdfAnalysis;
  onProgress?: (pct: number) => void;
  onPhase?: (phase: 'uploading' | 'saving') => void;
  registerAbort?: (abort: () => void) => void;
}

export async function uploadMaterial(input: UploadMaterialInput): Promise<TrainingMaterial> {
  const { moduleId, type, file } = input;
  const path = buildMaterialPath(moduleId, type, file.name);
  const contentType = type === 'pdf'
    ? 'application/pdf'
    : file.type || VIDEO_MIME[ext(file.name)] || 'application/octet-stream';

  // Previous current PDF (to carry its grading configuration over to the new version).
  let previousPdf: TrainingMaterial | null = null;
  if (type === 'pdf') {
    const { data } = await supabase.from('training_materials').select('*')
      .eq('module_id', moduleId).eq('material_type', 'pdf').eq('is_current', true).maybeSingle();
    previousPdf = data ? rowToMaterial(data) : null;
  }

  input.onPhase?.('uploading');
  const handle = uploadResumable({ bucket: BUCKETS.TRAINING, path, file, contentType, onProgress: (p) => input.onProgress?.(p) });
  input.registerAbort?.(handle.abort);
  await handle.promise;

  input.onPhase?.('saving');
  const row: Record<string, unknown> = {
    module_id: moduleId,
    material_type: type,
    file_name: file.name,
    file_size: file.size,
    storage_path: path,
    storage_bucket: BUCKETS.TRAINING,
    mime_type: contentType,
    title: input.title?.trim() || null,
    description: input.description?.trim() || null,
    version: input.versionLabel?.trim() || null,
    lesson_order: input.lessonOrder ?? 1,
    is_required: input.isRequired ?? true,
    duration_seconds: input.durationSeconds ?? null,
    page_count: input.pdf?.pageCount ?? null,
    is_fillable: input.pdf?.isFillable ?? false,
    is_encrypted: input.pdf?.isEncrypted ?? false,
    field_count: input.pdf ? input.pdf.fields.filter((f) => f.type !== 'button').length : 0,
  };
  if (input.assetKey) row.asset_key = input.assetKey;

  const { data, error } = await supabase.from('training_materials').insert(row).select().single();
  if (error || !data) {
    await supabase.storage.from(BUCKETS.TRAINING).remove([path]);
    throw new Error(`Could not save file record: ${error?.message ?? 'unknown error'}`);
  }
  const material = rowToMaterial(data);

  if (type === 'pdf' && input.pdf) {
    await saveFieldCatalog(material.id, input.pdf.fields.filter((f) => f.type !== 'button'));
    if (previousPdf) {
      await supabase.rpc('copy_field_mappings', { p_from: previousPdf.id, p_to: material.id });
      // Custom (designer) fields only apply to the exact PDF they were drawn on, so they are not carried over.
    }
    await ensureDefaultMappings(material);
  }
  return material;
}

export async function updateMaterialMeta(id: string, patch: Partial<Pick<TrainingMaterial, 'title' | 'description' | 'is_required' | 'lesson_order' | 'version'>>): Promise<void> {
  const { error } = await supabase.from('training_materials').update(patch).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function setCurrentVersion(id: string): Promise<void> {
  const { error } = await supabase.rpc('set_current_material', { p_material_id: id });
  if (error) throw new Error(error.message);
}

/** Delete one version (row + stored object). Deleting the current version promotes the previous one. */
export async function deleteMaterial(m: TrainingMaterial): Promise<void> {
  const { error } = await supabase.from('training_materials').delete().eq('id', m.id);
  if (error) throw new Error(error.message);
  const { error: sErr } = await supabase.storage.from(m.storage_bucket).remove([m.storage_path]);
  if (sErr) console.warn('Stored file could not be removed:', sErr.message);
}

/** Delete every version of an asset (e.g. an obsolete lesson). */
export async function deleteAsset(assetKey: string): Promise<void> {
  const { data, error } = await supabase.from('training_materials').select('*').eq('asset_key', assetKey);
  if (error) throw new Error(error.message);
  for (const r of data ?? []) await deleteMaterial(rowToMaterial(r));
}

// ---------------------------------------------------------------- field catalog

function fieldToRow(materialId: string, f: PdfFieldInfo) {
  return {
    material_id: materialId,
    field_name: f.name,
    field_type: f.type,
    source: f.source,
    page_number: f.page,
    rect: f.rect,
    options: f.options,
    multiline: f.multiline,
    max_length: f.maxLength,
    read_only: f.readOnly,
    tooltip: f.tooltip,
  };
}

function rowToField(r: Record<string, unknown>): PdfFieldInfo {
  return {
    name: String(r.field_name),
    type: r.field_type as PdfFieldInfo['type'],
    page: Number(r.page_number),
    rect: (r.rect as number[] | null)?.map(Number) ?? null,
    options: (r.options as PdfFieldInfo['options']) ?? [],
    multiline: Boolean(r.multiline),
    maxLength: (r.max_length as number | null) ?? null,
    readOnly: Boolean(r.read_only),
    tooltip: (r.tooltip as string | null) ?? null,
    source: r.source as PdfFieldInfo['source'],
  };
}

async function saveFieldCatalog(materialId: string, fields: PdfFieldInfo[]): Promise<void> {
  if (fields.length === 0) return;
  for (let i = 0; i < fields.length; i += 500) {
    const { error } = await supabase.from('pdf_form_fields')
      .upsert(fields.slice(i, i + 500).map((f) => fieldToRow(materialId, f)), { onConflict: 'material_id,field_name' });
    if (error) throw new Error(`Could not save PDF field list: ${error.message}`);
  }
}

export async function getFormFields(materialId: string): Promise<PdfFieldInfo[]> {
  const { data, error } = await supabase.from('pdf_form_fields').select('*').eq('material_id', materialId)
    .order('page_number').order('field_name');
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToField);
}

/** Replace the trainer-drawn fields for a (flattened) PDF and keep mappings in sync. */
export async function saveCustomFields(material: TrainingMaterial, fields: PdfFieldInfo[]): Promise<void> {
  const existing = (await getFormFields(material.id)).filter((f) => f.source === 'custom');
  const keep = new Set(fields.map((f) => f.name));
  const removed = existing.filter((f) => !keep.has(f.name)).map((f) => f.name);
  if (removed.length) {
    await supabase.from('pdf_form_fields').delete().eq('material_id', material.id).eq('source', 'custom').in('field_name', removed);
    await supabase.from('pdf_field_mappings').delete().eq('material_id', material.id).in('pdf_field_name', removed);
  }
  await saveFieldCatalog(material.id, fields.map((f) => ({ ...f, source: 'custom' as const })));
  const all = await getFormFields(material.id);
  await supabase.from('training_materials').update({ field_count: all.length }).eq('id', material.id);
  await ensureDefaultMappings(material);
}

// ---------------------------------------------------------------- grading configuration (staff only by RLS)

function humanize(name: string): string {
  const last = name.split('.').pop() ?? name;
  return last.replace(/\[\d+\]/g, '').replace(/[_-]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/\s+/g, ' ').trim();
}

/** Create an (unconfigured) mapping row for every field that has none yet. */
export async function ensureDefaultMappings(material: TrainingMaterial): Promise<void> {
  const fields = await getFormFields(material.id);
  const { data: existing } = await supabase.from('pdf_field_mappings').select('pdf_field_name').eq('material_id', material.id);
  const have = new Set((existing ?? []).map((r) => r.pdf_field_name as string));
  const rows = fields.filter((f) => !have.has(f.name) && f.type !== 'signature').map((f) => ({
    module_id: material.module_id,
    material_id: material.id,
    pdf_field_name: f.name,
    pdf_field_type: f.type,
    scenario_label: f.tooltip || humanize(f.name),
    expected_value: '',
    match_type: f.type === 'checkbox' || f.type === 'dropdown' || f.type === 'radio' || f.type === 'date' ? 'exact' : 'contains',
    points: 1,
    required: false,
    missing_rule: 'penalize',
    is_scored: true,
    page_number: f.page,
  }));
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await supabase.from('pdf_field_mappings').insert(rows.slice(i, i + 500));
    if (error) throw new Error(`Could not create field mappings: ${error.message}`);
  }
}

export async function getMappings(materialId: string): Promise<PdfFieldMapping[]> {
  const { data, error } = await supabase.from('pdf_field_mappings').select('*').eq('material_id', materialId)
    .order('page_number').order('pdf_field_name');
  if (error) throw new Error(error.message);
  return (data ?? []) as PdfFieldMapping[];
}

export async function saveMappings(rows: PdfFieldMapping[]): Promise<void> {
  const payload = rows.map((r) => ({
    module_id: r.module_id,
    material_id: r.material_id,
    pdf_field_name: r.pdf_field_name,
    pdf_field_type: r.pdf_field_type,
    scenario_label: r.scenario_label,
    scenario_fact_key: r.scenario_fact_key,
    expected_value: r.expected_value ?? '',
    match_type: r.match_type,
    points: Math.max(0, Math.round(r.points)),
    required: r.required,
    missing_rule: r.missing_rule,
    feedback_hint: r.feedback_hint?.trim() || null,
    is_scored: r.is_scored,
    page_number: r.page_number,
    updated_at: new Date().toISOString(),
  }));
  for (let i = 0; i < payload.length; i += 500) {
    const { error } = await supabase.from('pdf_field_mappings').upsert(payload.slice(i, i + 500), { onConflict: 'material_id,pdf_field_name' });
    if (error) throw new Error(error.message);
  }
}

export async function getScenarioFacts(moduleId: AcordId): Promise<ScenarioFact[]> {
  const { data, error } = await supabase.from('scenario_facts').select('*').eq('module_id', moduleId).order('sort_order');
  if (error) throw new Error(error.message);
  return (data ?? []) as ScenarioFact[];
}
