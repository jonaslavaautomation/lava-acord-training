import { useState, useCallback, useEffect } from 'react';
import {
  ArrowLeft,
  FileText,
  PlayCircle,
  CheckCircle,
  Lock,
  Sparkles,
  BookOpen,
  Target,
  ListChecks,
  Clock3,
  RotateCcw,
  Mail,
  AlertCircle,
  Loader2,
  Film,
  Upload,
  Paperclip,
  Download,
  FileCheck2,
  ChevronDown,
} from 'lucide-react';
import { useApp } from '../AppContext';
import { useAuth } from '../context/AuthContext';
import { MODULE_MAP } from '../data/modules';
import { Topbar } from '../components/Topbar';
import { Badge, SectionTitle, StepTracker } from '../components/ui';
import type { CourseSteps } from '../lib/nextStep';
import { TrainingVideoPlayer } from '../components/TrainingVideoPlayer';
import { KnowledgeCheck, type KnowledgeCheckGate } from '../components/KnowledgeCheck';
import { getSignedUrl } from '../lib/materialsService';
import { formatFileSize } from '../lib/pdf';
import { friendlyError, modulePassed, type VideoHeartbeatResult } from '../lib/assessmentService';
import { supabase } from '../lib/supabase';
import type { TrainingMaterial } from '../types';

