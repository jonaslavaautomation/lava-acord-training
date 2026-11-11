import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  UploadCloud,
  FileVideo,
  FileText,
  Trash2,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Loader2,
  X,
  Film,
  FileCheck2,
  ChevronRight,
  Info,
  Eye,
  History,
  Paperclip,
  FolderTree,
  Folder,
  Plus,
  MousePointerSquareDashed,
  Settings2,
  ShieldAlert,
  Download,
  RotateCcw,
} from 'lucide-react';
import { Topbar } from '../components/Topbar';
import { Badge, ProgressBar } from '../components/ui';
import { ACORD_MODULES } from '../data/modules';
import {
  uploadMaterial,
  listMaterials,
  deleteMaterial,
  deleteAsset,
  getSignedUrl,
  validateVideoFile,
  validatePdfFile,
  validateSupportingFile,
  probeVideoDuration,
  updateMaterialMeta,
  setCurrentVersion,
  getMappings,
} from '../lib/materialsService';
import { analyzePdf, formatFileSize, PdfValidationError, type PdfAnalysis } from '../lib/pdf';
import { BUCKETS, MATERIAL_FOLDERS, moduleFolder } from '../lib/supabase';
import { useApp } from '../AppContext';
import { FieldMappingEditor } from '../components/FieldMappingEditor';
import { PdfPreviewModal } from '../components/pdf/PdfPreviewModal';
import { PdfFieldDesigner } from '../components/pdf/PdfFieldDesigner';
import type { AcordId, MaterialType, TrainingMaterial, UploadProgress } from '../types';

interface ActiveUpload extends UploadProgress {
  id: string;
  moduleId: AcordId;
  type: MaterialType;
  abort?: () => void;
}

interface PdfNotice {
  moduleId: AcordId;
  fileName: string;
  analysis: PdfAnalysis;
  carriedOver: number;
}

