import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument } from 'pdf-lib';
import type { PDFDocumentProxy } from 'pdfjs-dist';
// Bundle the worker with the app (no third-party CDN at runtime).
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { PdfFieldInfo, PdfFieldOption, PdfFieldType, PdfWidget } from '@/types';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export { pdfjsLib };
export type { PDFDocumentProxy };

const DATE_NAME_RE = /(date|\bdt\b|_dt|dt_|effective|expiration|expiry|\bexp\b|dob|birth)/i;

export class PdfValidationError extends Error {}

export function hasPdfHeader(bytes: Uint8Array): boolean {
  // The "%PDF-" signature must appear within the first 1024 bytes.
  const head = bytes.subarray(0, Math.min(1024, bytes.length));
  for (let i = 0; i < head.length - 4; i++) {
    if (head[i] === 0x25 && head[i + 1] === 0x50 && head[i + 2] === 0x44 && head[i + 3] === 0x46 && head[i + 4] === 0x2d) return true;
  }
  return false;
}

/** pdf.js transfers (detaches) the buffer it is given, so always hand it a copy. */
export function loadPdfDocument(bytes: Uint8Array): Promise<PDFDocumentProxy> {
  return pdfjsLib.getDocument({ data: bytes.slice() }).promise;
}

function mapFieldType(a: Record<string, unknown>): PdfFieldType {
  switch (a.fieldType) {
    case 'Tx': {
      const name = `${a.fieldName ?? ''} ${a.alternativeText ?? ''}`;
      return DATE_NAME_RE.test(name) ? 'date' : 'text';
    }
    case 'Btn':
      if (a.checkBox) return 'checkbox';
      if (a.radioButton) return 'radio';
      return 'button';
    case 'Ch':
      return 'dropdown';
    case 'Sig':
      return 'signature';
    default:
      return 'unknown';
  }
}

function mapOptions(a: Record<string, unknown>): PdfFieldOption[] {
  const opts = (a.options as { exportValue?: string; displayValue?: string }[] | undefined) ?? [];
  return opts.map((o) => ({ value: String(o.exportValue ?? o.displayValue ?? ''), label: String(o.displayValue ?? o.exportValue ?? '') }));
}

/** Read every interactive widget on every page (AcroForm). */
export async function readWidgets(doc: PDFDocumentProxy): Promise<PdfWidget[]> {
  const widgets: PdfWidget[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const annotations = (await page.getAnnotations()) as Record<string, unknown>[];
    for (const a of annotations) {
      if (a.subtype !== 'Widget' || !a.fieldName) continue;
      const type = mapFieldType(a);
      const align = a.textAlignment === 1 ? 'center' : a.textAlignment === 2 ? 'right' : 'left';
      const fontSize = (a.defaultAppearanceData as { fontSize?: number } | undefined)?.fontSize;
      widgets.push({
        id: String(a.id),
        fieldName: String(a.fieldName),
        type,
        page: p,
        rect: (a.rect as number[]).map(Number),
        exportValue: type === 'checkbox' ? String(a.exportValue ?? 'Yes') : type === 'radio' ? String(a.buttonValue ?? '') : undefined,
        options: type === 'dropdown' ? mapOptions(a) : [],
        multiline: Boolean(a.multiLine),
        maxLength: typeof a.maxLen === 'number' && a.maxLen > 0 ? a.maxLen : null,
        readOnly: Boolean(a.readOnly),
        comb: Boolean(a.comb),
        textAlign: align,
        fontSize: fontSize && fontSize > 0 ? fontSize : null,
        tooltip: a.alternativeText ? String(a.alternativeText) : null,
      });
    }
  }
  return widgets;
}

