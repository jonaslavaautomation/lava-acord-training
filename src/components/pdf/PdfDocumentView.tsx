import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Loader2, Maximize2, ZoomIn, ZoomOut, MoveHorizontal } from 'lucide-react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { PageViewport, PDFPageProxy } from 'pdfjs-dist';
import { pdfjsLib } from '@/lib/pdf';

export interface PdfDocumentViewProps {
  doc: PDFDocumentProxy;
  /** 'forms': interactive widgets are NOT painted on the canvas (the overlay renders them). 'all': paint everything. */
  annotationMode?: 'forms' | 'all';
  renderOverlay?: (page: number, viewport: PageViewport) => ReactNode;
  toolbarLeft?: ReactNode;
  toolbarRight?: ReactNode;
  scrollRequest?: { page: number; nonce: number; y?: number } | null;
  onPageChange?: (page: number) => void;
}

const MIN_SCALE = 0.5;
const MAX_SCALE = 3;

export function PdfDocumentView({ doc, annotationMode = 'forms', renderOverlay, toolbarLeft, toolbarRight, scrollRequest, onPageChange }: PdfDocumentViewProps) {
  const [pages, setPages] = useState<PDFPageProxy[]>([]);
  const [scale, setScale] = useState(1.25);
  const [currentPage, setCurrentPage] = useState(1);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const fittedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    fittedRef.current = false;
    (async () => {
      const list: PDFPageProxy[] = [];
      for (let i = 1; i <= doc.numPages; i++) list.push(await doc.getPage(i));
      if (!cancelled) setPages(list);
    })();
    return () => { cancelled = true; };
  }, [doc]);

  const fitWidth = useCallback(() => {
    const el = scrollRef.current;
    if (!el || pages.length === 0) return;
    const base = pages[0].getViewport({ scale: 1 });
    const s = (el.clientWidth - 48) / base.width;
    setScale(Math.min(MAX_SCALE, Math.max(MIN_SCALE, Math.round(s * 100) / 100)));
  }, [pages]);

  // Fit to width on first load.
  useLayoutEffect(() => {
    if (pages.length && !fittedRef.current) { fittedRef.current = true; fitWidth(); }
  }, [pages, fitWidth]);

  // Track the most visible page.
  useEffect(() => {
    const root = scrollRef.current;
    if (!root || pages.length === 0) return;
    const ratios = new Map<number, number>();
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) ratios.set(Number((e.target as HTMLElement).dataset.page), e.intersectionRatio);
      let best = 1; let bestR = -1;
      ratios.forEach((r, p) => { if (r > bestR) { bestR = r; best = p; } });
      setCurrentPage(best);
    }, { root, threshold: [0, 0.25, 0.5, 0.75, 1] });
    pageRefs.current.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [pages, scale]);

  useEffect(() => { onPageChange?.(currentPage); }, [currentPage, onPageChange]);

  const goToPage = useCallback((p: number, y?: number) => {
    const el = pageRefs.current.get(p);
    const root = scrollRef.current;
    if (!el || !root) return;
    root.scrollTo({ top: el.offsetTop - 16 + (y ?? 0), behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (scrollRequest) goToPage(scrollRequest.page, scrollRequest.y);
  }, [scrollRequest, goToPage]);

  // Ctrl/Cmd + wheel zoom.
  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      setScale((s) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, Math.round((s - e.deltaY * 0.002) * 100) / 100)));
    };
    root.addEventListener('wheel', onWheel, { passive: false });
    return () => root.removeEventListener('wheel', onWheel);
  }, []);

  const zoom = (delta: number) => setScale((s) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, Math.round((s + delta) * 100) / 100)));
  const numPages = doc.numPages;

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-bg-base/50">
      <div className="flex items-center justify-between gap-3 px-4 py-2 border-b border-line-subtle bg-bg-surface/80 shrink-0 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">{toolbarLeft}</div>
        <div className="flex items-center gap-1">
          <ToolbarButton onClick={() => goToPage(Math.max(1, currentPage - 1))} disabled={currentPage <= 1} title="Previous page"><ChevronLeft className="w-4 h-4" /></ToolbarButton>
          <span className="text-xs text-muted-400 tabular-nums px-2 whitespace-nowrap">
            Page{' '}
            <select
              value={currentPage}
              onChange={(e) => goToPage(Number(e.target.value))}
              className="bg-bg-base border border-line-subtle rounded px-1 py-0.5 text-slate-200 cursor-pointer"
              aria-label="Go to page"
            >
              {Array.from({ length: numPages }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
            </select>{' '}
            / {numPages}
          </span>
          <ToolbarButton onClick={() => goToPage(Math.min(numPages, currentPage + 1))} disabled={currentPage >= numPages} title="Next page"><ChevronRight className="w-4 h-4" /></ToolbarButton>
          <div className="w-px h-5 bg-line-subtle mx-1" />
          <ToolbarButton onClick={() => zoom(-0.25)} disabled={scale <= MIN_SCALE} title="Zoom out"><ZoomOut className="w-4 h-4" /></ToolbarButton>
          <span className="text-xs text-muted-400 tabular-nums w-11 text-center">{Math.round(scale * 100)}%</span>
          <ToolbarButton onClick={() => zoom(0.25)} disabled={scale >= MAX_SCALE} title="Zoom in"><ZoomIn className="w-4 h-4" /></ToolbarButton>
          <ToolbarButton onClick={fitWidth} title="Fit width"><MoveHorizontal className="w-4 h-4" /></ToolbarButton>
          <ToolbarButton onClick={() => setScale(1)} title="Actual size (100%)"><Maximize2 className="w-4 h-4" /></ToolbarButton>
        </div>
        <div className="flex items-center gap-2">{toolbarRight}</div>
      </div>

      <div ref={scrollRef} className="flex-1 min-h-0 overflow-auto">
        {pages.length === 0 ? (
          <div className="h-full flex items-center justify-center"><Loader2 className="w-8 h-8 text-muted-500 animate-spin" /></div>
        ) : (
          <div className="flex flex-col items-center gap-5 p-6 w-max min-w-full">
            {pages.map((page, idx) => (
              <PdfPageView
                key={idx + 1}
                page={page}
                pageNumber={idx + 1}
                scale={scale}
                annotationMode={annotationMode}
                renderOverlay={renderOverlay}
                scrollRoot={scrollRef}
                registerRef={(el) => { if (el) pageRefs.current.set(idx + 1, el); else pageRefs.current.delete(idx + 1); }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ToolbarButton({ children, onClick, disabled, title }: { children: ReactNode; onClick: () => void; disabled?: boolean; title: string }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={title} aria-label={title}
      className="p-1.5 rounded text-muted-400 hover:text-white hover:bg-bg-hover disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
      {children}
    </button>
  );
}

interface PdfPageViewProps {
  page: PDFPageProxy;
  pageNumber: number;
  scale: number;
  annotationMode: 'forms' | 'all';
  renderOverlay?: (page: number, viewport: PageViewport) => ReactNode;
  scrollRoot: React.RefObject<HTMLDivElement>;
  registerRef: (el: HTMLDivElement | null) => void;
}

function PdfPageView({ page, pageNumber, scale, annotationMode, renderOverlay, scrollRoot, registerRef }: PdfPageViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(pageNumber <= 2);
  const [rendered, setRendered] = useState(false);
  const viewport = page.getViewport({ scale });

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true); }, { root: scrollRoot.current, rootMargin: '800px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [scrollRoot]);

  useEffect(() => {
    if (!visible) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const vp = page.getViewport({ scale: scale * ratio });
    canvas.width = Math.floor(vp.width);
    canvas.height = Math.floor(vp.height);
    const task = page.render({
      canvas,
      viewport: vp,
      annotationMode: annotationMode === 'forms' ? pdfjsLib.AnnotationMode.ENABLE_FORMS : pdfjsLib.AnnotationMode.ENABLE,
    });
    task.promise.then(() => setRendered(true)).catch(() => undefined);
    return () => task.cancel();
  }, [page, scale, visible, annotationMode]);

  return (
    <div
      ref={(el) => { wrapRef.current = el; registerRef(el); }}
      data-page={pageNumber}
      className="relative bg-white shadow-elevated shrink-0"
      style={{ width: viewport.width, height: viewport.height }}
    >
      <canvas ref={canvasRef} className="absolute inset-0" style={{ width: viewport.width, height: viewport.height }} />
      {!rendered && <div className="absolute inset-0 flex items-center justify-center"><Loader2 className="w-6 h-6 text-slate-400 animate-spin" /></div>}
      {renderOverlay && <div className="absolute inset-0">{renderOverlay(pageNumber, viewport)}</div>}
      <div className="absolute -left-10 top-0 text-[10px] text-muted-600 tabular-nums select-none">{pageNumber}</div>
    </div>
  );
}

/** Convert a PDF-space rect [x1,y1,x2,y2] to CSS box in the given viewport. */
export function rectToBox(viewport: PageViewport, rect: number[]): { left: number; top: number; width: number; height: number } {
  const [x1, y1] = viewport.convertToViewportPoint(rect[0], rect[1]) as number[];
  const [x2, y2] = viewport.convertToViewportPoint(rect[2], rect[3]) as number[];
  return { left: Math.min(x1, x2), top: Math.min(y1, y2), width: Math.abs(x2 - x1), height: Math.abs(y2 - y1) };
}
