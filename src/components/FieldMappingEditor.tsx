import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Info, Loader2, LocateFixed, Save, Search, Settings2, Lock, Sparkles } from 'lucide-react';
import { Badge } from './ui';
import { autoConfigureAnswerKey, getFormFields, getMappings, getScenarioFacts, saveMappings } from '@/lib/materialsService';
import type { AcordId, MatchType, MissingRule, PdfFieldInfo, PdfFieldMapping, ScenarioFact, TrainingMaterial } from '@/types';

interface Props {
  moduleId: AcordId;
  material: TrainingMaterial;
  formNumber: string;
  onLocateField?: (fieldName: string) => void;
  onSaved?: () => void;
}

const MATCH_LABELS: Record<MatchType, string> = {
  exact: 'Exact (ignores case, spaces, $ and commas)',
  contains: 'Contains the expected text',
  'any-of': 'Any of (separate values with |)',
  keywords: 'All keywords present',
  present: 'Any non-blank answer',
};

const MISSING_LABELS: Record<MissingRule, string> = {
  penalize: 'Blank = missing information',
  expect_blank: 'Must stay blank (not in scenario)',
  optional: 'Optional (not scored if blank)',
};

function isConfigured(m: PdfFieldMapping): boolean {
  return m.is_scored && m.points > 0 && (m.expected_value.trim() !== '' || m.match_type === 'present' || m.missing_rule === 'expect_blank');
}

