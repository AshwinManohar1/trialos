'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Sidebar } from '@/components/Sidebar';
import { TopBar } from '@/components/TopBar';
import { api } from '@/lib/api';
import { Study, DerivedPKProperties, SafetyFlag } from '@/lib/types';

export default function DrugPropertiesPage() {
  const params = useParams();
  const router = useRouter();
  const studyId = params.id as string;

  const [study, setStudy] = useState<Study | null>(null);
  const [pk, setPk] = useState<DerivedPKProperties | null>(null);
  const [loading, setLoading] = useState(true);
  const [polling, setPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Per-field editing state
  const [editField, setEditField] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<DerivedPKProperties>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Safety flags edit state
  const [editingFlagIdx, setEditingFlagIdx] = useState<number | null>(null);
  const [flagDraft, setFlagDraft] = useState<SafetyFlag | null>(null);

  useEffect(() => {
    loadStudy();
  }, [studyId]);

  async function loadStudy() {
    try {
      setLoading(true);
      const data = await api.getStudy(studyId);
      if (!data || data.detail === 'Not found') {
        router.push('/');
        return;
      }
      setStudy(data);
      const pkData = data.derived_pk || data.pk_properties;
      if (pkData) {
        setPk(pkData);
        setLoading(false);
      } else {
        setLoading(false);
        setPolling(true);
        pollForPK();
      }
    } catch {
      setError('Unable to connect to backend. Make sure the API server is running.');
      setLoading(false);
    }
  }

  function pollForPK() {
    let attempts = 0;
    const maxAttempts = 30;
    const interval = setInterval(async () => {
      attempts++;
      try {
        const data = await api.getStudy(studyId);
        const pkData = data.derived_pk || data.pk_properties;
        if (pkData) {
          setPk(pkData);
          setStudy(data);
          setPolling(false);
          clearInterval(interval);
        }
        if (attempts >= maxAttempts) {
          setPolling(false);
          setError('Drug lookup timed out. Please try refreshing.');
          clearInterval(interval);
        }
      } catch {
        clearInterval(interval);
        setPolling(false);
        setError('Unable to connect to backend.');
      }
    }, 2000);
  }

  async function handleRetryLookup() {
    try {
      await api.lookupDrug(studyId);
      setPolling(true);
      setError(null);
      pollForPK();
    } catch {
      setError('Failed to trigger drug lookup.');
    }
  }

  function startEdit(field: string) {
    setEditField(field);
    setSaveError(null);
    if (pk) setEditValues({ ...pk });
  }

  function cancelEdit() {
    setEditField(null);
    setEditValues({});
    setSaveError(null);
  }

  async function saveEdit(field: string) {
    if (!pk || !editValues) return;
    setSaving(true);
    setSaveError(null);
    try {
      const patch: Record<string, unknown> = {};
      patch[field] = editValues[field as keyof DerivedPKProperties];
      const updated = await api.patchPK(studyId, patch);
      if (updated && !updated.detail) {
        setPk(updated);
      } else {
        // fallback: update local state optimistically
        setPk({ ...pk, ...patch } as DerivedPKProperties);
      }
      setEditField(null);
      setEditValues({});
    } catch {
      setSaveError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  // Safety flag helpers
  function startEditFlag(idx: number) {
    if (!pk) return;
    setEditingFlagIdx(idx);
    setFlagDraft({ ...pk.safety_flags[idx] });
  }

  function cancelEditFlag() {
    setEditingFlagIdx(null);
    setFlagDraft(null);
  }

  async function saveFlag(idx: number) {
    if (!pk || !flagDraft) return;
    setSaving(true);
    try {
      const newFlags = [...pk.safety_flags];
      newFlags[idx] = flagDraft;
      const updated = await api.patchPK(studyId, { safety_flags: newFlags });
      if (updated && !updated.detail) {
        setPk(updated);
      } else {
        setPk({ ...pk, safety_flags: newFlags });
      }
      setEditingFlagIdx(null);
      setFlagDraft(null);
    } catch {
      setSaveError('Failed to save flag.');
    } finally {
      setSaving(false);
    }
  }

  async function deleteFlag(idx: number) {
    if (!pk) return;
    setSaving(true);
    try {
      const newFlags = pk.safety_flags.filter((_, i) => i !== idx);
      const updated = await api.patchPK(studyId, { safety_flags: newFlags });
      if (updated && !updated.detail) {
        setPk(updated);
      } else {
        setPk({ ...pk, safety_flags: newFlags });
      }
    } catch {
      setSaveError('Failed to delete flag.');
    } finally {
      setSaving(false);
    }
  }

  async function addFlag() {
    if (!pk) return;
    const newFlag: SafetyFlag = { type: 'New Flag', description: '', requirements: [] };
    const newFlags = [...pk.safety_flags, newFlag];
    setSaving(true);
    try {
      const updated = await api.patchPK(studyId, { safety_flags: newFlags });
      if (updated && !updated.detail) {
        setPk(updated);
        setEditingFlagIdx(newFlags.length - 1);
        setFlagDraft(newFlag);
      } else {
        setPk({ ...pk, safety_flags: newFlags });
        setEditingFlagIdx(newFlags.length - 1);
        setFlagDraft(newFlag);
      }
    } catch {
      setSaveError('Failed to add flag.');
    } finally {
      setSaving(false);
    }
  }

  const drugName = study?.drug_profile?.drug_name || 'Drug';
  const dose = study?.drug_profile?.dose || '';
  const pageTitle = `${drugName}${dose ? ' ' + dose : ''} — PK Profile`;

  if (loading) {
    return (
      <div className="flex min-h-screen" style={{ background: 'var(--bg)' }}>
        <Sidebar studyId={studyId} studyLabel={studyId} />
        <TopBar crumbs={[{ label: 'Studies', href: '/' }, { label: studyId, href: `/studies/${studyId}` }, { label: 'Drug Properties' }]} />
        <main className="content-area flex-1 flex items-center justify-center">
          <div style={{ textAlign: 'center' }}>
            <div
              className="w-8 h-8 rounded-full border-2 animate-spin mx-auto mb-3"
              style={{ borderColor: 'var(--border)', borderTopColor: 'var(--teal)' }}
            />
            <p style={{ fontSize: 13, color: 'var(--text-3)' }}>Loading study...</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg)' }}>
      <Sidebar studyId={studyId} studyLabel={studyId} />
      <TopBar
        crumbs={[
          { label: 'Studies', href: '/' },
          { label: studyId, href: `/studies/${studyId}` },
          { label: 'Drug Properties' },
        ]}
        studyStatus={study?.status}
      />

      <main className="content-area flex-1">
        <div style={{ maxWidth: 1000, margin: '0 auto', padding: '20px 24px 60px' }}>

          {/* Page header */}
          <div
            className="flex items-start justify-between pb-4 mb-5"
            style={{ borderBottom: '1px solid var(--border)' }}
          >
            <div>
              <h1 className="font-semibold" style={{ fontSize: 16, color: 'var(--text)', margin: 0 }}>
                {pageTitle}
              </h1>
              <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
                Pharmacokinetic profile — click any value to edit before generating protocol
              </p>
            </div>
            {pk && (
              <Link
                href={`/studies/${studyId}/protocol`}
                style={{
                  fontSize: 12,
                  color: 'white',
                  background: 'var(--teal)',
                  borderRadius: 3,
                  padding: '6px 14px',
                  textDecoration: 'none',
                  fontWeight: 500,
                }}
              >
                Confirm & Continue →
              </Link>
            )}
          </div>

          {/* Save error */}
          {saveError && (
            <div
              className="mb-4 px-4 py-3 text-sm"
              style={{
                background: 'var(--critical-bg)',
                border: '1px solid var(--critical-border)',
                borderRadius: 3,
                color: 'var(--critical)',
              }}
            >
              {saveError}
            </div>
          )}

          {/* Error */}
          {error && (
            <div
              className="mb-5 px-4 py-3 flex items-center justify-between text-sm"
              style={{
                background: 'var(--critical-bg)',
                border: '1px solid var(--critical-border)',
                borderRadius: 3,
                color: 'var(--critical)',
              }}
            >
              <span>{error}</span>
              <button
                onClick={handleRetryLookup}
                style={{ fontSize: 12, textDecoration: 'underline', color: 'var(--critical)', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                Retry lookup
              </button>
            </div>
          )}

          {/* Polling / loading state */}
          {polling && !pk && (
            <div
              className="mb-6 flex flex-col items-center"
              style={{
                background: 'var(--teal-light)',
                border: '1px solid rgba(15,123,108,0.25)',
                borderRadius: 3,
                padding: '40px 24px',
                textAlign: 'center',
              }}
            >
              <div style={{ position: 'relative', marginBottom: 20 }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    background: 'rgba(15,123,108,0.15)',
                    position: 'absolute',
                    top: -8,
                    left: -8,
                    animation: 'skeleton-pulse 1.4s ease-in-out infinite',
                  }}
                />
                <div
                  className="w-6 h-6 rounded-full border-2 animate-spin"
                  style={{ borderColor: 'rgba(15,123,108,0.25)', borderTopColor: 'var(--teal)' }}
                />
              </div>
              <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>
                Looking up <span style={{ color: 'var(--teal)' }}>{drugName}</span> pharmacokinetic profile...
              </p>
              <p style={{ fontSize: 12, color: 'var(--text-3)' }}>
                Querying FDA label, EMA EPAR, and published literature · 10–30 seconds
              </p>
            </div>
          )}

          {!polling && !pk && !error && (
            <div
              className="mb-5 px-4 py-3 flex items-center justify-between text-sm"
              style={{
                background: 'var(--warning-bg)',
                border: '1px solid var(--warning-border)',
                borderRadius: 3,
                color: 'var(--warning)',
              }}
            >
              Drug lookup pending.
              <button
                onClick={handleRetryLookup}
                style={{ fontSize: 12, textDecoration: 'underline', color: 'var(--warning)', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                Trigger lookup
              </button>
            </div>
          )}

          {pk && (
            <div className="space-y-5">

              {/* Clinical methodology banner */}
              <div
                style={{
                  background: 'var(--info-bg)',
                  border: '1px solid #BDD7FF',
                  borderLeft: '3px solid var(--info)',
                  borderRadius: 3,
                  padding: '12px 16px',
                }}
              >
                <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--info)', margin: 0, marginBottom: 6 }}>
                  How these values are derived
                </p>
                <p style={{ fontSize: 12, color: 'var(--text-2)', margin: 0, lineHeight: 1.6 }}>
                  PK parameters (t½, Tmax, intrasubject CV) are sourced from the <strong>originator product label</strong> and the drug-specific <strong>FDA BE Recommendation</strong> for this molecule, cross-referenced with <strong>ICH M13A (2023)</strong>. Derived parameters — washout (formula: 5×t½, minimum 7 days), confinement, and sample size — are calculated from those PK values using standard ICH and FDA formulas. Source documents are listed in the Sources panel below. <strong>Always verify against the current FDA BE Recommendation for this drug before finalising the protocol.</strong>
                </p>
              </div>

              {/* Pharmacokinetics */}
              <section>
                <div className="section-header"><span>Pharmacokinetics</span></div>
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 3 }}>
                  <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                    <tbody>
                      <EditRow
                        label="t½"
                        value={`${pk.half_life_hours} h`}
                        source={pk.source_references[0]}
                        field="half_life_hours"
                        type="number"
                        unit="hours"
                        editField={editField}
                        editValues={editValues}
                        setEditValues={setEditValues}
                        onEdit={startEdit}
                        onSave={saveEdit}
                        onCancel={cancelEdit}
                        saving={saving}
                      />
                      <EditRow
                        label="Tmax"
                        value={`${pk.tmax_hours} h`}
                        source="FDA label"
                        field="tmax_hours"
                        type="number"
                        unit="hours"
                        editField={editField}
                        editValues={editValues}
                        setEditValues={setEditValues}
                        onEdit={startEdit}
                        onSave={saveEdit}
                        onCancel={cancelEdit}
                        saving={saving}
                      />
                      {pk.intrasubject_cv !== undefined && (
                        <EditRow
                          label="Intrasubject CV"
                          value={`${pk.intrasubject_cv} %`}
                          source="FDA BE recommendation"
                          field="intrasubject_cv"
                          type="number"
                          unit="%"
                          editField={editField}
                          editValues={editValues}
                          setEditValues={setEditValues}
                          onEdit={startEdit}
                          onSave={saveEdit}
                          onCancel={cancelEdit}
                          saving={saving}
                        />
                      )}
                      <EditRow
                        label="Absorption class"
                        value={pk.absorption_class}
                        field="absorption_class"
                        type="text"
                        editField={editField}
                        editValues={editValues}
                        setEditValues={setEditValues}
                        onEdit={startEdit}
                        onSave={saveEdit}
                        onCancel={cancelEdit}
                        saving={saving}
                        isLast
                      />
                    </tbody>
                  </table>
                </div>
              </section>

              {/* Derived Study Parameters */}
              <section>
                <div className="section-header"><span>Derived Study Parameters</span></div>
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 3 }}>
                  <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                    <tbody>
                      <EditRow
                        label="Washout period"
                        value={`${pk.washout_days} days`}
                        note={`≥ 5 × t½ = ${Math.round(pk.half_life_hours * 5)}h → ${pk.washout_days} days`}
                        field="washout_days"
                        type="number"
                        unit="days"
                        editField={editField}
                        editValues={editValues}
                        setEditValues={setEditValues}
                        onEdit={startEdit}
                        onSave={saveEdit}
                        onCancel={cancelEdit}
                        saving={saving}
                        isInteger
                      />
                      <EditRow
                        label="In-house confinement"
                        value={`${pk.confinement_hours} h`}
                        field="confinement_hours"
                        type="number"
                        unit="hours"
                        editField={editField}
                        editValues={editValues}
                        setEditValues={setEditValues}
                        onEdit={startEdit}
                        onSave={saveEdit}
                        onCancel={cancelEdit}
                        saving={saving}
                        isInteger
                      />
                      <EditRow
                        label="Posture restriction"
                        value={pk.posture_restriction || 'None'}
                        field="posture_restriction"
                        type="text"
                        editField={editField}
                        editValues={editValues}
                        setEditValues={setEditValues}
                        onEdit={startEdit}
                        onSave={saveEdit}
                        onCancel={cancelEdit}
                        saving={saving}
                      />
                      <ArrayEditRow
                        label="Ambulatory visits"
                        values={pk.ambulatory_visits}
                        field="ambulatory_visits"
                        type="strings"
                        editField={editField}
                        editValues={editValues}
                        setEditValues={setEditValues}
                        onEdit={startEdit}
                        onSave={saveEdit}
                        onCancel={cancelEdit}
                        saving={saving}
                        isLast
                      />
                    </tbody>
                  </table>
                </div>
              </section>

              {/* Sample Size */}
              <section>
                <div className="section-header"><span>Sample Size</span></div>
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 3 }}>
                  <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                    <tbody>
                      <EditRow
                        label="Required (80% power, α=0.05, GMR=1.00)"
                        value={`${pk.sample_size_recommended} subjects`}
                        field="sample_size_recommended"
                        type="number"
                        unit="subjects"
                        editField={editField}
                        editValues={editValues}
                        setEditValues={setEditValues}
                        onEdit={startEdit}
                        onSave={saveEdit}
                        onCancel={cancelEdit}
                        saving={saving}
                        isInteger
                      />
                      <EditRow
                        label="Sample size basis"
                        value={pk.sample_size_basis || '—'}
                        field="sample_size_basis"
                        type="text"
                        editField={editField}
                        editValues={editValues}
                        setEditValues={setEditValues}
                        onEdit={startEdit}
                        onSave={saveEdit}
                        onCancel={cancelEdit}
                        saving={saving}
                        isLast
                      />
                    </tbody>
                  </table>
                </div>
              </section>

              {/* PK Sampling Schedule */}
              <section>
                <div className="section-header"><span>PK Sampling Schedule</span></div>
                <div
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 3,
                    padding: '16px',
                  }}
                >
                  {editField === 'pk_sampling_timepoints' ? (
                    <div>
                      <label style={{ fontSize: 11, color: 'var(--text-3)', display: 'block', marginBottom: 6 }}>
                        Timepoints (comma-separated numbers in hours)
                      </label>
                      <input
                        type="text"
                        autoFocus
                        value={
                          Array.isArray(editValues.pk_sampling_timepoints)
                            ? editValues.pk_sampling_timepoints.join(', ')
                            : ''
                        }
                        onChange={e => {
                          const raw = e.target.value;
                          const parsed = raw.split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n));
                          setEditValues({ ...editValues, pk_sampling_timepoints: parsed });
                        }}
                        style={{
                          width: '100%',
                          fontFamily: 'var(--mono)',
                          fontSize: 12,
                          padding: '6px 10px',
                          border: '1px solid var(--teal)',
                          borderRadius: 3,
                          color: 'var(--text)',
                          background: 'var(--surface)',
                          marginBottom: 8,
                        }}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => saveEdit('pk_sampling_timepoints')}
                          disabled={saving}
                          style={{ fontSize: 12, color: 'white', background: 'var(--teal)', border: 'none', borderRadius: 3, padding: '5px 12px', cursor: 'pointer' }}
                        >
                          {saving ? 'Saving…' : 'Save'}
                        </button>
                        <button
                          onClick={cancelEdit}
                          style={{ fontSize: 12, color: 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer' }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-wrap gap-2 mb-3">
                        {pk.pk_sampling_timepoints.map((tp, i) => (
                          <span
                            key={i}
                            className="font-mono"
                            style={{
                              fontSize: 12,
                              padding: '3px 8px',
                              background: 'var(--surface-2)',
                              border: '1px solid var(--border)',
                              borderRadius: 3,
                              color: 'var(--text)',
                            }}
                          >
                            {tp}h
                          </span>
                        ))}
                        <button
                          onClick={() => {
                            setEditField('pk_sampling_timepoints');
                            setEditValues({ ...pk });
                          }}
                          style={{
                            fontSize: 11,
                            color: 'var(--text-3)',
                            background: 'none',
                            border: '1px solid var(--border)',
                            borderRadius: 3,
                            padding: '3px 8px',
                            cursor: 'pointer',
                          }}
                        >
                          Edit
                        </button>
                      </div>
                      <p
                        className="font-mono"
                        style={{
                          fontSize: 11,
                          color: 'var(--text-3)',
                          background: 'var(--surface-2)',
                          border: '1px solid var(--border)',
                          borderRadius: 3,
                          padding: '6px 10px',
                          textAlign: 'center',
                        }}
                      >
                        {pk.pk_sampling_timepoints.length} samples per period · 3 mL each · K₂EDTA ·{' '}
                        Total: {pk.pk_sampling_timepoints.length * 3} mL/period
                      </p>
                    </>
                  )}
                </div>
              </section>

              {/* Safety Flags */}
              <section>
                <div className="section-header flex items-center justify-between">
                  <span>Safety Flags</span>
                  <button
                    onClick={addFlag}
                    disabled={saving}
                    style={{
                      fontSize: 11,
                      color: 'var(--teal)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    + Add flag
                  </button>
                </div>
                {pk.safety_flags && pk.safety_flags.length > 0 ? (
                  <div className="space-y-3">
                    {pk.safety_flags.map((flag, i) => (
                      <div key={i}>
                        {editingFlagIdx === i && flagDraft ? (
                          <div
                            style={{
                              background: 'var(--surface)',
                              border: '1px solid var(--teal)',
                              borderRadius: 3,
                              padding: '14px 16px',
                            }}
                          >
                            <div className="grid gap-3 mb-3" style={{ gridTemplateColumns: '1fr 2fr' }}>
                              <div>
                                <label style={{ fontSize: 11, color: 'var(--text-3)', display: 'block', marginBottom: 4 }}>Type</label>
                                <input
                                  type="text"
                                  value={flagDraft.type}
                                  onChange={e => setFlagDraft({ ...flagDraft, type: e.target.value })}
                                  style={{
                                    width: '100%', fontSize: 12, padding: '5px 8px',
                                    border: '1px solid var(--border)', borderRadius: 3,
                                    color: 'var(--text)', background: 'var(--surface)',
                                  }}
                                />
                              </div>
                              <div>
                                <label style={{ fontSize: 11, color: 'var(--text-3)', display: 'block', marginBottom: 4 }}>Description</label>
                                <input
                                  type="text"
                                  value={flagDraft.description}
                                  onChange={e => setFlagDraft({ ...flagDraft, description: e.target.value })}
                                  style={{
                                    width: '100%', fontSize: 12, padding: '5px 8px',
                                    border: '1px solid var(--border)', borderRadius: 3,
                                    color: 'var(--text)', background: 'var(--surface)',
                                  }}
                                />
                              </div>
                            </div>
                            <div className="mb-3">
                              <label style={{ fontSize: 11, color: 'var(--text-3)', display: 'block', marginBottom: 4 }}>
                                Requirements <span style={{ opacity: 0.7 }}>(one per line)</span>
                              </label>
                              <textarea
                                value={flagDraft.requirements.join('\n')}
                                onChange={e => setFlagDraft({
                                  ...flagDraft,
                                  requirements: e.target.value.split('\n').filter(l => l.trim()),
                                })}
                                rows={3}
                                style={{
                                  width: '100%', fontSize: 12, padding: '5px 8px',
                                  border: '1px solid var(--border)', borderRadius: 3,
                                  color: 'var(--text)', background: 'var(--surface)',
                                  resize: 'vertical', fontFamily: 'inherit',
                                }}
                              />
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => saveFlag(i)}
                                disabled={saving}
                                style={{ fontSize: 12, color: 'white', background: 'var(--teal)', border: 'none', borderRadius: 3, padding: '5px 12px', cursor: 'pointer' }}
                              >
                                {saving ? 'Saving…' : 'Save'}
                              </button>
                              <button
                                onClick={cancelEditFlag}
                                style={{ fontSize: 12, color: 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer' }}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div
                            style={{
                              background: 'var(--warning-bg)',
                              border: '1px solid var(--warning-border)',
                              borderLeft: '3px solid var(--warning)',
                              borderRadius: 3,
                              padding: '12px 16px',
                            }}
                          >
                            <div className="flex items-start justify-between">
                              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--warning)', marginBottom: 4 }}>
                                ⚠ {flag.type}
                              </p>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => startEditFlag(i)}
                                  style={{ fontSize: 11, color: 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer' }}
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => deleteFlag(i)}
                                  style={{ fontSize: 11, color: 'var(--critical)', background: 'none', border: 'none', cursor: 'pointer' }}
                                >
                                  Remove
                                </button>
                              </div>
                            </div>
                            <p style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: flag.requirements.length > 0 ? 8 : 0 }}>
                              {flag.description}
                            </p>
                            {flag.requirements.length > 0 && (
                              <ul style={{ margin: 0, paddingLeft: 16 }}>
                                {flag.requirements.map((req, j) => (
                                  <li key={j} style={{ fontSize: 11, color: 'var(--text-2)', marginBottom: 2 }}>
                                    {req}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div
                    style={{
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 3,
                      padding: '16px',
                      textAlign: 'center',
                      color: 'var(--text-3)',
                      fontSize: 12,
                    }}
                  >
                    No safety flags — click "+ Add flag" to add drug-specific safety requirements
                  </div>
                )}
              </section>

              {/* Sources */}
              {pk.source_references && pk.source_references.length > 0 && (
                <section>
                  <div className="section-header"><span>Sources</span></div>
                  <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 3, padding: '12px 16px' }}>
                    {pk.source_references.map((ref, i) => (
                      <p key={i} style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: i < pk.source_references.length - 1 ? 4 : 0 }}>
                        {i + 1}. {ref}
                      </p>
                    ))}
                  </div>
                </section>
              )}

              {/* Bottom CTA */}
              <div
                className="flex items-center justify-between pt-4"
                style={{ borderTop: '1px solid var(--border)' }}
              >
                <Link
                  href={`/studies/${studyId}`}
                  style={{ fontSize: 13, color: 'var(--text-3)' }}
                >
                  ← Back to Workspace
                </Link>
                <Link
                  href={`/studies/${studyId}/protocol`}
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: 'white',
                    background: 'var(--teal)',
                    borderRadius: 3,
                    padding: '8px 20px',
                    textDecoration: 'none',
                  }}
                >
                  Confirm & Continue to Protocol →
                </Link>
              </div>

            </div>
          )}

        </div>
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// EditRow — single scalar field (number or text)
// ─────────────────────────────────────────────────────────────
function EditRow({
  label, value, source, note, field, type, unit, isInteger, isLast,
  editField, editValues, setEditValues, onEdit, onSave, onCancel, saving,
}: {
  label: string;
  value: string;
  source?: string;
  note?: string;
  field: string;
  type: 'number' | 'text';
  unit?: string;
  isInteger?: boolean;
  isLast?: boolean;
  editField: string | null;
  editValues: Partial<DerivedPKProperties>;
  setEditValues: (v: Partial<DerivedPKProperties>) => void;
  onEdit: (f: string) => void;
  onSave: (f: string) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const isEditing = editField === field;
  const currentVal = editValues[field as keyof DerivedPKProperties];

  return (
    <tr style={{ borderBottom: isLast ? 'none' : '1px solid var(--border)' }}>
      <td
        style={{
          padding: '8px 16px',
          width: 240,
          fontSize: 12,
          color: 'var(--text-3)',
          fontWeight: 500,
          background: 'var(--surface-2)',
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </td>
      <td style={{ padding: '8px 16px' }}>
        {isEditing ? (
          <div className="flex items-center gap-2">
            <input
              type={type === 'number' ? 'number' : 'text'}
              value={String(currentVal ?? '')}
              onChange={e => setEditValues({
                ...editValues,
                [field]: type === 'number'
                  ? (isInteger ? parseInt(e.target.value) : parseFloat(e.target.value))
                  : e.target.value,
              })}
              autoFocus
              style={{
                width: type === 'text' ? 240 : 100,
                fontFamily: type === 'number' ? 'var(--mono)' : 'inherit',
                fontSize: 12,
                padding: '4px 8px',
                border: '1px solid var(--teal)',
                borderRadius: 3,
                color: 'var(--text)',
                background: 'var(--surface)',
              }}
            />
            {unit && <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{unit}</span>}
            <button
              onClick={() => onSave(field)}
              disabled={saving}
              style={{ fontSize: 11, color: 'white', background: 'var(--teal)', border: 'none', borderRadius: 3, padding: '3px 10px', cursor: 'pointer' }}
            >
              {saving ? '…' : 'Save'}
            </button>
            <button
              onClick={onCancel}
              style={{ fontSize: 11, color: 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <span className="font-mono" style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>
              {value}
            </span>
            {source && (
              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>Source: {source}</span>
            )}
            {note && (
              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>({note})</span>
            )}
            <button
              onClick={() => onEdit(field)}
              style={{
                marginLeft: 'auto',
                fontSize: 11,
                color: 'var(--text-3)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Edit
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}

// ─────────────────────────────────────────────────────────────
// ArrayEditRow — comma-separated array field
// ─────────────────────────────────────────────────────────────
function ArrayEditRow({
  label, values, field, type, isLast,
  editField, editValues, setEditValues, onEdit, onSave, onCancel, saving,
}: {
  label: string;
  values: string[];
  field: string;
  type: 'strings' | 'numbers';
  isLast?: boolean;
  editField: string | null;
  editValues: Partial<DerivedPKProperties>;
  setEditValues: (v: Partial<DerivedPKProperties>) => void;
  onEdit: (f: string) => void;
  onSave: (f: string) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const isEditing = editField === field;
  const currentArr = (editValues[field as keyof DerivedPKProperties] as string[] | undefined) ?? values;

  return (
    <tr style={{ borderBottom: isLast ? 'none' : '1px solid var(--border)' }}>
      <td
        style={{
          padding: '8px 16px',
          width: 240,
          fontSize: 12,
          color: 'var(--text-3)',
          fontWeight: 500,
          background: 'var(--surface-2)',
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </td>
      <td style={{ padding: '8px 16px' }}>
        {isEditing ? (
          <div>
            <input
              type="text"
              autoFocus
              value={Array.isArray(currentArr) ? currentArr.join(', ') : ''}
              onChange={e => {
                const raw = e.target.value;
                const parsed = raw.split(',').map(s => s.trim()).filter(Boolean);
                setEditValues({ ...editValues, [field]: parsed });
              }}
              placeholder="Comma-separated values"
              style={{
                width: 300,
                fontFamily: 'var(--mono)',
                fontSize: 12,
                padding: '4px 8px',
                border: '1px solid var(--teal)',
                borderRadius: 3,
                color: 'var(--text)',
                background: 'var(--surface)',
                marginRight: 8,
              }}
            />
            <button
              onClick={() => onSave(field)}
              disabled={saving}
              style={{ fontSize: 11, color: 'white', background: 'var(--teal)', border: 'none', borderRadius: 3, padding: '4px 10px', cursor: 'pointer' }}
            >
              {saving ? '…' : 'Save'}
            </button>
            {' '}
            <button
              onClick={onCancel}
              style={{ fontSize: 11, color: 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <span className="font-mono" style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>
              {values.length > 0 ? values.join(', ') : 'None'}
            </span>
            <button
              onClick={() => {
                onEdit(field);
              }}
              style={{
                marginLeft: 'auto',
                fontSize: 11,
                color: 'var(--text-3)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Edit
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}
