import { memo, useCallback, useEffect, useMemo, type ReactNode } from 'react';
import type { PageViewport } from 'pdfjs-dist';
import type { PDFDocumentProxy } from '@/lib/pdf';
import { formatDateInput } from '@/lib/pdf';
import type { PdfWidget } from '@/types';
import { PdfDocumentView, rectToBox } from './pdf/PdfDocumentView';

export interface PdfFormViewerProps {
  doc: PDFDocumentProxy;
  widgets: PdfWidget[];
  values: Record<string, string>;
  onChange: (fieldName: string, value: string) => void;
  requiredFields?: Set<string>;
  readOnly?: boolean;
  /** Ask the viewer to scroll to and focus a field. */
  focusRequest?: { fieldName: string; nonce: number } | null;
  toolbarLeft?: ReactNode;
  toolbarRight?: ReactNode;
  showFieldNames?: boolean;
}

export function PdfFormViewer({ doc, widgets, values, onChange, requiredFields, readOnly, focusRequest, toolbarLeft, toolbarRight, showFieldNames }: PdfFormViewerProps) {
  const byPage = useMemo(() => {
    const map = new Map<number, PdfWidget[]>();
    for (const w of widgets) {
      if (w.type === 'button' || w.type === 'signature') continue;
      const list = map.get(w.page) ?? [];
      list.push(w);
      map.set(w.page, list);
    }
    // Natural tab order: top-to-bottom, then left-to-right (PDF y grows upward).
    map.forEach((list) => list.sort((a, b) => (Math.round(b.rect[3] / 4) - Math.round(a.rect[3] / 4)) || a.rect[0] - b.rect[0]));
    return map;
  }, [widgets]);

  useEffect(() => {
    if (!focusRequest) return;
    const w = widgets.find((x) => x.fieldName === focusRequest.fieldName);
    if (!w) return;
    // Overlay inputs exist for every page (even before its canvas renders), so scroll straight to it.
    const el = document.querySelector<HTMLElement>(`[data-widget-id="${CSS.escape(w.id)}"]`);
    el?.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });
    const t = setTimeout(() => el?.focus({ preventScroll: true }), 450);
    return () => clearTimeout(t);
  }, [focusRequest, widgets]);

  const renderOverlay = useCallback((page: number, viewport: PageViewport) => (
    <>
      {(byPage.get(page) ?? []).map((w) => (
        <WidgetInput
          key={w.id}
          widget={w}
          viewport={viewport}
          value={values[w.fieldName] ?? ''}
          onChange={onChange}
          required={requiredFields?.has(w.fieldName) ?? false}
          readOnly={readOnly || w.readOnly}
          showName={showFieldNames}
        />
      ))}
    </>
  ), [byPage, values, onChange, requiredFields, readOnly, showFieldNames]);

  return (
    <PdfDocumentView
      doc={doc}
      annotationMode="forms"
      renderOverlay={renderOverlay}
      toolbarLeft={toolbarLeft}
      toolbarRight={toolbarRight}
    />
  );
}

interface WidgetInputProps {
  widget: PdfWidget;
  viewport: PageViewport;
  value: string;
  onChange: (fieldName: string, value: string) => void;
  required: boolean;
  readOnly: boolean;
  showName?: boolean;
}

