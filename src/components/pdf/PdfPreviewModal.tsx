import { useEffect, useState } from 'react';
import { AlertCircle, Eye, Loader2, Tags, X } from 'lucide-react';
import { PdfFormViewer } from '../PdfFormViewer';
import { Badge } from '../ui';
import { downloadMaterialBytes, getFormFields } from '@/lib/materialsService';
import { customFieldsToWidgets, loadPdfDocument, readWidgets, type PDFDocumentProxy } from '@/lib/pdf';
import type { PdfWidget, TrainingMaterial } from '@/types';

interface Props {
  material: TrainingMaterial;
  focusField?: string | null;
  onClose: () => void;
}

/** Trainer preview of an uploaded PDF exactly as students will see it. Values typed here are throw-away. */
export function PdfPreviewModal({ material, focusField, onClose }: Props) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [widgets, setWidgets] = useState<PdfWidget[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [showNames, setShowNames] = useState(Boolean(focusField));
  const [error, setError] = useState<string | null>(null);
  const [focus, setFocus] = useState<{ fieldName: string; nonce: number } | null>(null);

  useEffect(() => {
    let d: PDFDocumentProxy | null = null;
    (async () => {
      try {
        const [bytes, catalog] = await Promise.all([downloadMaterialBytes(material), getFormFields(material.id)]);
        d = await loadPdfDocument(bytes);
        const acro = await readWidgets(d);
        setWidgets([...acro, ...customFieldsToWidgets(catalog.filter((f) => f.source === 'custom'))]);
        setDoc(d);
      } catch (err) {
        setError((err as Error).message);
      }
    })();
    return () => { d?.loadingTask.destroy(); };
  }, [material]);

  useEffect(() => {
    if (doc && focusField) {
      const t = setTimeout(() => setFocus({ fieldName: focusField, nonce: Date.now() }), 400);
      return () => clearTimeout(t);
    }
  }, [doc, focusField]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex flex-col">
      <div className="flex items-center gap-3 px-5 py-3 border-b border-line-subtle bg-bg-surface">
        <Eye className="w-5 h-5 text-lava-400" />
        <div className="min-w-0">
          <div className="text-sm font-semibold text-white truncate">{material.file_name}</div>
          <div className="text-xs text-muted-500">Preview · {material.version} · entries here are not saved</div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => setShowNames((v) => !v)} className={`btn-ghost text-xs ${showNames ? 'text-cyan-400' : ''}`}><Tags className="w-4 h-4" /> Field names</button>
          <button onClick={onClose} className="btn-ghost p-2" aria-label="Close preview"><X className="w-5 h-5" /></button>
        </div>
      </div>
      <div className="flex-1 min-h-0 flex flex-col">
        {error ? (
          <div className="flex-1 flex items-center justify-center text-center"><div><AlertCircle className="w-8 h-8 text-lava-400 mx-auto" /><p className="text-sm text-lava-300 mt-2">{error}</p></div></div>
        ) : !doc ? (
          <div className="flex-1 flex items-center justify-center"><Loader2 className="w-8 h-8 text-muted-500 animate-spin" /></div>
        ) : (
          <PdfFormViewer
            doc={doc}
            widgets={widgets}
            values={values}
            onChange={(n, v) => setValues((p) => ({ ...p, [n]: v }))}
            focusRequest={focus}
            showFieldNames={showNames}
            toolbarLeft={<Badge variant={widgets.length ? 'success' : 'warning'}>{new Set(widgets.map((w) => w.fieldName)).size} interactive fields</Badge>}
          />
        )}
      </div>
    </div>
  );
}
