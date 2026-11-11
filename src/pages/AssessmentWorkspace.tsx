import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  ArrowLeft,
  Mail,
  Paperclip,
  FileText,
  Send,
  Clock3,
  AlertCircle,
  Eye,
  ChevronLeft,
  Loader2,
  PanelLeftClose,
  PanelLeftOpen,
  Cloud,
  CloudOff,
  ShieldCheck,
} from 'lucide-react';
import { useApp } from '../AppContext';
import { useAuth } from '../context/AuthContext';
import { MODULE_MAP } from '../data/modules';
import { Topbar } from '../components/Topbar';
import { Badge, ProgressBar } from '../components/ui';
import { PdfFormViewer } from '../components/PdfFormViewer';
import { customFieldsToWidgets, isValidDateString, loadPdfDocument, readWidgets, type PDFDocumentProxy } from '../lib/pdf';
import { fillPdf } from '../lib/pdfFill';
import { downloadMaterialBytes, getFormFields } from '../lib/materialsService';
import { friendlyError, getRequiredFields, saveDraft, storeCompletedPdf, submitAssessment, MAX_ATTEMPTS } from '../lib/assessmentService';
import { supabase } from '../lib/supabase';
import type { PdfFieldInfo, PdfWidget, TrainingMaterial } from '../types';

interface LoadedPdf {
  material: TrainingMaterial;
  /** Working copy of the master bytes, held in memory for this attempt only. The stored master is never written. */
  bytes: Uint8Array;
  doc: PDFDocumentProxy;
  widgets: PdfWidget[];
  customFields: PdfFieldInfo[];
}

interface FieldSummary {
  name: string;
  label: string;
  type: PdfWidget['type'];
  page: number;
  value: string;
  required: boolean;
  invalid: boolean;
}