/** Collapse widgets into one catalog entry per field (radio groups list their buttons as options). */
export function widgetsToFields(widgets: PdfWidget[]): PdfFieldInfo[] {
  const byName = new Map<string, PdfFieldInfo>();
  for (const w of widgets) {
    const existing = byName.get(w.fieldName);
    if (existing) {
      if (w.type === 'radio' && w.exportValue && !existing.options.some((o) => o.value === w.exportValue)) {
        existing.options.push({ value: w.exportValue, label: w.exportValue });
      }
      continue;
    }
    byName.set(w.fieldName, {
      name: w.fieldName,
      type: w.type,
      page: w.page,
      rect: w.rect,
      options: w.type === 'radio' && w.exportValue ? [{ value: w.exportValue, label: w.exportValue }] : w.options,
      multiline: w.multiline,
      maxLength: w.maxLength,
      readOnly: w.readOnly,
      tooltip: w.tooltip,
      source: 'acroform',
    });
  }
  return [...byName.values()];
}

/** Custom (trainer-drawn) fields for flattened PDFs are turned into widgets for the viewer. */
export function customFieldsToWidgets(fields: PdfFieldInfo[]): PdfWidget[] {
  return fields
    .filter((f) => f.rect && f.rect.length === 4)
    .map((f) => ({
      id: `custom:${f.name}`,
      fieldName: f.name,
      type: f.type,
      page: f.page,
      rect: f.rect as number[],
      exportValue: f.type === 'checkbox' ? 'Yes' : undefined,
      options: f.options,
      multiline: f.multiline,
      maxLength: f.maxLength,
      readOnly: false,
      comb: false,
      textAlign: 'left' as const,
      fontSize: null,
      tooltip: f.tooltip,
    }));
}

export interface PdfAnalysis {
  pageCount: number;
  fields: PdfFieldInfo[];
  /** Has real, editable AcroForm fields (excluding push buttons / signatures). */
  isFillable: boolean;
  isEncrypted: boolean;
  isPureXfa: boolean;
  warnings: string[];
}

/**
 * Validate that a file is a readable PDF and inventory its interactive fields.
 * Throws PdfValidationError for anything that is not a readable PDF.
 */
export async function analyzePdf(bytes: Uint8Array): Promise<PdfAnalysis> {
  if (!hasPdfHeader(bytes)) throw new PdfValidationError('This file is not a PDF (missing %PDF header).');

  let doc: PDFDocumentProxy;
  try {
    doc = await loadPdfDocument(bytes);
  } catch (err) {
    const name = (err as { name?: string }).name;
    if (name === 'PasswordException') throw new PdfValidationError('This PDF is password-protected and cannot be opened. Upload an unlocked copy.');
    throw new PdfValidationError(`The PDF could not be read: ${(err as Error).message || 'invalid or corrupted file'}.`);
  }

  const warnings: string[] = [];
  const isPureXfa = Boolean((doc as unknown as { isPureXfa?: boolean }).isPureXfa);
  if (isPureXfa) {
    warnings.push('This is an XFA (LiveCycle) form. XFA forms are not supported for in-browser filling — upload the AcroForm version of the PDF.');
  }

  const widgets = await readWidgets(doc);
  const fields = widgetsToFields(widgets);
  const editable = fields.filter((f) => f.type !== 'button' && f.type !== 'signature' && !f.readOnly);

  let isEncrypted = false;
  try {
    await PDFDocument.load(bytes, { updateMetadata: false });
  } catch (err) {
    if ((err as Error).message?.toLowerCase().includes('encrypt')) {
      isEncrypted = true;
      warnings.push('This PDF is encrypted (owner restrictions). Students can still fill and submit it, but a completed PDF copy may not be generated. Upload an unsecured version if possible.');
    }
  }

  if (editable.length === 0) {
    warnings.push('No editable form fields were detected. This PDF appears to be flattened. Use the Field Designer to add interactive fields before students can complete it.');
  }

  const pageCount = doc.numPages;
  await doc.loadingTask.destroy();
  return { pageCount, fields, isFillable: editable.length > 0, isEncrypted, isPureXfa, warnings };
}

/** Format digits typed into a date field as MM/DD/YYYY. */
export function formatDateInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

export function isValidDateString(v: string): boolean {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v);
  if (!m) return false;
  const [mm, dd, yyyy] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(yyyy, mm - 1, dd);
  return d.getFullYear() === yyyy && d.getMonth() === mm - 1 && d.getDate() === dd;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
