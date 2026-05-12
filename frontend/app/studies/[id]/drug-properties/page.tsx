'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Sidebar } from '@/components/Sidebar';
import { TopBar } from '@/components/TopBar';
import { api } from '@/lib/api';
import { Study, DerivedPKProperties } from '@/lib/types';

export default function DrugPropertiesPage() {
  const params = useParams();
  const router = useRouter();
  const studyId = params.id as string;

  const [study, setStudy] = useState<Study | null>(null);
  const [pk, setPk] = useState<DerivedPKProperties | null>(null);
  const [loading, setLoading] = useState(true);
  const [polling, setPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editField, setEditField] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<DerivedPKProperties>>({});

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

  async function pollForPK() {
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
    if (pk) setEditValues({ ...pk });
  }

  function cancelEdit() {
    setEditField(null);
    setEditValues({});
  }

  function saveEdit() {
    if (pk && editValues) setPk({ ...pk, ...editValues });
    setEditField(null);
    setEditValues({});
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
                Pharmacokinetic profile — review and edit before generating protocol
              </p>
            </div>
            {pk && (
              <div className="flex gap-2">
                <button
                  onClick={() => startEdit('half_life_hours')}
                  style={{
                    fontSize: 12,
                    color: 'var(--text-2)',
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 3,
                    padding: '6px 14px',
                    cursor: 'pointer',
                  }}
                >
                  Edit
                </button>
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
              </div>
            )}
          </div>

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
              {/* Pulse animation */}
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
                      <PKRow label="t½" value={`${pk.half_life_hours} h`} source={pk.source_references[0]} field="half_life_hours" editField={editField} editValues={editValues} setEditValues={setEditValues} onEdit={startEdit} onSave={saveEdit} onCancel={cancelEdit} unit="hours" />
                      <PKRow label="Tmax" value={`${pk.tmax_hours} h`} source="FDA label" field="tmax_hours" editField={editField} editValues={editValues} setEditValues={setEditValues} onEdit={startEdit} onSave={saveEdit} onCancel={cancelEdit} unit="hours" />
                      {pk.intrasubject_cv !== undefined && (
                        <PKRow label="Intrasubject CV" value={`${pk.intrasubject_cv} %`} source="FDA BE recommendation" field="intrasubject_cv" editField={editField} editValues={editValues} setEditValues={setEditValues} onEdit={startEdit} onSave={saveEdit} onCancel={cancelEdit} unit="%" />
                      )}
                      <PKRow label="Absorption class" value={pk.absorption_class} field="absorption_class" editField={editField} editValues={editValues} setEditValues={setEditValues} onEdit={startEdit} onSave={saveEdit} onCancel={cancelEdit} isText isLast />
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
                      <ParamRow label="Washout period" value={`${pk.washout_days} days`} note={`≥ 5 × t½ = ${Math.round(pk.half_life_hours * 5)}h → ${pk.washout_days} days`} />
                      <ParamRow label="Last PK sample" value={`${pk.pk_sampling_timepoints[pk.pk_sampling_timepoints.length - 1]} h`} note={`≥ 3 × t½ = ${Math.round(pk.half_life_hours * 3)}h → standard`} />
                      <ParamRow label="In-house confinement" value={`${pk.confinement_hours} h`} />
                      <ParamRow label="Ambulatory visits" value={pk.ambulatory_visits.join(', ') || 'None'} mono />
                      <ParamRow label="Posture restriction" value={pk.posture_restriction || 'None'} isLast />
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
                      <ParamRow
                        label="Required (80% power, α=0.05, GMR=1.00)"
                        value={`${pk.sample_size_recommended} subjects`}
                        mono
                      />
                      <ParamRow
                        label="Your target (incl. 15% dropout buffer)"
                        value={`${study?.drug_profile?.target_subjects || 30} subjects`}
                        mono
                      />
                      {pk.intrasubject_cv !== undefined && (
                        <ParamRow
                          label="CV used for calculation"
                          value={`${pk.intrasubject_cv}%`}
                          note="published"
                          mono
                          isLast
                        />
                      )}
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
                </div>
              </section>

              {/* Safety Flags */}
              {pk.safety_flags && pk.safety_flags.length > 0 && (
                <section>
                  <div className="section-header"><span>Safety Flags</span></div>
                  <div className="space-y-3">
                    {pk.safety_flags.map((flag, i) => (
                      <div
                        key={i}
                        style={{
                          background: 'var(--warning-bg)',
                          border: '1px solid var(--warning-border)',
                          borderLeft: '3px solid var(--warning)',
                          borderRadius: 3,
                          padding: '12px 16px',
                        }}
                      >
                        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--warning)', marginBottom: 4 }}>
                          ⚠ {flag.type}
                        </p>
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
                    ))}
                  </div>
                </section>
              )}

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

// PK Row with inline edit
function PKRow({
  label, value, source, field, editField, editValues, setEditValues, onEdit, onSave, onCancel, unit, isText, isLast
}: {
  label: string;
  value: string;
  source?: string;
  field: string;
  editField: string | null;
  editValues: Partial<DerivedPKProperties>;
  setEditValues: (v: Partial<DerivedPKProperties>) => void;
  onEdit: (f: string) => void;
  onSave: () => void;
  onCancel: () => void;
  unit?: string;
  isText?: boolean;
  isLast?: boolean;
}) {
  const isEditing = editField === field;
  const currentVal = editValues[field as keyof DerivedPKProperties];

  return (
    <tr style={{ borderBottom: isLast ? 'none' : '1px solid var(--border)' }}>
      <td
        style={{
          padding: '8px 16px',
          width: 200,
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
              type={isText ? 'text' : 'number'}
              value={String(currentVal ?? '')}
              onChange={e => setEditValues({
                ...editValues,
                [field]: isText ? e.target.value : parseFloat(e.target.value),
              })}
              autoFocus
              style={{
                width: 140,
                fontFamily: 'var(--mono)',
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
              onClick={onSave}
              style={{ fontSize: 11, color: 'var(--teal)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
            >
              Save
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

function ParamRow({
  label, value, note, mono, isLast
}: {
  label: string;
  value: string;
  note?: string;
  mono?: boolean;
  isLast?: boolean;
}) {
  return (
    <tr style={{ borderBottom: isLast ? 'none' : '1px solid var(--border)' }}>
      <td
        style={{
          padding: '8px 16px',
          width: 260,
          fontSize: 12,
          color: 'var(--text-3)',
          fontWeight: 500,
          background: 'var(--surface-2)',
        }}
      >
        {label}
      </td>
      <td style={{ padding: '8px 16px' }}>
        <span
          className={mono ? 'font-mono' : ''}
          style={{ fontSize: 13, color: 'var(--text)', fontWeight: mono ? 500 : 400 }}
        >
          {value}
        </span>
        {note && (
          <span style={{ fontSize: 11, color: 'var(--text-3)', marginLeft: 10 }}>({note})</span>
        )}
      </td>
    </tr>
  );
}
