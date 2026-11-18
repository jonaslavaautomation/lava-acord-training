import { PDFButton, PDFDocument, PDFTextField, StandardFonts, degrees, rgb } from 'pdf-lib';
import { fillPdf } from './pdfFill';
import type { PdfFieldInfo } from '@/types';

const stamp = (ms: number) =>
  new Date(ms).toLocaleString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric', hour: 'numeric', minute: '2-digit' });

/**
 * Fills the master PDF with the sample values, flattens it (so it can't be edited or passed off as a real form)
 * and stamps "TRAINING PURPOSES ONLY" across every page plus a banner with the creation and expiry time.
 * Pure: no network, no storage. The master bytes are only read.
 */
export async function buildTrainingSamplePdf(
  master: Uint8Array,
  sampleValues: Record<string, string>,
  customFields: PdfFieldInfo[],
  meta: { moduleId: string; createdAt: number; expiresAt: number },
): Promise<{ bytes: Uint8Array; fieldCount: number }> {
  // Single-line boxes can't show line breaks: join address lines with commas there.
  const values = { ...sampleValues };
  const probe = await PDFDocument.load(master.slice(), { updateMetadata: false });
  for (const field of probe.getForm().getFields()) {
    const name = field.getName();
    if (field instanceof PDFTextField && values[name]?.includes('\n') && !field.isMultiline()) {
      values[name] = values[name].replace(/\s*\n\s*/g, ', ');
    }
  }

  const { bytes: filled } = await fillPdf(master, values, customFields);

  const doc = await PDFDocument.load(filled, { updateMetadata: false });
  try {
    const form = doc.getForm();
    for (const f of form.getFields()) if (f instanceof PDFButton) form.removeField(f); // e.g. the form's "Clear All" button
    form.flatten();
  } catch { /* already flat */ }
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const banner = `TRAINING SAMPLE - NOT EVIDENCE OF INSURANCE - fictional data - created ${stamp(meta.createdAt)}, expires ${stamp(meta.expiresAt)}`;
  const red = rgb(0.86, 0.1, 0.18);

  for (const page of doc.getPages()) {
    const { width, height } = page.getSize();
    const text = 'TRAINING PURPOSES ONLY';
    const size = Math.min(width, height) / 9;
    const w = bold.widthOfTextAtSize(text, size);
    const angle = Math.atan2(height, width);
    page.drawText(text, {
      x: width / 2 - (w / 2) * Math.cos(angle) + (size / 3) * Math.sin(angle),
      y: height / 2 - (w / 2) * Math.sin(angle) - (size / 3) * Math.cos(angle),
      size, font: bold, color: red, opacity: 0.16, rotate: degrees((angle * 180) / Math.PI),
    });
    let bannerSize = 7.5;
    while (bannerSize > 5 && regular.widthOfTextAtSize(banner, bannerSize) > width - 24) bannerSize -= 0.5;
    for (const y of [height - 11, 4]) page.drawText(banner, { x: 12, y, size: bannerSize, font: regular, color: red, opacity: 0.9 });
  }
  doc.setTitle(`TRAINING SAMPLE - ACORD ${meta.moduleId}`);
  doc.setSubject('Training purposes only. Not evidence of insurance.');
  return { bytes: await doc.save(), fieldCount: Object.keys(values).length };
}