export function AssessmentWorkspace() {
  const { activeModuleId, navigate, workingAttempt, showResults, refreshStudent, openModule } = useApp();
  const { session } = useAuth();
  const mod = activeModuleId ? MODULE_MAP[activeModuleId] : null;
  const attempt = workingAttempt;

  const [pdf, setPdf] = useState<LoadedPdf | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>(() => (attempt?.draft_values as Record<string, string>) ?? {});
  const [required, setRequired] = useState<Set<string>>(new Set());
  const [showReview, setShowReview] = useState(false);
  const [emailCollapsed, setEmailCollapsed] = useState(false);
  const [focusRequest, setFocusRequest] = useState<{ fieldName: string; nonce: number } | null>(null);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [submitting, setSubmitting] = useState<null | 'grading' | 'generating'>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const dirty = useRef(false);

  // Timer is based on the server's start time, so refreshing the page does not reset it.
  useEffect(() => {
    if (!attempt?.started_at) return;
    const start = new Date(attempt.started_at).getTime();
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - start) / 1000)));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [attempt?.started_at]);

  // Load this attempt's PDF version and build the working copy.
  useEffect(() => {
    if (!attempt?.material_id) return;
    let cancelled = false;
    let doc: PDFDocumentProxy | null = null;
    (async () => {
      try {
        const { data, error } = await supabase.from('training_materials').select('*').eq('id', attempt.material_id!).single();
        if (error || !data) throw new Error('The ACORD PDF for this attempt is no longer available. Contact your trainer.');
        const material = data as TrainingMaterial;
        const [bytes, catalog, req] = await Promise.all([
          downloadMaterialBytes(material),
          getFormFields(material.id),
          getRequiredFields(material.id),
        ]);
        doc = await loadPdfDocument(bytes);
        const acro = await readWidgets(doc);
        const customFields = catalog.filter((f) => f.source === 'custom');
        const widgets = [...acro.filter((w) => w.type !== 'button' && w.type !== 'signature'), ...customFieldsToWidgets(customFields)];
        if (cancelled) return;
        if (widgets.length === 0) throw new Error('This PDF has no interactive fields. A trainer must add fields before it can be completed.');
        setRequired(new Set(req));
        setPdf({ material, bytes, doc, widgets, customFields });
      } catch (err) {
        if (!cancelled) setLoadError(friendlyError(err));
      }
    })();
    return () => { cancelled = true; doc?.loadingTask.destroy(); };
  }, [attempt?.material_id]);

  // Autosave the draft to the server (debounced) so a refresh or crash doesn't lose work.
  useEffect(() => {
    if (!attempt || !dirty.current) return;
    setSaveState('saving');
    const t = setTimeout(() => {
      saveDraft(attempt.id, values).then(() => setSaveState('saved')).catch(() => setSaveState('error'));
    }, 1500);
    return () => clearTimeout(t);
  }, [values, attempt]);

  const onChange = useCallback((name: string, value: string) => {
    dirty.current = true;
    setValues((prev) => ({ ...prev, [name]: value }));
  }, []);

  const fields: FieldSummary[] = useMemo(() => {
    if (!pdf) return [];
    const seen = new Map<string, FieldSummary>();
    for (const w of pdf.widgets) {
      if (seen.has(w.fieldName)) continue;
      const v = values[w.fieldName] ?? '';
      seen.set(w.fieldName, {
        name: w.fieldName,
        label: w.tooltip || w.fieldName.split('.').pop()!.replace(/[_-]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2'),
        type: w.type,
        page: w.page,
        value: v,
        required: required.has(w.fieldName),
        invalid: w.type === 'date' && v.trim() !== '' && !isValidDateString(v),
      });
    }
    return [...seen.values()].sort((a, b) => a.page - b.page);
  }, [pdf, values, required]);

  const isFilled = (f: FieldSummary) => (f.type === 'checkbox' ? f.value === 'true' : f.value.trim() !== '');
  const textLike = fields.filter((f) => f.type !== 'checkbox' && f.type !== 'radio');
  const filledCount = fields.filter(isFilled).length;
  const completionPct = textLike.length ? Math.round((textLike.filter(isFilled).length / textLike.length) * 100) : 0;

  if (!mod || !attempt) {
    return (
      <div>
        <Topbar title="Assessment not available" />
        <div className="px-8 py-12 text-center text-muted-400">
          No active assessment. Return to the module and click Generate Form and Scenario to start one.
          {activeModuleId && <div className="mt-4"><button className="btn-secondary" onClick={() => openModule(activeModuleId)}>Back to module</button></div>}
        </div>
      </div>
    );
  }

  const handleSubmit = async () => {
    if (!pdf) return;
    setSubmitting('grading');
    setSubmitError(null);
    // Only send values for fields that exist in this PDF.
    const payload: Record<string, string> = {};
    for (const f of fields) payload[f.name] = f.value;
    try {
      const graded = await submitAssessment(attempt.id, payload);
      // Generate the completed copy from a fresh copy of the master bytes and store it privately.
      setSubmitting('generating');
      try {
        const { bytes } = await fillPdf(pdf.bytes, payload, pdf.customFields);
        if (session?.user.id) graded.completed_pdf_path = await storeCompletedPdf(session.user.id, graded, bytes);
      } catch (err) {
        console.warn('Completed PDF copy could not be generated:', err);
      }
      await refreshStudent();
      showResults(graded);
    } catch (err) {
      setSubmitError(friendlyError(err));
      setSubmitting(null);
    }
  };

  const elapsedDisplay = `${Math.floor(elapsed / 60)}:${(elapsed % 60).toString().padStart(2, '0')}`;
  const jumpTo = (name: string) => { setShowReview(false); setFocusRequest({ fieldName: name, nonce: Date.now() }); };

  return (
    <div className="h-screen flex flex-col">
      {/* Assessment header */}
      <div className="border-b border-line-subtle bg-bg-surface/80 backdrop-blur-xl px-6 py-3 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('module')} className="btn-ghost p-2" title="Back to module (your entries are saved)">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-lava-400" />
              <span className="text-sm font-semibold text-white">{mod.formNumber}</span>
              <Badge variant="lava">Attempt {attempt.attempt_number} of {MAX_ATTEMPTS}</Badge>
            </div>
            <p className="text-xs text-muted-500 mt-0.5">{mod.title}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <SaveIndicator state={saveState} />
          <div className="flex items-center gap-2 text-sm">
            <Clock3 className="w-4 h-4 text-cyan-400" />
            <span className="tabular-nums text-slate-200">{elapsedDisplay}</span>
            <span className="text-xs text-muted-500">elapsed</span>
          </div>
          <div className="hidden md:flex items-center gap-2 w-48">
            <ProgressBar value={completionPct} size="sm" />
            <span className="text-xs text-muted-400 tabular-nums w-10">{completionPct}%</span>
          </div>
          <button onClick={() => setShowReview(true)} disabled={!pdf} className="btn-primary py-2">
            <Eye className="w-4 h-4" /> Review & Submit
          </button>
        </div>
      </div>

      {/* Two-panel workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left panel — Email */}
        <div className={`${emailCollapsed ? "hidden" : "flex"} w-[34%] min-w-[320px] max-w-[520px] border-r border-line-subtle bg-bg-surface/30 overflow-y-auto flex-col`}>
          <div className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <Mail className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-semibold text-muted-400 uppercase tracking-wider">Agency Email</span>
              <button onClick={() => setEmailCollapsed(true)} className="ml-auto text-xs text-muted-500 hover:text-white flex items-center gap-1" title="Hide email to give the PDF more room">
                <PanelLeftClose className="w-3.5 h-3.5" /> Hide
              </button>
            </div>

            <div className="card overflow-hidden">
              {/* Email header */}
              <div className="p-4 border-b border-line-subtle bg-bg-elevated/50">
                <div className="flex items-start justify-between mb-3">
                  <div className="text-sm font-semibold text-white">{mod.scenario.subject}</div>
                  <Badge variant="info">Scenario</Badge>
                </div>
                <div className="space-y-1.5 text-xs">
                  <div className="flex gap-2">
                    <span className="text-muted-500 w-12">From</span>
                    <span className="text-slate-300">{mod.scenario.fromName}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-muted-500 w-12"></span>
                    <span className="text-muted-400">{mod.scenario.from}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-muted-500 w-12">To</span>
                    <span className="text-slate-300">{mod.scenario.to}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-muted-500 w-12">Date</span>
                    <span className="text-slate-300">{mod.scenario.date}</span>
                  </div>
                </div>
              </div>

              {/* Email body */}
              <div className="p-4">
                <pre className="text-sm text-slate-300 whitespace-pre-wrap font-sans leading-relaxed">{mod.scenario.body}</pre>
              </div>

              {/* Attachments */}
              {mod.scenario.attachments && mod.scenario.attachments.length > 0 && (
                <div className="p-4 border-t border-line-subtle">
                  <div className="text-xs text-muted-500 mb-2 flex items-center gap-1.5">
                    <Paperclip className="w-3 h-3" /> Attachments
                  </div>
                  <div className="space-y-1.5">
                    {mod.scenario.attachments.map((att) => (
                      <div key={att} className="flex items-center gap-2 p-2 rounded-lg bg-bg-base border border-line-subtle text-xs text-slate-300">
                        <FileText className="w-3.5 h-3.5 text-muted-500" />
                        {att}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-4 p-3 rounded-lg bg-cyan-500/5 border border-cyan-500/15">
              <p className="text-xs text-cyan-400/70 leading-relaxed">
                Read this email carefully. All the information you need to complete the {mod.formNumber} PDF is
                contained in the scenario. Extract applicant details, coverage requests, and any additional instructions.
              </p>
            </div>
          </div>
        </div>

        {/* Right panel — actual ACORD PDF */}
        <div className="flex-1 min-w-0 flex flex-col bg-bg-base/30">
          {loadError ? (
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="text-center max-w-md">
                <AlertCircle className="w-10 h-10 text-lava-400 mx-auto" />
                <p className="text-sm text-lava-300 mt-3 font-medium">The ACORD PDF could not be loaded</p>
                <p className="text-xs text-muted-500 mt-1">{loadError}</p>
              </div>
            </div>
          ) : !pdf ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <Loader2 className="w-10 h-10 text-lava-400 animate-spin mx-auto" />
                <p className="text-sm text-muted-400 mt-3">Preparing your working copy of the {mod.formNumber} PDF…</p>
              </div>
            </div>
          ) : showReview ? (
            <div className="flex-1 overflow-y-auto p-5">
              <ReviewPanel
                fields={fields}
                isFilled={isFilled}
                filledCount={filledCount}
                completionPct={completionPct}
                onBack={() => setShowReview(false)}
                onJump={jumpTo}
                onSubmit={handleSubmit}
                submitting={submitting}
                submitError={submitError}
                elapsedDisplay={elapsedDisplay}
                attemptNumber={attempt.attempt_number}
              />
            </div>
          ) : (
            <PdfFormViewer
              doc={pdf.doc}
              widgets={pdf.widgets}
              values={values}
              onChange={onChange}
              requiredFields={required}
              focusRequest={focusRequest}
              toolbarLeft={
                <>
                  {emailCollapsed && (
                    <button onClick={() => setEmailCollapsed(false)} className="btn-ghost text-xs py-1 px-2" title="Show scenario email">
                      <PanelLeftOpen className="w-4 h-4" /> Email
                    </button>
                  )}
                  <FileText className="w-4 h-4 text-lava-400 shrink-0" />
                  <span className="text-xs font-medium text-white truncate max-w-[200px]" title={pdf.material.file_name}>{pdf.material.file_name}</span>
                  <Badge variant="default">{pdf.material.version}</Badge>
                </>
              }
              toolbarRight={<span className="text-xs text-muted-500 tabular-nums">{filledCount}/{fields.length} fields</span>}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function SaveIndicator({ state }: { state: 'idle' | 'saving' | 'saved' | 'error' }) {
  if (state === 'idle') return null;
  if (state === 'saving') return <span className="flex items-center gap-1.5 text-xs text-muted-500"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</span>;
  if (state === 'error') return <span className="flex items-center gap-1.5 text-xs text-amber-400"><CloudOff className="w-3.5 h-3.5" /> Not saved</span>;
  return <span className="flex items-center gap-1.5 text-xs text-emerald-400/80"><Cloud className="w-3.5 h-3.5" /> Draft saved</span>;
}

interface ReviewPanelProps {
  fields: FieldSummary[];
  isFilled: (f: FieldSummary) => boolean;
  filledCount: number;
  completionPct: number;
  onBack: () => void;
  onJump: (name: string) => void;
  onSubmit: () => void;
  submitting: null | 'grading' | 'generating';
  submitError: string | null;
  elapsedDisplay: string;
  attemptNumber: number;
}

function ReviewPanel({ fields, isFilled, filledCount, completionPct, onBack, onJump, onSubmit, submitting, submitError, elapsedDisplay, attemptNumber }: ReviewPanelProps) {
  const [filter, setFilter] = useState<'all' | 'filled' | 'empty'>('all');
  const missingRequired = fields.filter((f) => f.required && !isFilled(f));
  const invalid = fields.filter((f) => f.invalid);
  const pages = [...new Set(fields.map((f) => f.page))].sort((a, b) => a - b);
  const shown = fields.filter((f) => filter === 'all' || (filter === 'filled' ? isFilled(f) : !isFilled(f)));

  return (
    <div className="animate-fade-in max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-lava-400" />
          <span className="text-xs font-semibold text-muted-400 uppercase tracking-wider">Review Your Completed PDF Fields</span>
        </div>
        <button onClick={onBack} className="btn-ghost text-xs">
          <ChevronLeft className="w-3.5 h-3.5" /> Back to PDF
        </button>
      </div>

      <div className="card p-4 mb-4 flex items-center gap-6">
        <div className="flex-1">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-muted-400">Text/date/dropdown fields completed</span>
            <span className="text-slate-200">{filledCount}/{fields.length} fields have entries</span>
          </div>
          <ProgressBar value={completionPct} color={completionPct === 100 ? 'emerald' : 'lava'} size="sm" />
        </div>
        <div className="flex items-center gap-1 p-1 rounded-lg bg-bg-base border border-line-subtle">
          {(['all', 'filled', 'empty'] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium capitalize transition-all ${filter === f ? 'bg-bg-elevated text-white' : 'text-muted-400 hover:text-slate-200'}`}>{f}</button>
          ))}
        </div>
      </div>

      {(missingRequired.length > 0 || invalid.length > 0) && (
        <div className="card p-4 mb-4 border-amber-500/20 bg-amber-500/5 space-y-1.5">
          {missingRequired.length > 0 && (
            <p className="text-xs text-amber-300 flex items-start gap-2"><AlertCircle className="w-4 h-4 shrink-0" />
              {missingRequired.length} required field{missingRequired.length > 1 ? 's are' : ' is'} empty:{' '}
              {missingRequired.slice(0, 6).map((f, i) => (
                <button key={f.name} onClick={() => onJump(f.name)} className="underline hover:text-white">{f.label}{i < Math.min(missingRequired.length, 6) - 1 ? ',' : ''}</button>
              ))}
              {missingRequired.length > 6 && ' …'}
            </p>
          )}
          {invalid.length > 0 && (
            <p className="text-xs text-amber-300 flex items-start gap-2"><AlertCircle className="w-4 h-4 shrink-0" />
              {invalid.length} date field{invalid.length > 1 ? 's are' : ' is'} not a valid MM/DD/YYYY date.
            </p>
          )}
        </div>
      )}

      <div className="space-y-3 mb-6">
        {pages.map((p) => {
          const list = shown.filter((f) => f.page === p);
          if (list.length === 0) return null;
          return (
            <div key={p} className="card p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-white">Page {p}</span>
                <span className="text-xs text-muted-500">{fields.filter((f) => f.page === p && isFilled(f)).length}/{fields.filter((f) => f.page === p).length} filled</span>
              </div>
              <div className="space-y-1">
                {list.map((f) => (
                  <button key={f.name} onClick={() => onJump(f.name)}
                    className="w-full flex items-center gap-3 text-sm py-1.5 border-b border-line-subtle/50 last:border-0 text-left hover:bg-bg-hover/40 rounded px-1 transition-colors">
                    <span className="text-muted-400 flex-1 truncate" title={f.name}>
                      {f.label}{f.required && <span className="text-amber-400"> *</span>}
                    </span>
                    <span className={`text-right max-w-[50%] truncate ${f.invalid ? 'text-amber-400' : isFilled(f) ? 'text-slate-200' : 'text-muted-600 italic'}`}>
                      {f.type === 'checkbox' ? (f.value === 'true' ? 'Checked' : 'Unchecked') : (f.value.trim() || 'Empty')}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="card p-5 border-lava-600/20">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h3 className="text-sm font-semibold text-white">Submit Assessment</h3>
            <p className="text-xs text-muted-400 mt-0.5">
              Time elapsed: <span className="text-slate-200 tabular-nums">{elapsedDisplay}</span> ·
              This uses attempt {attemptNumber} of {MAX_ATTEMPTS} and cannot be undone.
            </p>
            <p className="text-[11px] text-muted-500 mt-1 flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5 text-cyan-400" /> Graded on the server against the trainer's answer key.</p>
          </div>
          <button onClick={onSubmit} disabled={submitting !== null} className="btn-primary px-6 py-3">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {submitting === 'grading' ? 'Grading…' : submitting === 'generating' ? 'Saving completed PDF…' : 'Submit Assessment'}
          </button>
        </div>
        {submitError && (
          <div className="mt-3 flex items-start gap-2 p-3 rounded-lg bg-lava-600/5 border border-lava-600/20">
            <AlertCircle className="w-4 h-4 text-lava-400 mt-0.5 shrink-0" />
            <p className="text-xs text-lava-300">{submitError}</p>
          </div>
        )}
        {fields.length - filledCount > 0 && (
          <div className="mt-3 flex items-start gap-2 p-3 rounded-lg bg-amber-500/5 border border-amber-500/15">
            <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-400/80">
              Some fields are empty. Fields the scenario provides information for will count as missing; fields the
              scenario does not mention should be left blank. Review the scenario email before submitting.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