export function TrainingMaterials() {
  const { navigate, refreshMaterials: refreshAppMaterials } = useApp();
  const [all, setAll] = useState<TrainingMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [uploads, setUploads] = useState<ActiveUpload[]>([]);
  const [expanded, setExpanded] = useState<AcordId | null>(null);
  const [notice, setNotice] = useState<PdfNotice | null>(null);
  const [videoPreview, setVideoPreview] = useState<{ url: string; name: string } | null>(null);
  const [pdfPreview, setPdfPreview] = useState<{ material: TrainingMaterial; focus?: string } | null>(null);
  const [designer, setDesigner] = useState<TrainingMaterial | null>(null);
  const [mappingStats, setMappingStats] = useState<Record<string, { graded: number; total: number }>>({});
  const [showTree, setShowTree] = useState(false);

  const load = useCallback(async () => {
    try {
      const rows = await listMaterials({ includeHistory: true });
      setAll(rows);
      setLoadError(null);
      // Grading status for each current PDF.
      const pdfs = rows.filter((r) => r.material_type === 'pdf' && r.is_current);
      const stats: Record<string, { graded: number; total: number }> = {};
      await Promise.all(pdfs.map(async (p) => {
        const m = await getMappings(p.id).catch(() => []);
        stats[p.id] = {
          graded: m.filter((x) => x.is_scored && x.points > 0 && (x.expected_value.trim() !== '' || x.match_type === 'present' || x.missing_rule === 'expect_blank')).length,
          total: m.length,
        };
      }));
      setMappingStats(stats);
    } catch (err) {
      setLoadError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const afterChange = useCallback(async () => {
    await load();
    await refreshAppMaterials();
  }, [load, refreshAppMaterials]);

  const byModule = useMemo(() => {
    const out = {} as Record<AcordId, { videos: TrainingMaterial[]; pdf: TrainingMaterial | null; supporting: TrainingMaterial[]; history: Map<string, TrainingMaterial[]> }>;
    for (const mod of ACORD_MODULES) {
      const mine = all.filter((m) => m.module_id === mod.id);
      const history = new Map<string, TrainingMaterial[]>();
      for (const m of mine) history.set(m.asset_key, [...(history.get(m.asset_key) ?? []), m].sort((a, b) => b.version_number - a.version_number));
      const current = mine.filter((m) => m.is_current);
      out[mod.id] = {
        videos: current.filter((m) => m.material_type === 'video').sort((a, b) => a.lesson_order - b.lesson_order),
        pdf: current.find((m) => m.material_type === 'pdf') ?? null,
        supporting: current.filter((m) => m.material_type === 'supporting'),
        history,
      };
    }
    return out;
  }, [all]);

  const patchUpload = (id: string, p: Partial<ActiveUpload>) => setUploads((prev) => prev.map((u) => (u.id === id ? { ...u, ...p } : u)));

  const startUpload = async (moduleId: AcordId, type: MaterialType, file: File, opts: { assetKey?: string; lessonOrder?: number } = {}) => {
    const id = `${Date.now()}-${Math.random()}`;
    const base: ActiveUpload = { id, moduleId, type, fileName: file.name, fileSize: file.size, progress: 0, status: 'analyzing' };
    const validation = type === 'video' ? validateVideoFile(file) : type === 'pdf' ? validatePdfFile(file) : validateSupportingFile(file);
    if (validation) {
      setUploads((prev) => [...prev, { ...base, status: 'error', error: validation }]);
      return;
    }
    setUploads((prev) => [...prev, base]);
    setExpanded(moduleId);

    try {
      let analysis: PdfAnalysis | undefined;
      let duration: number | null = null;
      if (type === 'pdf') {
        analysis = await analyzePdf(new Uint8Array(await file.arrayBuffer()));
        if (analysis.isPureXfa) throw new PdfValidationError(analysis.warnings[0]);
      } else if (type === 'video') {
        duration = await probeVideoDuration(file);
      }
      const previousPdf = type === 'pdf' ? byModule[moduleId].pdf : null;
      const material = await uploadMaterial({
        moduleId, type, file,
        assetKey: opts.assetKey,
        lessonOrder: opts.lessonOrder,
        title: type === 'pdf' ? undefined : opts.assetKey ? undefined : file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '),
        durationSeconds: duration,
        pdf: analysis,
        onPhase: (phase) => patchUpload(id, { status: phase }),
        onProgress: (pct) => patchUpload(id, { progress: pct }),
        registerAbort: (abort) => patchUpload(id, { abort }),
      });
      patchUpload(id, { status: 'completed', progress: 100, abort: undefined });
      if (type === 'pdf' && analysis) {
        const carried = previousPdf ? (await getMappings(material.id)).filter((m) => m.expected_value).length : 0;
        setNotice({ moduleId, fileName: file.name, analysis, carriedOver: carried });
      }
      await afterChange();
      setTimeout(() => setUploads((prev) => prev.filter((u) => u.id !== id)), 4000);
    } catch (err) {
      patchUpload(id, { status: 'error', error: (err as Error).message, abort: undefined });
    }
  };

  const confirmDelete = async (m: TrainingMaterial, allVersions: boolean) => {
    const msg = allVersions
      ? `Delete "${m.title || m.file_name}" and ALL of its versions? Students will no longer see it. This cannot be undone.`
      : `Delete version ${m.version} of "${m.file_name}"? This cannot be undone.`;
    if (!confirm(msg)) return;
    try {
      if (allVersions) await deleteAsset(m.asset_key);
      else await deleteMaterial(m);
      await afterChange();
    } catch (err) {
      alert(`Delete failed: ${(err as Error).message}`);
    }
  };

  const previewVideo = async (m: TrainingMaterial) => setVideoPreview({ url: await getSignedUrl(m), name: m.file_name });

  return (
    <div>
      <Topbar title="Training Materials" subtitle="Upload and manage training videos, fillable ACORD PDFs and supporting materials" />
      <div className="px-8 py-6 space-y-6 max-w-[1200px]">
        {/* Info banner */}
        <div className="card p-4 flex items-start gap-3 border-cyan-500/15 bg-cyan-500/5 animate-fade-in">
          <Info className="w-5 h-5 text-cyan-400 mt-0.5 shrink-0" />
          <div className="text-sm text-slate-300 flex-1">
            <p className="font-medium text-white mb-1">File-Based Training Material Management</p>
            <p className="text-muted-400 text-xs leading-relaxed">
              Files are stored privately in Supabase Storage and served to signed-in users through short-lived links. Videos upload
              with resumable (TUS) uploads, so large files survive interruptions. PDFs are validated and scanned for AcroForm fields —
              flattened PDFs are flagged and can be given interactive fields with the Field Designer. Replacing a file creates a new
              version; earlier versions stay in the history until you delete them.
            </p>
          </div>
          <button onClick={() => setShowTree((v) => !v)} className="btn-ghost text-xs shrink-0"><FolderTree className="w-4 h-4" /> Storage layout</button>
        </div>

        {showTree && <StorageTree all={all} />}

        {loadError && (
          <div className="card p-4 border-lava-600/20 bg-lava-600/5 text-sm text-lava-300 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <div>Could not load materials: {loadError}. Make sure the Supabase migrations in <code className="font-mono">supabase/migrations</code> have been applied.</div>
          </div>
        )}

        {notice && <PdfNoticeBanner notice={notice} onClose={() => setNotice(null)}
          onDesign={() => { const p = byModule[notice.moduleId].pdf; if (p) setDesigner(p); setNotice(null); }} />}

        <div className="space-y-4">
          {ACORD_MODULES.map((mod) => {
            const mat = byModule[mod.id];
            const isExpanded = expanded === mod.id;
            const modUploads = uploads.filter((u) => u.moduleId === mod.id);
            const stats = mat.pdf ? mappingStats[mat.pdf.id] : undefined;
            return (
              <div key={mod.id} className="card overflow-hidden animate-fade-in">
                <div className="p-4 flex items-center gap-4 cursor-pointer hover:bg-bg-hover/30 transition-colors" onClick={() => setExpanded(isExpanded ? null : mod.id)}>
                  <div className="w-10 h-10 rounded-lg bg-bg-elevated border border-line-subtle flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5 text-lava-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white">{mod.formNumber}</span>
                      <span className="text-sm text-muted-400 truncate">— {mod.title}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs flex-wrap">
                      <StatusChip ok={mat.videos.length > 0} icon={<Film className="w-3 h-3" />} label={mat.videos.length ? `${mat.videos.length} video lesson${mat.videos.length > 1 ? 's' : ''}` : 'No video'} />
                      <StatusChip
                        ok={Boolean(mat.pdf && mat.pdf.field_count > 0)}
                        warn={Boolean(mat.pdf && mat.pdf.field_count === 0)}
                        icon={<FileCheck2 className="w-3 h-3" />}
                        label={!mat.pdf ? 'No PDF' : mat.pdf.is_fillable ? `Fillable PDF · ${mat.pdf.field_count} fields` : mat.pdf.field_count > 0 ? `Flattened PDF · ${mat.pdf.field_count} designer fields` : 'Flattened PDF · needs fields'}
                      />
                      {mat.pdf && <StatusChip ok={(stats?.graded ?? 0) > 0} warn={(stats?.graded ?? 0) === 0} icon={<Settings2 className="w-3 h-3" />} label={stats ? `Answer key ${stats.graded}/${stats.total}` : 'Answer key…'} />}
                      {mat.supporting.length > 0 && <StatusChip ok icon={<Paperclip className="w-3 h-3" />} label={`${mat.supporting.length} supporting`} />}
                      {modUploads.some((u) => u.status !== 'completed' && u.status !== 'error') && <span className="flex items-center gap-1 text-cyan-400"><Loader2 className="w-3 h-3 animate-spin" /> Uploading</span>}
                    </div>
                  </div>
                  <ChevronRight className={`w-5 h-5 text-muted-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                </div>

                {isExpanded && (
                  <div className="border-t border-line-subtle p-5 space-y-6 animate-slide-in">
                    {modUploads.length > 0 && (
                      <div className="space-y-2">
                        {modUploads.map((u) => <UploadRow key={u.id} upload={u} onDismiss={() => setUploads((prev) => prev.filter((x) => x.id !== u.id))} />)}
                      </div>
                    )}

                    {loading ? (
                      <div className="flex items-center gap-2 text-sm text-muted-400"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
                    ) : (
                      <>
                        {/* Videos */}
                        <section>
                          <SectionLabel icon={<FileVideo className="w-4 h-4" />} title="Training Videos" path={`${moduleFolder(mod.id)}/${MATERIAL_FOLDERS.video}/`} />
                          <div className="space-y-3">
                            {mat.videos.map((v) => (
                              <VideoLessonCard key={v.id} material={v} history={mat.history.get(v.asset_key) ?? [v]}
                                onPreview={() => previewVideo(v)}
                                onReplace={(file) => startUpload(mod.id, 'video', file, { assetKey: v.asset_key })}
                                onDelete={(m, allV) => confirmDelete(m, allV)}
                                onMakeCurrent={async (m) => { await setCurrentVersion(m.id); await afterChange(); }}
                                onMeta={async (patch) => { await updateMaterialMeta(v.id, patch); await afterChange(); }}
                                onPreviewVersion={async (m) => setVideoPreview({ url: await getSignedUrl(m), name: `${m.file_name} (${m.version})` })}
                              />
                            ))}
                            <Dropzone
                              type="video"
                              compact={mat.videos.length > 0}
                              label={mat.videos.length ? 'Add another lesson' : `Upload the ${mod.formNumber} training video`}
                              hint="MP4 (H.264) or WebM recommended · MOV, M4V, OGG accepted · up to 5 GB (subject to your Supabase limit)"
                              onFile={(f) => startUpload(mod.id, 'video', f, { lessonOrder: (mat.videos[mat.videos.length - 1]?.lesson_order ?? 0) + 1 })}
                            />
                          </div>
                        </section>

                        {/* PDF */}
                        <section>
                          <SectionLabel icon={<FileText className="w-4 h-4" />} title="Fillable ACORD PDF" path={`${moduleFolder(mod.id)}/${MATERIAL_FOLDERS.pdf}/`} />
                          {mat.pdf ? (
                            <PdfCard material={mat.pdf} history={mat.history.get(mat.pdf.asset_key) ?? [mat.pdf]}
                              onPreview={(m) => setPdfPreview({ material: m })}
                              onReplace={(file) => startUpload(mod.id, 'pdf', file)}
                              onDesign={() => setDesigner(mat.pdf)}
                              onDelete={(m, allV) => confirmDelete(m, allV)}
                              onMakeCurrent={async (m) => { await setCurrentVersion(m.id); await afterChange(); }}
                              onVersionLabel={async (label) => { await updateMaterialMeta(mat.pdf!.id, { version: label }); await afterChange(); }}
                            />
                          ) : (
                            <Dropzone type="pdf" label={`Upload the authorized fillable ${mod.formNumber} PDF`} hint="PDF · max 50 MB · AcroForm fields are detected automatically" onFile={(f) => startUpload(mod.id, 'pdf', f)} />
                          )}
                        </section>

                        {mat.pdf && mat.pdf.field_count > 0 && (
                          <FieldMappingEditor
                            key={mat.pdf.id}
                            moduleId={mod.id}
                            material={mat.pdf}
                            formNumber={mod.formNumber}
                            onLocateField={(name) => setPdfPreview({ material: mat.pdf!, focus: name })}
                            onSaved={load}
                          />
                        )}

                        {/* Supporting */}
                        <section>
                          <SectionLabel icon={<Paperclip className="w-4 h-4" />} title="Supporting Materials" path={`${moduleFolder(mod.id)}/${MATERIAL_FOLDERS.supporting}/`} />
                          <div className="space-y-2">
                            {mat.supporting.map((m) => (
                              <div key={m.id} className="flex items-center gap-3 p-3 rounded-lg bg-bg-base border border-line-subtle">
                                <Paperclip className="w-4 h-4 text-muted-400 shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm text-slate-200 truncate">{m.title || m.file_name}</div>
                                  <div className="text-[11px] text-muted-500">{m.file_name} · {formatFileSize(m.file_size)} · {new Date(m.uploaded_at).toLocaleDateString()}</div>
                                </div>
                                <button onClick={async () => window.open(await getSignedUrl(m, { download: m.file_name }), '_blank', 'noopener')} className="btn-ghost text-xs"><Download className="w-3.5 h-3.5" /></button>
                                <button onClick={() => confirmDelete(m, true)} className="btn-ghost text-xs text-lava-400"><Trash2 className="w-3.5 h-3.5" /></button>
                              </div>
                            ))}
                            <Dropzone type="supporting" compact label="Add a supporting file (sample loss runs, guides, checklists…)" hint="Any document · max 100 MB" onFile={(f) => startUpload(mod.id, 'supporting', f)} />
                          </div>
                        </section>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between pt-4">
          <button onClick={() => navigate('trainer')} className="btn-secondary">Back to Trainer Dashboard</button>
        </div>
      </div>

      {videoPreview && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-8" onClick={() => setVideoPreview(null)}>
          <div className="max-w-4xl w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-white truncate">Video Preview — {videoPreview.name}</span>
              <button onClick={() => setVideoPreview(null)} className="text-muted-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <video src={videoPreview.url} controls autoPlay className="w-full rounded-lg border border-line bg-black" />
            <p className="text-xs text-muted-500 mt-2">Trainer previews do not count toward any student's progress.</p>
          </div>
        </div>
      )}
      {pdfPreview && <PdfPreviewModal material={pdfPreview.material} focusField={pdfPreview.focus} onClose={() => setPdfPreview(null)} />}
      {designer && <PdfFieldDesigner material={designer} onClose={() => setDesigner(null)} onSaved={async () => { setDesigner(null); await afterChange(); }} />}
    </div>
  );
}

// ------------------------------------------------------------------ pieces

function StatusChip({ ok, warn, icon, label }: { ok: boolean; warn?: boolean; icon: React.ReactNode; label: string }) {
  return <span className={`flex items-center gap-1 ${ok ? 'text-emerald-400' : warn ? 'text-amber-400' : 'text-muted-600'}`}>{icon} {label}</span>;
}

function SectionLabel({ icon, title, path }: { icon: React.ReactNode; title: string; path: string }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <span className="text-muted-400">{icon}</span>
      <span className="text-xs font-semibold text-muted-400 uppercase tracking-wider">{title}</span>
      <span className="text-[10px] font-mono text-muted-600 truncate">{BUCKETS.TRAINING}/{path}</span>
    </div>
  );
}

function UploadRow({ upload: u, onDismiss }: { upload: ActiveUpload; onDismiss: () => void }) {
  const label = u.status === 'analyzing' ? (u.type === 'pdf' ? 'Validating PDF & detecting fields…' : 'Reading file…')
    : u.status === 'uploading' ? `Uploading ${u.progress}%`
      : u.status === 'saving' ? 'Saving to database…'
        : u.status === 'completed' ? 'Uploaded' : 'Failed';
  return (
    <div className={`p-3 rounded-lg border ${u.status === 'error' ? 'border-lava-600/20 bg-lava-600/5' : u.status === 'completed' ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-cyan-500/20 bg-cyan-500/5'}`}>
      <div className="flex items-center gap-2">
        {u.status === 'error' ? <AlertCircle className="w-4 h-4 text-lava-400 shrink-0" /> : u.status === 'completed' ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> : <Loader2 className="w-4 h-4 text-cyan-400 animate-spin shrink-0" />}
        <span className="text-sm text-white truncate">{u.fileName}</span>
        <span className="text-xs text-muted-500 shrink-0">{formatFileSize(u.fileSize)}</span>
        <span className="text-xs text-muted-400 ml-auto shrink-0">{label}</span>
        {u.abort && <button onClick={u.abort} className="text-xs text-muted-400 hover:text-white">Cancel</button>}
        {(u.status === 'error' || u.status === 'completed') && <button onClick={onDismiss} className="text-muted-500 hover:text-white"><X className="w-3.5 h-3.5" /></button>}
      </div>
      {(u.status === 'uploading' || u.status === 'saving') && <div className="mt-2"><ProgressBar value={u.progress} size="sm" color="cyan" /></div>}
      {u.status === 'error' && <p className="text-xs text-lava-400 mt-1">{u.error}</p>}
    </div>
  );
}

function Dropzone({ type, label, hint, onFile, compact }: { type: MaterialType; label: string; hint: string; onFile: (f: File) => void; compact?: boolean }) {
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const accept = type === 'video' ? 'video/*,.mp4,.webm,.mov,.m4v,.ogg,.ogv' : type === 'pdf' ? 'application/pdf,.pdf' : undefined;
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); Array.from(e.dataTransfer.files).slice(0, type === 'pdf' ? 1 : 10).forEach(onFile); }}
      onClick={() => input.current?.click()}
      className={`border-2 border-dashed rounded-lg text-center cursor-pointer transition-all ${compact ? 'p-3' : 'p-6'} ${over ? 'border-lava-600/50 bg-lava-600/5' : 'border-line hover:border-line-strong hover:bg-bg-hover/30'}`}
    >
      <input ref={input} type="file" accept={accept} multiple={type !== 'pdf'} className="hidden"
        onChange={(e) => { Array.from(e.target.files ?? []).forEach(onFile); e.target.value = ''; }} />
      <div className={`flex ${compact ? 'flex-row justify-center gap-2' : 'flex-col'} items-center`}>
        {compact ? <Plus className="w-4 h-4 text-muted-500" /> : <UploadCloud className={`w-8 h-8 mb-2 ${over ? 'text-lava-400' : 'text-muted-500'}`} />}
        <p className="text-sm text-slate-300">{label}{compact ? '' : ' — drag & drop or click'}</p>
      </div>
      {!compact && <p className="text-xs text-muted-500 mt-1">{hint}</p>}
    </div>
  );
}

function ReplaceButton({ accept, onFile, label = 'Replace' }: { accept?: string; onFile: (f: File) => void; label?: string }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <input ref={input} type="file" accept={accept} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} />
      <button onClick={() => input.current?.click()} className="btn-ghost text-xs"><RefreshCw className="w-3.5 h-3.5" /> {label}</button>
    </>
  );
}

function VersionHistory({ history, onDelete, onMakeCurrent, onPreview }: {
  history: TrainingMaterial[];
  onDelete: (m: TrainingMaterial) => void;
  onMakeCurrent: (m: TrainingMaterial) => void;
  onPreview?: (m: TrainingMaterial) => void;
}) {
  return (
    <div className="mt-3 rounded-lg border border-line-subtle divide-y divide-line-subtle">
      {history.map((h) => (
        <div key={h.id} className="flex items-center gap-3 px-3 py-2 text-xs">
          <Badge variant={h.is_current ? 'success' : 'default'}>{h.version}</Badge>
          <span className="text-slate-300 truncate flex-1" title={h.file_name}>{h.file_name}</span>
          <span className="text-muted-500 shrink-0">{formatFileSize(h.file_size)}</span>
          <span className="text-muted-500 shrink-0">{new Date(h.uploaded_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
          <span className="text-muted-600 shrink-0 hidden md:inline">{h.uploaded_by}</span>
          {onPreview && <button onClick={() => onPreview(h)} className="text-muted-400 hover:text-white" title="Preview"><Eye className="w-3.5 h-3.5" /></button>}
          {!h.is_current && <button onClick={() => onMakeCurrent(h)} className="text-muted-400 hover:text-white" title="Restore as current"><RotateCcw className="w-3.5 h-3.5" /></button>}
          {history.length > 1 && <button onClick={() => onDelete(h)} className="text-muted-400 hover:text-lava-400" title="Delete this version"><Trash2 className="w-3.5 h-3.5" /></button>}
        </div>
      ))}
    </div>
  );
}

function fmtDuration(s: number | null): string {
  if (!s) return 'duration unknown';
  const m = Math.floor(s / 60);
  return `${m}:${Math.round(s % 60).toString().padStart(2, '0')}`;
}

function VideoLessonCard({ material: m, history, onPreview, onReplace, onDelete, onMakeCurrent, onMeta, onPreviewVersion }: {
  material: TrainingMaterial;
  history: TrainingMaterial[];
  onPreview: () => void;
  onReplace: (f: File) => void;
  onDelete: (m: TrainingMaterial, all: boolean) => void;
  onMakeCurrent: (m: TrainingMaterial) => void;
  onMeta: (p: Partial<Pick<TrainingMaterial, 'title' | 'description' | 'is_required'>>) => void;
  onPreviewVersion: (m: TrainingMaterial) => void;
}) {
  const [title, setTitle] = useState(m.title ?? '');
  const [desc, setDesc] = useState(m.description ?? '');
  const [showHistory, setShowHistory] = useState(false);
  useEffect(() => { setTitle(m.title ?? ''); setDesc(m.description ?? ''); }, [m.title, m.description]);
  return (
    <div className="card p-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center shrink-0"><FileVideo className="w-5 h-5 text-cyan-400" /></div>
        <div className="flex-1 min-w-0 space-y-2">
          <input value={title} onChange={(e) => setTitle(e.target.value)} onBlur={() => title !== (m.title ?? '') && onMeta({ title })}
            className="input text-sm py-1.5 font-medium" placeholder="Lesson title (shown to students)" />
          <input value={desc} onChange={(e) => setDesc(e.target.value)} onBlur={() => desc !== (m.description ?? '') && onMeta({ description: desc })}
            className="input text-xs py-1.5" placeholder="Short description (optional)" />
          <div className="flex items-center gap-3 text-xs text-muted-500 flex-wrap">
            <span className="text-slate-300 truncate max-w-[260px]" title={m.file_name}>{m.file_name}</span>
            <span>{formatFileSize(m.file_size)}</span>
            <span>{fmtDuration(m.duration_seconds)}</span>
            <Badge variant="default">{m.version}</Badge>
            <span>Uploaded {new Date(m.uploaded_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={m.is_required} onChange={(e) => onMeta({ is_required: e.target.checked })} /> Required to unlock assessment
            </label>
          </div>
          {!m.duration_seconds && <p className="text-[11px] text-amber-400">The video length could not be read in this browser; it will be taken from the first student playback.</p>}
        </div>
      </div>
      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-line-subtle">
        <button onClick={onPreview} className="btn-ghost text-xs"><Eye className="w-3.5 h-3.5" /> Preview</button>
        <ReplaceButton accept="video/*,.mp4,.webm,.mov,.m4v,.ogg" onFile={onReplace} />
        <button onClick={() => setShowHistory((v) => !v)} className="btn-ghost text-xs"><History className="w-3.5 h-3.5" /> Versions ({history.length})</button>
        <button onClick={() => onDelete(m, true)} className="btn-ghost text-xs text-lava-400 hover:text-lava-300 ml-auto"><Trash2 className="w-3.5 h-3.5" /> Delete lesson</button>
      </div>
      {showHistory && <VersionHistory history={history} onDelete={(h) => onDelete(h, false)} onMakeCurrent={onMakeCurrent} onPreview={onPreviewVersion} />}
    </div>
  );
}

function PdfCard({ material: m, history, onPreview, onReplace, onDesign, onDelete, onMakeCurrent, onVersionLabel }: {
  material: TrainingMaterial;
  history: TrainingMaterial[];
  onPreview: (m: TrainingMaterial) => void;
  onReplace: (f: File) => void;
  onDesign: () => void;
  onDelete: (m: TrainingMaterial, all: boolean) => void;
  onMakeCurrent: (m: TrainingMaterial) => void;
  onVersionLabel: (label: string) => void;
}) {
  const [showHistory, setShowHistory] = useState(false);
  const [label, setLabel] = useState(m.version ?? '');
  useEffect(() => setLabel(m.version ?? ''), [m.version]);
  const flattened = !m.is_fillable;
  return (
    <div className="card p-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-lava-600/10 flex items-center justify-center shrink-0"><FileText className="w-5 h-5 text-lava-400" /></div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-white truncate">{m.file_name}</div>
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-500 flex-wrap">
            <span>{formatFileSize(m.file_size)}</span>
            {m.page_count && <span>{m.page_count} page{m.page_count > 1 ? 's' : ''}</span>}
            <span>Uploaded {new Date(m.uploaded_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} by {m.uploaded_by}</span>
            <span className="flex items-center gap-1">Version
              <input value={label} onChange={(e) => setLabel(e.target.value)} onBlur={() => label.trim() && label !== m.version && onVersionLabel(label.trim())}
                className="input text-xs py-0.5 px-1.5 w-28" title="Version label, e.g. 2016/03" />
            </span>
          </div>
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            {m.is_fillable ? (
              <Badge variant="success"><CheckCircle2 className="w-3 h-3" /> Fillable · {m.field_count} AcroForm fields</Badge>
            ) : m.field_count > 0 ? (
              <Badge variant="info"><MousePointerSquareDashed className="w-3 h-3" /> Flattened · {m.field_count} designer fields</Badge>
            ) : (
              <Badge variant="warning"><AlertCircle className="w-3 h-3" /> Non-fillable (flattened) — add fields before use</Badge>
            )}
            {m.is_encrypted && <Badge variant="warning"><ShieldAlert className="w-3 h-3" /> Encrypted — completed copies may fail</Badge>}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-line-subtle flex-wrap">
        <button onClick={() => onPreview(m)} className="btn-ghost text-xs"><Eye className="w-3.5 h-3.5" /> Preview</button>
        <ReplaceButton accept="application/pdf,.pdf" onFile={onReplace} label="Upload new version" />
        <button onClick={onDesign} className={`btn-ghost text-xs ${flattened ? 'text-amber-400' : ''}`}><MousePointerSquareDashed className="w-3.5 h-3.5" /> Field Designer</button>
        <button onClick={() => setShowHistory((v) => !v)} className="btn-ghost text-xs"><History className="w-3.5 h-3.5" /> Versions ({history.length})</button>
        <button onClick={() => onDelete(m, false)} className="btn-ghost text-xs text-lava-400 hover:text-lava-300 ml-auto"><Trash2 className="w-3.5 h-3.5" /> Delete</button>
      </div>
      {showHistory && <VersionHistory history={history} onDelete={(h) => onDelete(h, false)} onMakeCurrent={onMakeCurrent} onPreview={onPreview} />}
    </div>
  );
}

function PdfNoticeBanner({ notice, onClose, onDesign }: { notice: PdfNotice; onClose: () => void; onDesign: () => void }) {
  const a = notice.analysis;
  const ok = a.isFillable;
  return (
    <div className={`card p-4 flex items-start gap-3 animate-fade-in ${ok ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-amber-500/20 bg-amber-500/5'}`}>
      {ok ? <CheckCircle2 className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" /> : <AlertCircle className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />}
      <div className="flex-1 text-sm">
        <p className={`font-medium ${ok ? 'text-emerald-400' : 'text-amber-400'}`}>
          {ok
            ? `ACORD ${notice.moduleId}: fillable PDF detected — ${a.fields.length} AcroForm field${a.fields.length !== 1 ? 's' : ''} on ${a.pageCount} page${a.pageCount > 1 ? 's' : ''}`
            : `ACORD ${notice.moduleId}: this PDF has no editable form fields (flattened)`}
        </p>
        <p className="text-muted-400 text-xs mt-1">
          {ok
            ? notice.carriedOver > 0
              ? `${notice.fileName} is now the current version. ${notice.carriedOver} answer-key mapping${notice.carriedOver > 1 ? 's were' : ' was'} carried over from the previous version (matching field names). Review the rest below.`
              : `${notice.fileName} is now the current version. The answer key was built automatically from the scenario — review it below if you like.`
            : `${notice.fileName} was saved, but students cannot fill it in yet. Upload the genuinely fillable version of the form (recommended — its answer key is built automatically), or open the Field Designer to draw fields and configure the answer key by hand.`}
        </p>
        {a.warnings.filter((w) => !w.startsWith('No editable')).map((w) => <p key={w} className="text-xs text-amber-300 mt-1">⚠ {w}</p>)}
        {!ok && <button onClick={onDesign} className="btn-secondary text-xs mt-3"><MousePointerSquareDashed className="w-3.5 h-3.5" /> Open Field Designer</button>}
      </div>
      <button onClick={onClose} className="text-muted-500 hover:text-white"><X className="w-4 h-4" /></button>
    </div>
  );
}

function StorageTree({ all }: { all: TrainingMaterial[] }) {
  const count = (id: AcordId, t: MaterialType) => all.filter((m) => m.module_id === id && m.material_type === t).length;
  return (
    <div className="card p-4 animate-fade-in font-mono text-xs text-slate-300">
      <div className="flex items-center gap-2 text-white mb-2"><Folder className="w-4 h-4 text-lava-400" /> LAVA ACORD Training <span className="text-muted-500">(bucket: {BUCKETS.TRAINING}, private)</span></div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 pl-4">
        {ACORD_MODULES.map((mod) => (
          <div key={mod.id}>
            <div className="flex items-center gap-1.5 text-slate-200"><Folder className="w-3.5 h-3.5 text-amber-400" /> {moduleFolder(mod.id)}/</div>
            {(['video', 'pdf', 'supporting'] as MaterialType[]).map((t) => (
              <div key={t} className="flex items-center gap-1.5 pl-5 text-muted-400">
                <Folder className="w-3 h-3" /> {MATERIAL_FOLDERS[t]}/ <span className="text-muted-600">{count(mod.id, t)} file{count(mod.id, t) === 1 ? '' : 's'}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="mt-3 text-muted-500">Completed student copies: bucket <span className="text-slate-300">{BUCKETS.SUBMISSIONS}</span> / &lt;student id&gt; / ACORD ###/ &lt;attempt id&gt;.pdf (private)</div>
    </div>
  );
}