export function ModulePage() {
  const { activeModuleId, student, navigate, startAssessment, getModuleMaterials, materialsLoaded, refreshStudent } = useApp();
  const { isStaff } = useAuth();
  const mod = activeModuleId ? MODULE_MAP[activeModuleId] : null;
  const progress = activeModuleId ? student.progress[activeModuleId] : null;
  const mats = activeModuleId ? getModuleMaterials(activeModuleId) : { videos: [], pdf: null, supporting: [] };
  const [selectedLesson, setSelectedLesson] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [hasInProgress, setHasInProgress] = useState(false);
  const [kcGate, setKcGate] = useState<KnowledgeCheckGate>('loading');

  useEffect(() => {
    if (!activeModuleId) return;
    supabase.from('assessment_attempts').select('id', { count: 'exact', head: true })
      .eq('module_id', activeModuleId).eq('status', 'in_progress')
      .then(({ count }) => setHasInProgress((count ?? 0) > 0));
  }, [activeModuleId]);

  const onServerProgress = useCallback((r: VideoHeartbeatResult) => {
    // Refresh the student's record once a lesson flips to complete so the gate opens.
    if (r.completed && progress && !progress.videos[r.asset_key]?.completed) refreshStudent();
  }, [progress, refreshStudent]);

  if (!mod || !progress) {
    return (
      <div>
        <Topbar title="Module not found" />
        <div className="px-4 sm:px-8 py-12 text-center text-muted-400">Please select a module from the training list.</div>
      </div>
    );
  }

  const videos = mats.videos;
  const activeLesson: TrainingMaterial | null = videos.find((v) => v.asset_key === selectedLesson)
    ?? videos.find((v) => v.is_required && !progress.videos[v.asset_key]?.completed)
    ?? videos[0] ?? null;
  const hasVideo = videos.length > 0;
  const videoComplete = progress.videoCompleted;
  const pdfReady = Boolean(mats.pdf);
  const kcPassed = kcGate === 'passed' || kcGate === 'unavailable';
  const canGenerate = hasVideo && videoComplete && (kcPassed || hasInProgress) && pdfReady && (progress.attemptsRemaining > 0 || hasInProgress);
  const materialsLoading = !materialsLoaded;

  const handleStart = async () => {
    setStarting(true);
    setStartError(null);
    try {
      await startAssessment(mod.id);
    } catch (err) {
      setStartError(friendlyError(err));
    } finally {
      setStarting(false);
    }
  };

  const lockedReason = !hasVideo
    ? 'No training video has been uploaded for this module yet.'
    : !videoComplete
      ? 'Complete the required training video(s) first to unlock the assessment.'
      : !kcPassed
        ? kcGate === 'loading' ? 'Checking your Knowledge Check status…' : 'Pass the Knowledge Check above (80% or higher) to unlock the assessment.'
        : !pdfReady
        ? 'The fillable ACORD PDF for this module has not been uploaded yet.'
        : 'No attempts remaining. Contact your trainer to reset.';

  const passed = modulePassed(progress);
  const quizDone = kcGate === 'passed' || kcGate === 'unavailable' || passed;
  const steps: CourseSteps = {
    video: videoComplete ? 'done' : 'current',
    quiz: quizDone ? 'done' : videoComplete ? 'current' : 'todo',
    form: passed ? 'done' : videoComplete && quizDone ? 'current' : 'todo',
  };
  const started = progress.videoProgress > 0 || progress.attemptsUsed > 0;
  const jumpTo = (key: keyof CourseSteps) => {
    const id = key === 'video' ? 'step-video' : key === 'quiz' ? 'knowledge-check' : 'step-form';
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div>
      <Topbar title={`${mod.formNumber} — ${mod.title}`} subtitle={mod.category} />
      <div className="px-4 sm:px-6 lg:px-8 py-6 space-y-8 max-w-[1100px]">
        <button
          onClick={() => navigate('training')}
          className="flex items-center gap-2 text-sm text-muted-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to ACORD Training
        </button>

        {/* Steps */}
        <div className="card p-4 sm:p-5 space-y-4 animate-fade-in">
          <StepTracker steps={steps} onStepClick={jumpTo} />
          <div className="flex items-center gap-x-5 gap-y-2 flex-wrap pt-3 border-t border-line-subtle text-xs text-muted-400">
            <span className="flex items-center gap-1.5"><Target className="w-3.5 h-3.5" /> Best score: <span className={passed ? 'text-emerald-400 font-medium' : 'text-slate-200'}>{progress.bestScore !== null ? `${progress.bestScore}%` : '—'}</span> <span className="text-muted-600">(80% to pass)</span></span>
            <span className="flex items-center gap-1.5"><RotateCcw className="w-3.5 h-3.5" /> Form attempts left: <span className="text-slate-200">{progress.attemptsRemaining} of {progress.attemptsUsed + progress.attemptsRemaining}</span></span>
            {passed && <Badge variant="success"><CheckCircle className="w-3 h-3" /> Course passed</Badge>}
          </div>
        </div>

        {/* Section A: Introduction */}
        <details className="group/intro card animate-fade-in" open={!started}>
          <summary className="flex items-center gap-3 p-4 sm:p-5 cursor-pointer list-none select-none rounded-xl hover:bg-bg-hover/40 [&::-webkit-details-marker]:hidden">
            <div className="w-9 h-9 rounded-lg bg-lava-600/10 border border-lava-600/20 flex items-center justify-center shrink-0">
              <BookOpen className="w-4 h-4 text-lava-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-white">About the {mod.formNumber}</div>
              <div className="text-xs text-muted-400">What the form is for, its key sections and what you'll learn</div>
            </div>
            <ChevronDown className="w-4 h-4 text-muted-400 transition-transform group-open/intro:rotate-180" />
          </summary>
          <div className="px-4 sm:px-6 pb-6 pt-1 space-y-5">
            <div className="flex items-start gap-4 pb-5 border-b border-line-subtle">
              <div className="w-14 h-14 rounded-xl bg-lava-600/10 border border-lava-600/20 flex items-center justify-center shrink-0">
                <FileText className="w-7 h-7 text-lava-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-1">{mod.formNumber} — {mod.title}</h3>
                <p className="text-sm text-muted-400 leading-relaxed">{mod.description}</p>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-5">
              <div>
                <h4 className="text-xs font-semibold text-muted-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <Target className="w-3.5 h-3.5" /> What This Form Is Used For
                </h4>
                <p className="text-sm text-slate-300 leading-relaxed">{mod.introduction.purpose}</p>
              </div>
              <div>
                <h4 className="text-xs font-semibold text-muted-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5" /> Purpose in an Insurance Agency
                </h4>
                <p className="text-sm text-slate-300 leading-relaxed">{mod.introduction.agencyRole}</p>
              </div>
            </div>

            <div className="pt-3">
              <h4 className="text-xs font-semibold text-muted-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                <ListChecks className="w-3.5 h-3.5" /> Important Sections & Fields
              </h4>
              <div className="grid md:grid-cols-2 gap-3">
                {mod.introduction.keySections.map((sec) => (
                  <div key={sec.title} className="flex gap-3 p-3 rounded-lg bg-bg-base border border-line-subtle">
                    <div className="w-1.5 h-1.5 rounded-full bg-lava-500 mt-2 shrink-0" />
                    <div>
                      <div className="text-sm font-medium text-white">{sec.title}</div>
                      <div className="text-xs text-muted-400 mt-0.5">{sec.description}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-3">
              <h4 className="text-xs font-semibold text-muted-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Target className="w-3.5 h-3.5" /> Learning Objectives
              </h4>
              <ul className="space-y-2">
                {mod.introduction.learningObjectives.map((obj, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-slate-300">
                    <CheckCircle className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                    {obj}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </details>

        {/* Step 1: Training Video */}
        <section id="step-video" className="animate-fade-in scroll-mt-24">
          <SectionTitle
            title="Step 1 · Watch the training video"
            subtitle={activeLesson ? (activeLesson.title || mod.videoTitle) : mod.videoTitle}
            action={videoComplete ? <Badge variant="success"><CheckCircle className="w-3 h-3" /> Done</Badge> : undefined}
          />
          <div className="card p-4 sm:p-6 space-y-4">
            {materialsLoading && (
              <div className="aspect-video rounded-lg bg-bg-base border border-line-subtle flex items-center justify-center">
                <div className="text-center">
                  <Loader2 className="w-8 h-8 text-muted-500 animate-spin mx-auto" />
                  <p className="text-sm text-muted-400 mt-3">Loading training video...</p>
                </div>
              </div>
            )}

            {!materialsLoading && activeLesson && (
              <TrainingVideoPlayer
                key={activeLesson.id}
                material={activeLesson}
                progress={progress.videos[activeLesson.asset_key]}
                onServerProgress={onServerProgress}
              />
            )}

            {!materialsLoading && !hasVideo && (
              <div className="aspect-video rounded-lg bg-bg-base border-2 border-dashed border-line-subtle flex items-center justify-center">
                <div className="text-center max-w-sm">
                  <div className="w-16 h-16 rounded-full bg-bg-elevated border border-line-subtle flex items-center justify-center mx-auto mb-4">
                    <Film className="w-8 h-8 text-muted-600" />
                  </div>
                  <h4 className="text-sm font-medium text-white mb-1">No training video uploaded</h4>
                  <p className="text-xs text-muted-500 leading-relaxed mb-3">
                    A trainer needs to upload the training video for this module before you can proceed.
                    Once uploaded, the video will appear here and you'll be able to watch it to unlock the assessment.
                  </p>
                  {isStaff && (
                    <button onClick={() => navigate('materials')} className="btn-secondary text-xs">
                      <Upload className="w-3.5 h-3.5" /> Go to Training Materials
                    </button>
                  )}
                </div>
              </div>
            )}

            {videos.length > 1 && (
              <div className="space-y-1.5">
                <div className="text-xs font-semibold text-muted-500 uppercase tracking-wider">Lessons</div>
                {videos.map((v, i) => {
                  const lp = progress.videos[v.asset_key];
                  const active = activeLesson?.asset_key === v.asset_key;
                  return (
                    <button key={v.id} onClick={() => setSelectedLesson(v.asset_key)}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-colors ${active ? 'bg-bg-elevated border-line-strong' : 'bg-bg-base border-line-subtle hover:border-line'}`}>
                      {lp?.completed ? <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" /> : <PlayCircle className="w-4 h-4 text-muted-500 shrink-0" />}
                      <span className="text-sm text-slate-200 flex-1 truncate">{i + 1}. {v.title || v.file_name}</span>
                      {!v.is_required && <Badge variant="default">Optional</Badge>}
                      <span className="text-xs text-muted-500 tabular-nums">{lp?.completed ? 'Done' : `${Math.round(lp?.coverage ?? 0)}%`}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {hasVideo && (
              <div className="flex items-center justify-between flex-wrap gap-3">
                {videoComplete ? (
                  <Badge variant="success"><CheckCircle className="w-3 h-3" /> Required video{videos.filter((v) => v.is_required).length > 1 ? 's' : ''} complete</Badge>
                ) : (
                  <Badge variant="warning"><Clock3 className="w-3 h-3" /> {Math.round(progress.videoProgress)}% of required video watched</Badge>
                )}
                {!videoComplete && <p className="text-xs text-muted-500">Watch at least 95% of the video to unlock the assessment</p>}
              </div>
            )}

            {activeLesson && (
              <div className="p-4 rounded-lg bg-bg-base border border-line-subtle">
                <h4 className="text-sm font-medium text-white mb-1">{activeLesson.title || mod.videoTitle}</h4>
                <p className="text-sm text-muted-400 leading-relaxed">{activeLesson.description || mod.videoDescription}</p>
              </div>
            )}

            {mats.supporting.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-muted-500 uppercase tracking-wider mb-2 flex items-center gap-1.5"><Paperclip className="w-3.5 h-3.5" /> Supporting Materials</div>
                <div className="grid sm:grid-cols-2 gap-2">
                  {mats.supporting.map((m) => <SupportingFile key={m.id} material={m} />)}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Step 2: Knowledge Check */}
        {kcGate !== 'unavailable' && (
          <section id="knowledge-check" className="animate-fade-in scroll-mt-24">
            <SectionTitle
              title="Step 2 · Knowledge Check"
              subtitle="15 questions about the video. Score 80% or higher to unlock the form."
              action={kcGate === 'passed' ? <Badge variant="success"><CheckCircle className="w-3 h-3" /> Passed</Badge> : !videoComplete ? <Badge variant="default"><Lock className="w-3 h-3" /> Finish the video first</Badge> : undefined}
            />
            <KnowledgeCheck moduleId={mod.id} formNumber={mod.formNumber} videoComplete={videoComplete} onGateChange={setKcGate} />
          </section>
        )}

        {/* Step 3: Assessment */}
        <section id="step-form" className="animate-fade-in scroll-mt-24">
          <SectionTitle
            title="Step 3 · Fill out the ACORD form"
            subtitle="Read the agency email and complete the real fillable ACORD PDF. 80% to pass."
            action={passed ? <Badge variant="success"><CheckCircle className="w-3 h-3" /> Passed</Badge> : undefined}
          />
          <div className={`card p-4 sm:p-6 relative overflow-hidden ${canGenerate ? 'border-lava-600/30' : ''}`}>
            {canGenerate && <div className="absolute top-0 right-0 w-48 h-48 bg-lava-600/8 rounded-full blur-3xl" />}
            <div className="relative flex items-center justify-between flex-wrap gap-6">
              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 rounded-xl flex items-center justify-center shrink-0 ${canGenerate ? 'bg-lava-600/15 border border-lava-600/30' : 'bg-bg-elevated border border-line-subtle'}`}>
                  {canGenerate ? <Sparkles className="w-7 h-7 text-lava-400" /> : <Lock className="w-7 h-7 text-muted-600" />}
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">{canGenerate ? (hasInProgress ? 'Your form is waiting' : 'Ready for the form') : 'Form locked'}</h3>
                  <p className="text-sm text-muted-400 mt-0.5 max-w-md">
                    {canGenerate
                      ? hasInProgress
                        ? 'You have an assessment in progress. Your entries were saved — resume where you left off.'
                        : 'You\'re ready to start. A realistic agency email and the fillable ACORD PDF will be loaded.'
                      : lockedReason}
                  </p>
                  {mats.pdf && (
                    <p className="text-xs text-muted-500 mt-1.5 flex items-center gap-1.5">
                      <FileCheck2 className="w-3.5 h-3.5" /> {mats.pdf.file_name} · {mats.pdf.version}
                    </p>
                  )}
                </div>
              </div>
              <button onClick={handleStart} disabled={!canGenerate || starting} className="btn-primary px-6 py-3 text-sm">
                {starting ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Preparing…</>
                ) : canGenerate ? (
                  <><Sparkles className="w-4 h-4" /> {hasInProgress ? 'Resume form' : progress.attemptsUsed > 0 ? 'Retake form' : 'Start the form'}</>
                ) : (
                  <><Lock className="w-4 h-4" /> Locked</>
                )}
              </button>
            </div>

            {startError && (
              <div className="mt-4 flex items-start gap-2 p-3 rounded-lg bg-lava-600/5 border border-lava-600/20">
                <AlertCircle className="w-4 h-4 text-lava-400 mt-0.5 shrink-0" />
                <p className="text-xs text-lava-300">{startError}</p>
              </div>
            )}

            {hasVideo && !videoComplete && (
              <div className="mt-4 flex items-start gap-2 p-3 rounded-lg bg-amber-500/5 border border-amber-500/15">
                <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-400/80">
                  The assessment button stays disabled until you finish watching the training video. Videos cannot be
                  marked complete manually — the server verifies that at least 95% of the video was actually played.
                </p>
              </div>
            )}

            {(!hasVideo || !pdfReady) && !materialsLoading && (
              <div className="mt-4 flex items-start gap-2 p-3 rounded-lg bg-cyan-500/5 border border-cyan-500/15">
                <AlertCircle className="w-4 h-4 text-cyan-400 mt-0.5 shrink-0" />
                <p className="text-xs text-cyan-400/80">
                  A trainer needs to upload the training video and the fillable ACORD PDF (with its answer key configured)
                  before assessments can be generated for this module.
                </p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function SupportingFile({ material }: { material: TrainingMaterial }) {
  const [busy, setBusy] = useState(false);
  const open = async () => {
    setBusy(true);
    try {
      window.open(await getSignedUrl(material, { download: material.file_name }), '_blank', 'noopener');
    } finally {
      setBusy(false);
    }
  };
  return (
    <button onClick={open} className="flex items-center gap-3 p-3 rounded-lg bg-bg-base border border-line-subtle hover:border-line text-left transition-colors">
      <FileText className="w-4 h-4 text-muted-400 shrink-0" />
      <span className="flex-1 min-w-0">
        <span className="block text-sm text-slate-200 truncate">{material.title || material.file_name}</span>
        <span className="block text-[11px] text-muted-500">{formatFileSize(material.file_size)}</span>
      </span>
      {busy ? <Loader2 className="w-4 h-4 animate-spin text-muted-500" /> : <Download className="w-4 h-4 text-muted-500" />}
    </button>
  );
}
