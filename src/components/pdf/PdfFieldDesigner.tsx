import { useCallback, useEffect, useRef, useState } from 'react';
import type { PageViewport } from 'pdfjs-dist';
import { AlertCircle, Loader2, MousePointerSquareDashed, Save, Trash2, X } from 'lucide-react';
import { PdfDocumentView, rectToBox } from './PdfDocumentView';
import { downloadMaterialBytes, getFormFields, saveCustomFields } from '@/lib/materialsService';
import { loadPdfDocument, type PDFDocumentProxy } from '@/lib/pdf';
import type { PdfFieldInfo, PdfFieldType, TrainingMaterial } from '@/types';

interface Props {
  material: TrainingMaterial;
  onClose: () => void;
  onSaved: () => void;
}

const TYPES: { value: PdfFieldType; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'date', label: 'Date (MM/DD/YYYY)' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'dropdown', label: 'Dropdown' },
];

/**
 * Field-mapping workflow for flattened (non-fillable) PDFs: the trainer draws interactive fields on top of the page.
 * Fields are stored in pdf_form_fields (source = 'custom') in PDF coordinates; the master PDF file is not modified.
 */
export function PdfFieldDesigner({ material, onClose, onSaved }: Props) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [fields, setFields] = useState<PdfFieldInfo[]>([]);
  const [acroCount, setAcroCount] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const drag = useRef<{ page: number; viewport: PageViewport; x0: number; y0: number; el: HTMLDivElement } | null>(null);
  const [ghost, setGhostState] = useState<{ page: number; left: number; top: number; width: number; height: number } | null>(null);
  const ghostRef = useRef<typeof ghost>(null);
  const setGhost = (g: typeof ghost) => { ghostRef.current = g; setGhostState(g); };

  useEffect(() => {
    let d: PDFDocumentProxy | null = null;
    (async () => {
      try {
        const [bytes, catalog] = await Promise.all([downloadMaterialBytes(material), getFormFields(material.id)]);
        d = await loadPdfDocument(bytes);
        setDoc(d);
        setFields(catalog.filter((f) => f.source === 'custom'));
        setAcroCount(catalog.filter((f) => f.source === 'acroform').length);
      } catch (err) {
        setError((err as Error).message);
      }
    })();
    return () => { d?.loadingTask.destroy(); };
  }, [material]);

  const onMouseDown = (e: React.MouseEvent<HTMLDivElement>, page: number, viewport: PageViewport) => {
    if (e.button !== 0 || (e.target as HTMLElement).dataset.field) return;
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    drag.current = { page, viewport, x0: e.clientX - r.left, y0: e.clientY - r.top, el };
    setGhost({ page, left: drag.current.x0, top: drag.current.y0, width: 0, height: 0 });
  };

  const onMouseMove = useCallback((e: MouseEvent) => {
    const d = drag.current;
    if (!d) return;
    const r = d.el.getBoundingClientRect();
    const x = Math.max(0, Math.min(r.width, e.clientX - r.left));
    const y = Math.max(0, Math.min(r.height, e.clientY - r.top));
    setGhost({ page: d.page, left: Math.min(d.x0, x), top: Math.min(d.y0, y), width: Math.abs(x - d.x0), height: Math.abs(y - d.y0) });
  }, []);

  const onMouseUp = useCallback(() => {
    const d = drag.current;
    const g = ghostRef.current;
    drag.current = null;
    setGhost(null);
    if (!d || !g || g.width <= 6 || g.height <= 6) return;
    const [x1, y1] = d.viewport.convertToPdfPoint(g.left, g.top + g.height) as number[];
    const [x2, y2] = d.viewport.convertToPdfPoint(g.left + g.width, g.top) as number[];
    const isBox = g.width < 28 && g.height < 28;
    setFields((prev) => {
      let i = prev.length + 1;
      while (prev.some((f) => f.name === `Page${d.page}.Field${i}`)) i++;
      const name = `Page${d.page}.Field${i}`;
      setSelected(name);
      return [...prev, {
        name, type: isBox ? 'checkbox' : 'text', page: d.page,
        rect: [x1, y1, x2, y2].map((n) => Math.round(n * 100) / 100),
        options: [], multiline: g.height > 40 * d.viewport.scale, maxLength: null, readOnly: false, tooltip: null, source: 'custom',
      }];
    });
    setDirty(true);
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => { window.removeEventListener('mousemove', onMouseMove); window.removeEventListener('mouseup', onMouseUp); };
  }, [onMouseMove, onMouseUp]);

  const sel = fields.find((f) => f.name === selected) ?? null;
  const patch = (p: Partial<PdfFieldInfo>) => {
    if (!sel) return;
    setFields((prev) => prev.map((f) => (f.name === sel.name ? { ...f, ...p } : f)));
    if (p.name) setSelected(p.name);
    setDirty(true);
  };
  const remove = (name: string) => { setFields((prev) => prev.filter((f) => f.name !== name)); setSelected(null); setDirty(true); };

  const nameError = sel && (!sel.name.trim() ? 'Name is required' : fields.filter((f) => f.name === sel.name).length > 1 ? 'Name must be unique' : null);

  const save = async () => {
    const dupes = fields.filter((f, i) => !f.name.trim() || fields.findIndex((g) => g.name === f.name) !== i);
    if (dupes.length) { setError('Every field needs a unique name.'); return; }
    setSaving(true); setError(null);
    try {
      await saveCustomFields(material, fields);
      setDirty(false);
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const renderOverlay = (page: number, viewport: PageViewport) => (
    <div className="absolute inset-0 cursor-crosshair" onMouseDown={(e) => onMouseDown(e, page, viewport)}>
      {fields.filter((f) => f.page === page && f.rect).map((f) => {
        const b = rectToBox(viewport, f.rect!);
        const active = f.name === selected;
        return (
          <div key={f.name} data-field="1" onMouseDown={(e) => { e.stopPropagation(); setSelected(f.name); }}
            className={`absolute border-2 cursor-pointer ${active ? 'border-lava-500 bg-lava-500/20' : 'border-sky-500 bg-sky-400/20 hover:bg-sky-400/35'}`}
            style={{ left: b.left, top: b.top, width: b.width, height: b.height }}>
            <span data-field="1" className={`absolute -top-4 left-0 text-[9px] px-1 rounded-sm text-white whitespace-nowrap ${active ? 'bg-lava-600' : 'bg-sky-600'}`}>{f.name}</span>
          </div>
        );
      })}
      {ghost && ghost.page === page && (
        <div className="absolute border-2 border-dashed border-lava-500 bg-lava-500/10 pointer-events-none" style={{ left: ghost.left, top: ghost.top, width: ghost.width, height: ghost.height }} />
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex flex-col">
      <div className="flex items-center gap-3 px-5 py-3 border-b border-line-subtle bg-bg-surface">
        <MousePointerSquareDashed className="w-5 h-5 text-lava-400" />
        <div className="min-w-0">
          <div className="text-sm font-semibold text-white">Field Designer — {material.file_name}</div>
          <div className="text-xs text-muted-500">Drag on the page to draw an interactive field. Small squares become checkboxes. The original PDF file is not modified.</div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {dirty && <span className="text-xs text-amber-400">Unsaved changes</span>}
          <button onClick={save} disabled={saving || !dirty} className="btn-primary py-2 text-xs">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save {fields.length} field{fields.length === 1 ? '' : 's'}
          </button>
          <button onClick={() => { if (!dirty || confirm('Discard unsaved field changes?')) onClose(); }} className="btn-ghost p-2"><X className="w-5 h-5" /></button>
        </div>
      </div>
      {error && <div className="px-5 py-2 text-xs text-lava-300 bg-lava-600/10 border-b border-lava-600/20 flex items-center gap-2"><AlertCircle className="w-4 h-4" /> {error}</div>}
      {acroCount > 0 && <div className="px-5 py-2 text-xs text-cyan-300 bg-cyan-500/10 border-b border-cyan-500/20">This PDF already has {acroCount} native AcroForm fields. Designer fields are added on top of them.</div>}
      <div className="flex-1 min-h-0 flex">
        <div className="flex-1 min-w-0 flex flex-col">
          {doc ? <PdfDocumentView doc={doc} annotationMode="all" renderOverlay={renderOverlay} /> : (
            <div className="flex-1 flex items-center justify-center"><Loader2 className="w-8 h-8 text-muted-500 animate-spin" /></div>
          )}
        </div>
        <aside className="w-80 shrink-0 border-l border-line-subtle bg-bg-surface overflow-y-auto p-4 space-y-4">
          {sel ? (
            <div className="space-y-3">
              <div className="text-xs font-semibold text-muted-400 uppercase tracking-wider">Selected field · page {sel.page}</div>
              <div>
                <label className="label">Field name</label>
                <input value={sel.name} onChange={(e) => patch({ name: e.target.value.replace(/\s+/g, '_') })} className="input text-xs mt-1 font-mono" />
                {nameError && <p className="text-[11px] text-lava-400 mt-1">{nameError}</p>}
                <p className="text-[11px] text-muted-500 mt-1">Use a meaningful name, e.g. NamedInsured or Policy.EffectiveDate.</p>
              </div>
              <div>
                <label className="label">Type</label>
                <select value={sel.type} onChange={(e) => patch({ type: e.target.value as PdfFieldType })} className="input text-xs mt-1 cursor-pointer">
                  {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              {sel.type === 'dropdown' && (
                <div>
                  <label className="label">Options (one per line)</label>
                  <textarea rows={4} value={sel.options.map((o) => o.label).join('\n')}
                    onChange={(e) => patch({ options: e.target.value.split('\n').map((v) => v.trim()).filter(Boolean).map((v) => ({ value: v, label: v })) })}
                    className="input text-xs mt-1" />
                </div>
              )}
              {sel.type === 'text' && (
                <label className="flex items-center gap-2 text-xs text-muted-400 cursor-pointer">
                  <input type="checkbox" checked={sel.multiline} onChange={(e) => patch({ multiline: e.target.checked })} /> Multi-line
                </label>
              )}
              <div>
                <label className="label">Tooltip / label (optional)</label>
                <input value={sel.tooltip ?? ''} onChange={(e) => patch({ tooltip: e.target.value || null })} className="input text-xs mt-1" placeholder="Shown to students on hover" />
              </div>
              <button onClick={() => remove(sel.name)} className="btn-ghost text-xs text-lava-400 hover:text-lava-300"><Trash2 className="w-3.5 h-3.5" /> Delete field</button>
            </div>
          ) : (
            <p className="text-xs text-muted-500">Select a field to edit it, or drag on the page to create one.</p>
          )}
          <div className="pt-3 border-t border-line-subtle">
            <div className="text-xs font-semibold text-muted-400 uppercase tracking-wider mb-2">All designer fields ({fields.length})</div>
            <div className="space-y-1">
              {fields.map((f) => (
                <button key={f.name} onClick={() => setSelected(f.name)}
                  className={`w-full text-left px-2 py-1.5 rounded text-xs font-mono truncate ${f.name === selected ? 'bg-bg-elevated text-white' : 'text-muted-400 hover:bg-bg-hover'}`}>
                  p.{f.page} · {f.name} <span className="text-muted-600">({f.type})</span>
                </button>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
