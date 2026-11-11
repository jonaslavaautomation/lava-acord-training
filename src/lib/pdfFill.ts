import {
  PDFDocument,
  PDFCheckBox,
  PDFDropdown,
  PDFOptionList,
  PDFRadioGroup,
  PDFTextField,
  StandardFonts,
  rgb,
} from 'pdf-lib';
import type { PdfFieldInfo } from '@/types';

export interface FillResult {
  bytes: Uint8Array;
  skipped: string[];
}

/**
 * Produce a completed copy of the master PDF with the student's values.
 * The master bytes are only read; a new document is serialized.
 * - AcroForm fields are filled in place (the result remains a fillable PDF).
 * - Trainer-drawn custom fields (flattened PDFs) are stamped as text at their rectangles.
 */
export async function fillPdf(masterBytes: Uint8Array, values: Record<string, string>, customFields: PdfFieldInfo[] = []): Promise<FillResult> {
  const doc = await PDFDocument.load(masterBytes.slice(), { updateMetadata: false });
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const skipped: string[] = [];
  const customNames = new Set(customFields.map((f) => f.name));

  const form = doc.getForm();
  for (const field of form.getFields()) {
    const name = field.getName();
    if (customNames.has(name) || !(name in values)) continue;
    const value = values[name] ?? '';
    try {
      if (field instanceof PDFTextField) {
        const max = field.getMaxLength();
        field.setText(max ? value.slice(0, max) : value);
      } else if (field instanceof PDFCheckBox) {
        if (value === 'true') field.check();
        else field.uncheck();
      } else if (field instanceof PDFRadioGroup) {
        if (value && field.getOptions().includes(value)) field.select(value);
        else field.clear();
      } else if (field instanceof PDFDropdown) {
        if (!value) field.clear();
        else if (field.getOptions().includes(value) || field.isEditable()) field.select(value);
        else skipped.push(name);
      } else if (field instanceof PDFOptionList) {
        if (value && field.getOptions().includes(value)) field.select(value);
      }
    } catch {
      skipped.push(name);
    }
  }
  try {
    form.updateFieldAppearances(font);
  } catch {
    // Some third-party fonts cannot be re-encoded; values are still stored in the fields.
  }

  const pages = doc.getPages();
  for (const f of customFields) {
    const value = values[f.name];
    if (!value || !f.rect || !pages[f.page - 1]) continue;
    const page = pages[f.page - 1];
    const [x1, y1, x2, y2] = f.rect;
    const h = Math.abs(y2 - y1);
    const w = Math.abs(x2 - x1);
    if (f.type === 'checkbox') {
      if (value === 'true') {
        const size = Math.min(h, w) * 0.9;
        page.drawText('X', { x: Math.min(x1, x2) + (w - size * 0.6) / 2, y: Math.min(y1, y2) + (h - size * 0.7) / 2, size, font, color: rgb(0, 0, 0) });
      }
      continue;
    }
    const size = Math.max(6, Math.min(11, h * 0.7));
    let text = value;
    while (text.length > 1 && font.widthOfTextAtSize(text, size) > w - 2) text = text.slice(0, -1);
    page.drawText(text, { x: Math.min(x1, x2) + 2, y: Math.min(y1, y2) + (h - size) / 2 + 1, size, font, color: rgb(0, 0, 0.55) });
  }

  return { bytes: await doc.save(), skipped };
}