const WidgetInput = memo(function WidgetInput({ widget: w, viewport, value, onChange, required, readOnly, showName }: WidgetInputProps) {
  const box = rectToBox(viewport, w.rect);
  const scale = viewport.scale;
  // Use the field's declared size when sensible; otherwise auto-size like Acrobat (capped for multi-line boxes).
  const maxPt = w.multiline ? 10 : 12;
  const autoSize = Math.min(w.multiline ? maxPt * scale : box.height * 0.68, maxPt * scale);
  const declared = w.fontSize && w.fontSize <= 24 ? Math.min(w.fontSize * scale, w.multiline ? maxPt * scale : box.height * 0.85) : null;
  const fontSize = Math.max(6, declared ?? autoSize);
  const filled = w.type === 'checkbox' ? value === 'true' : w.type === 'radio' ? value === w.exportValue : value.trim() !== '';
  const title = [w.tooltip, w.fieldName, required ? '(required)' : ''].filter(Boolean).join(' — ');

  const base = `absolute outline-none transition-colors ${readOnly ? 'cursor-default' : ''} ${
    filled ? 'bg-sky-100/40' : required ? 'bg-amber-200/45' : 'bg-sky-200/45'
  } hover:bg-sky-200/70 focus:bg-white focus:ring-2 focus:ring-lava-500/70 border border-sky-500/30 focus:border-lava-500`;
  const style: React.CSSProperties = { left: box.left, top: box.top, width: box.width, height: box.height, fontSize, color: '#0b1a3a', fontFamily: 'Helvetica, Arial, sans-serif' };
  const common = { 'data-widget-id': w.id, 'data-field-name': w.fieldName, title, 'aria-label': w.tooltip || w.fieldName, disabled: readOnly };

  let control: ReactNode;
  if (w.type === 'checkbox') {
    control = (
      <button type="button" {...common} role="checkbox" aria-checked={value === 'true'}
        onClick={() => onChange(w.fieldName, value === 'true' ? '' : 'true')}
        onKeyDown={(e) => { if (e.key === ' ') { e.preventDefault(); onChange(w.fieldName, value === 'true' ? '' : 'true'); } }}
        className={`${base} flex items-center justify-center font-bold leading-none p-0`}
        style={{ ...style, fontSize: Math.min(box.height, box.width) * 0.85 }}>
        {value === 'true' ? '✓' : ''}
      </button>
    );
  } else if (w.type === 'radio') {
    const on = value === w.exportValue;
    control = (
      <button type="button" {...common} role="radio" aria-checked={on}
        onClick={() => onChange(w.fieldName, on ? '' : (w.exportValue ?? ''))}
        className={`${base} rounded-full flex items-center justify-center p-0`} style={style}>
        {on && <span className="rounded-full bg-[#0b1a3a]" style={{ width: Math.min(box.width, box.height) * 0.5, height: Math.min(box.width, box.height) * 0.5 }} />}
      </button>
    );
  } else if (w.type === 'dropdown') {
    control = (
      <select {...common} value={value} onChange={(e) => onChange(w.fieldName, e.target.value)}
        className={`${base} px-0.5 cursor-pointer appearance-auto`} style={style}>
        <option value="" />
        {w.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        {value && !w.options.some((o) => o.value === value) && <option value={value}>{value}</option>}
      </select>
    );
  } else if (w.multiline) {
    control = (
      <textarea {...common} value={value} maxLength={w.maxLength ?? undefined} spellCheck={false}
        onChange={(e) => onChange(w.fieldName, e.target.value)}
        className={`${base} resize-none px-1 py-0.5 leading-tight`} style={style} />
    );
  } else {
    const isDate = w.type === 'date';
    control = (
      <input {...common} type="text" value={value} spellCheck={false} autoComplete="off"
        maxLength={isDate ? 10 : w.maxLength ?? undefined}
        placeholder={isDate && box.width > 50 ? 'MM/DD/YYYY' : undefined}
        inputMode={isDate ? 'numeric' : undefined}
        onChange={(e) => onChange(w.fieldName, isDate ? formatDateInput(e.target.value) : e.target.value)}
        className={`${base} px-1 placeholder:text-slate-400/80`}
        style={{ ...style, textAlign: w.textAlign, letterSpacing: w.comb && w.maxLength ? `${Math.max(0, box.width / w.maxLength - fontSize * 0.6)}px` : undefined }} />
    );
  }

  return (
    <>
      {control}
      {showName && (
        <span className="absolute pointer-events-none text-[9px] leading-none px-0.5 bg-cyan-600 text-white rounded-sm whitespace-nowrap z-10"
          style={{ left: box.left, top: Math.max(0, box.top - 10) }}>{w.fieldName}</span>
      )}
    </>
  );
});