export function FieldMappingEditor({ moduleId, material, formNumber, onLocateField, onSaved }: Props) {
  const [rows, setRows] = useState<PdfFieldMapping[]>([]);
  const [fields, setFields] = useState<Map<string, PdfFieldInfo>>(new Map());
  const [facts, setFacts] = useState<ScenarioFact[]>([]);
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [filter, setFilter] = useState<'all' | 'configured' | 'unconfigured'>('all');
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [m, f, sf] = await Promise.all([getMappings(material.id), getFormFields(material.id), getScenarioFacts(moduleId)]);
      setRows(m);
      setFields(new Map(f.map((x) => [x.name, x])));
      setFacts(sf);
      setDirty(new Set());
    } catch (err) {
      setMessage({ kind: 'error', text: (err as Error).message });
    } finally {
      setLoading(false);
    }
  }, [material.id, moduleId]);

  useEffect(() => { load(); }, [load]);

  const update = (name: string, patch: Partial<PdfFieldMapping>) => {
    // A hand edit turns an automatic answer into a manual one, so re-running auto-fill will not overwrite it.
    setRows((prev) => prev.map((r) => (r.pdf_field_name === name
      ? { ...r, ...(!('scenario_fact_key' in patch) && r.scenario_fact_key?.startsWith('auto:') ? { scenario_fact_key: null } : {}), ...patch }
      : r)));
    setDirty((prev) => new Set(prev).add(name));
    setMessage(null);
  };

  const applyFact = (row: PdfFieldMapping, factKey: string) => {
    if (!factKey) { update(row.pdf_field_name, { scenario_fact_key: null }); return; }
    const fact = facts.find((f) => f.fact_key === factKey);
    if (!fact) return;
    const ftype = fields.get(row.pdf_field_name)?.type ?? row.pdf_field_type;
    update(row.pdf_field_name, {
      scenario_fact_key: fact.fact_key,
      scenario_label: fact.label,
      expected_value: ftype === 'checkbox' ? (fact.value === 'true' ? 'true' : 'false') : fact.value,
      match_type: fact.match_type,
      points: fact.points,
      missing_rule: 'penalize',
      is_scored: true,
    });
  };

  const [autoRunning, setAutoRunning] = useState(false);
  const autoFill = async () => {
    if (dirty.size > 0 && !window.confirm('You have unsaved changes. Auto-fill reloads the answer key and discards them. Continue?')) return;
    setAutoRunning(true);
    setMessage(null);
    try {
      const res = await autoConfigureAnswerKey(material.id);
      await load();
      const missing = res.not_found.length ? ` Not found on this PDF: ${res.not_found.join(', ')}.` : '';
      const kept = res.kept_manual ? ` ${res.kept_manual} hand-configured field(s) kept.` : '';
      setMessage({ kind: res.matched + res.kept_manual > 0 ? 'ok' : 'error', text: `Answer key built from the scenario: ${res.matched} of ${res.total_rules} details matched to PDF fields.${kept}${missing}` });
      onSaved?.();
    } catch (err) {
      setMessage({ kind: 'error', text: (err as Error).message });
    } finally {
      setAutoRunning(false);
    }
  };

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await saveMappings(rows.filter((r) => dirty.has(r.pdf_field_name)));
      setDirty(new Set());
      setMessage({ kind: 'ok', text: 'Grading configuration saved. New assessments will use it immediately.' });
      onSaved?.();
    } catch (err) {
      setMessage({ kind: 'error', text: (err as Error).message });
    } finally {
      setSaving(false);
    }
  };

  const stats = useMemo(() => {
    const configured = rows.filter(isConfigured);
    return { configured: configured.length, points: configured.reduce((s, r) => s + r.points, 0), required: configured.filter((r) => r.required).length };
  }, [rows]);

  const visible = rows.filter((r) => {
    if (filter === 'configured' && !isConfigured(r)) return false;
    if (filter === 'unconfigured' && isConfigured(r)) return false;
    if (query) {
      const q = query.toLowerCase();
      if (!r.pdf_field_name.toLowerCase().includes(q) && !r.scenario_label.toLowerCase().includes(q) && !r.expected_value.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  if (loading) {
    return <div className="p-4 rounded-lg bg-bg-base border border-line-subtle flex items-center gap-2 text-sm text-muted-400"><Loader2 className="w-4 h-4 animate-spin" /> Loading field mappings…</div>;
  }

  if (rows.length === 0) {
    return (
      <div className="p-4 rounded-lg bg-bg-base border border-line-subtle text-sm text-muted-500 text-center">
        No interactive fields to map yet. {material.is_fillable ? '' : 'Add fields with the Field Designer first.'}
      </div>
    );
  }

  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 mb-1 flex-wrap">
        <Settings2 className="w-4 h-4 text-lava-400" />
        <h4 className="text-sm font-semibold text-white">Field Mapping & Grading (Answer Key)</h4>
        <span className="text-xs text-muted-500">{formNumber} · {material.file_name} · {material.version}</span>
        <Badge variant="default"><Lock className="w-3 h-3" /> Trainer-only</Badge>
        <div className="ml-auto flex items-center gap-2">
          <Badge variant={stats.configured > 0 ? 'success' : 'warning'}>{stats.configured}/{rows.length} fields graded · {stats.points} pts</Badge>
          <button onClick={autoFill} disabled={autoRunning || saving} className="btn-secondary py-1.5 text-xs" title="Match every detail in the scenario e-mail to its field on this PDF">
            {autoRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            Auto-fill from scenario
          </button>
          <button onClick={save} disabled={saving || dirty.size === 0} className="btn-primary py-1.5 text-xs">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save{dirty.size > 0 ? ` (${dirty.size})` : ''}
          </button>
        </div>
      </div>
      <p className="text-xs text-muted-500 mb-3 leading-relaxed">
        Connect each PDF field (by its real AcroForm name) to the scenario information it should contain. Pick a scenario fact to
        fill the expected answer automatically, or type it. The answer key is built automatically when the PDF is uploaded; use
        Auto-fill from scenario to rebuild it (answers you typed by hand are kept). Answers are stored server-side and are never sent to students;
        grading runs in the database when a student submits.
      </p>

      {message && (
        <div className={`mb-3 p-2 rounded-lg flex items-center gap-2 text-xs ${message.kind === 'ok' ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-lava-600/10 border border-lava-600/20 text-lava-400'}`}>
          {message.kind === 'ok' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />} {message.text}
        </div>
      )}
      {stats.configured === 0 && (
        <div className="mb-3 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center gap-2 text-xs text-amber-400">
          <Info className="w-3.5 h-3.5" /> Students cannot start this assessment until at least one field has an expected answer.
        </div>
      )}

      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-bg-base border border-line-subtle flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 text-muted-500" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search field name, label or answer…" className="bg-transparent text-xs text-slate-200 placeholder:text-muted-600 focus:outline-none flex-1" />
        </div>
        <div className="flex items-center gap-1 p-1 rounded-lg bg-bg-base border border-line-subtle">
          {(['all', 'configured', 'unconfigured'] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`px-2.5 py-1 rounded-md text-xs font-medium capitalize transition-all ${filter === f ? 'bg-bg-elevated text-white' : 'text-muted-400 hover:text-slate-200'}`}>{f}</button>
          ))}
        </div>
      </div>

      <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1">
        {visible.map((m) => {
          const f = fields.get(m.pdf_field_name);
          const ftype = f?.type ?? m.pdf_field_type;
          const opts = f?.options ?? [];
          const configured = isConfigured(m);
          return (
            <div key={m.pdf_field_name} className={`p-3 rounded-lg bg-bg-base border transition-colors ${dirty.has(m.pdf_field_name) ? 'border-lava-600/40' : configured ? 'border-emerald-500/15' : 'border-line-subtle'}`}>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="text-xs font-mono text-cyan-400 break-all" title={m.pdf_field_name}>{m.pdf_field_name}</span>
                <Badge variant="default">{ftype}</Badge>
                <span className="text-[10px] text-muted-600">p.{f?.page ?? m.page_number}</span>
                {f?.source === 'custom' && <Badge variant="info">designer</Badge>}
                {configured ? <Badge variant="success">graded</Badge> : <Badge variant="default">not graded</Badge>}
                {onLocateField && (
                  <button onClick={() => onLocateField(m.pdf_field_name)} className="ml-auto text-[11px] text-muted-400 hover:text-white flex items-center gap-1">
                    <LocateFixed className="w-3 h-3" /> Show on PDF
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center">
                <select value={m.scenario_fact_key ?? ''} onChange={(e) => applyFact(m, e.target.value)} className="input text-xs py-1.5 md:col-span-3 cursor-pointer" title="Scenario fact">
                  <option value="">Scenario fact…</option>
                  {m.scenario_fact_key?.startsWith('auto:') && <option value={m.scenario_fact_key}>Auto — from scenario</option>}
                  {facts.map((x) => <option key={x.fact_key} value={x.fact_key}>{x.label} — {x.value}</option>)}
                </select>
                <input value={m.scenario_label} onChange={(e) => update(m.pdf_field_name, { scenario_label: e.target.value })} className="input text-xs py-1.5 md:col-span-2" placeholder="Label, e.g. Named Insured" title="Label shown in feedback" />
                <div className="md:col-span-3">
                  {ftype === 'checkbox' ? (
                    <select value={m.expected_value} onChange={(e) => update(m.pdf_field_name, { expected_value: e.target.value, match_type: 'exact' })} className="input text-xs py-1.5 cursor-pointer">
                      <option value="">Expected: (not graded)</option>
                      <option value="true">Expected: Checked</option>
                      <option value="false">Expected: Unchecked</option>
                    </select>
                  ) : opts.length > 0 && m.match_type !== 'any-of' ? (
                    <select value={m.expected_value} onChange={(e) => update(m.pdf_field_name, { expected_value: e.target.value })} className="input text-xs py-1.5 cursor-pointer">
                      <option value="">Expected: (not graded)</option>
                      {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  ) : (
                    <input value={m.expected_value} onChange={(e) => update(m.pdf_field_name, { expected_value: e.target.value })} className="input text-xs py-1.5" placeholder={ftype === 'date' ? 'Expected date, e.g. 01/15/2027' : 'Expected answer'} title="Expected answer" />
                  )}
                </div>
                <select value={m.match_type} onChange={(e) => update(m.pdf_field_name, { match_type: e.target.value as MatchType })} disabled={ftype === 'checkbox'} className="input text-xs py-1.5 md:col-span-2 cursor-pointer" title="Match rule">
                  {(Object.keys(MATCH_LABELS) as MatchType[]).map((k) => <option key={k} value={k}>{MATCH_LABELS[k]}</option>)}
                </select>
                <div className="flex items-center gap-1.5 md:col-span-2">
                  <input type="number" min={0} value={m.points} onChange={(e) => update(m.pdf_field_name, { points: Math.max(0, parseInt(e.target.value, 10) || 0) })} className="input text-xs py-1.5 w-16" title="Points (scoring weight)" />
                  <span className="text-[10px] text-muted-500">pts</span>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center mt-2">
                <select value={m.missing_rule} onChange={(e) => update(m.pdf_field_name, { missing_rule: e.target.value as MissingRule })} className="input text-xs py-1.5 md:col-span-3 cursor-pointer" title="Missing-information rule">
                  {(Object.keys(MISSING_LABELS) as MissingRule[]).map((k) => <option key={k} value={k}>{MISSING_LABELS[k]}</option>)}
                </select>
                <input value={m.feedback_hint ?? ''} onChange={(e) => update(m.pdf_field_name, { feedback_hint: e.target.value })} className="input text-xs py-1.5 md:col-span-5" placeholder="Optional coaching tip shown with feedback (no answer)" />
                <label className="flex items-center gap-2 text-xs text-muted-400 md:col-span-2 cursor-pointer select-none whitespace-nowrap">
                  <Toggle on={m.required} onClick={() => update(m.pdf_field_name, { required: !m.required })} /> Required
                </label>
                <label className="flex items-center gap-2 text-xs text-muted-400 md:col-span-2 cursor-pointer select-none">
                  <Toggle on={m.is_scored} onClick={() => update(m.pdf_field_name, { is_scored: !m.is_scored })} /> Scored
                </label>
              </div>
            </div>
          );
        })}
        {visible.length === 0 && <div className="p-6 text-center text-xs text-muted-500">No fields match.</div>}
      </div>
    </div>
  );
}

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} role="switch" aria-checked={on}
      className={`w-9 h-5 rounded-full transition-colors relative shrink-0 ${on ? 'bg-lava-600' : 'bg-line-strong'}`}>
      <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${on ? 'translate-x-4' : ''}`} />
    </button>
  );
}
