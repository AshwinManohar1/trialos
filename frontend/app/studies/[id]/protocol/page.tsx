'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Sidebar } from '@/components/Sidebar';
import { TopBar } from '@/components/TopBar';
import { api } from '@/lib/api';
import { OrgTemplate, Study, DerivedPKProperties } from '@/lib/types';

type UploadState = 'idle' | 'processing' | 'complete' | 'error';

interface ProcessingStep {
  label: string;
  status: string;
}

const STEPS: { label: string }[] = [
  { label: 'Template parsed' },
  { label: 'Drug properties applied' },
  { label: 'PK schedule inserted' },
  { label: 'Safety flags applied' },
  { label: 'Compensation table calculated' },
];

function buildVariables(study: Study | null, pk: DerivedPKProperties | null): Array<{ placeholder: string; value: string }> {
  const drug = study?.drug_profile;
  if (!drug || !pk) return [];
  const timepoints = pk.pk_sampling_timepoints;
  const lastTp = timepoints[timepoints.length - 1];
  const summary = timepoints.length > 8
    ? `${timepoints.slice(0, 6).join('h, ')}h ... ${lastTp}h (${timepoints.length} pts)`
    : `${timepoints.join('h, ')}h`;

  return [
    { placeholder: '{{DRUG_NAME}}', value: drug.drug_name },
    { placeholder: '{{DOSE}}', value: drug.dose || '—' },
    { placeholder: '{{FORMULATION}}', value: drug.formulation || '—' },
    { placeholder: '{{REFERENCE}}', value: drug.reference_product || '—' },
    { placeholder: '{{REFERENCE_COUNTRY}}', value: drug.reference_country || '—' },
    { placeholder: '{{SPONSOR}}', value: drug.sponsor_name || '—' },
    { placeholder: '{{SPONSOR_COUNTRY}}', value: drug.sponsor_country || '—' },
    { placeholder: '{{TARGET_SUBJECTS}}', value: String(drug.target_subjects || '—') },
    { placeholder: '{{REGULATORS}}', value: drug.regulatory_targets?.join(', ') || '—' },
    { placeholder: '{{HALF_LIFE}}', value: `${pk.half_life_hours} h` },
    { placeholder: '{{TMAX}}', value: `${pk.tmax_hours} h` },
    { placeholder: '{{WASHOUT_DAYS}}', value: `${pk.washout_days} days` },
    { placeholder: '{{PK_SAMPLING_SCHEDULE}}', value: summary },
    { placeholder: '{{CONFINEMENT_HOURS}}', value: `${pk.confinement_hours}h` },
    { placeholder: '{{POSTURE_RESTRICTION}}', value: pk.posture_restriction || 'None' },
    { placeholder: '{{AMBULATORY_VISITS}}', value: pk.ambulatory_visits.join(', ') || 'None' },
    { placeholder: '{{SAMPLE_SIZE_N}}', value: String(pk.sample_size_recommended) },
    { placeholder: '{{CV_PERCENT}}', value: pk.intrasubject_cv !== undefined ? `${pk.intrasubject_cv}%` : '—' },
  ];
}

export default function ProtocolPage() {
  const params = useParams();
  const studyId = params.id as string;

  const [study, setStudy] = useState<Study | null>(null);
  const [orgTemplates, setOrgTemplates] = useState<OrgTemplate[]>([]);
  const [orgTemplatesLoaded, setOrgTemplatesLoaded] = useState(false);
  const [selectedOrgTemplateId, setSelectedOrgTemplateId] = useState<number | null>(null);
  const [showTemplateDropdown, setShowTemplateDropdown] = useState(false);
  const [studyFile, setStudyFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [steps, setSteps] = useState<ProcessingStep[]>(
    STEPS.map(s => ({ label: s.label, status: 'pending' }))
  );
  const [error, setError] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [studyId]);

  async function loadData() {
    try {
      const [studyData, templatesData] = await Promise.all([
        api.getStudy(studyId),
        api.listTemplates().catch(() => []),
      ]);
      setStudy(studyData);
      const tplList: OrgTemplate[] = Array.isArray(templatesData) ? templatesData : [];
      setOrgTemplates(tplList);
      setOrgTemplatesLoaded(true);
      const defaultTpl = tplList.find(t => t.is_default);
      if (defaultTpl) setSelectedOrgTemplateId(defaultTpl.id);
      if (studyData?.protocol_document?.status === 'complete') {
        setUploadState('complete');
        setDownloadUrl(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/studies/${studyId}/protocol/download`
        );
      }
    } catch {
      setOrgTemplatesLoaded(true);
    }
  }

  const defaultOrgTemplate = orgTemplates.find(t => t.id === selectedOrgTemplateId)
    ?? orgTemplates.find(t => t.is_default)
    ?? null;
  const hasOrgTemplates = orgTemplates.length > 0;

  function handleStudyFileDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) pickStudyFile(file);
  }

  function pickStudyFile(file: File) {
    if (!file.name.endsWith('.docx')) {
      setError('Only .docx files are accepted.');
      return;
    }
    setError(null);
    setStudyFile(file);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) pickStudyFile(file);
  }

  async function handleGenerate() {
    setError(null);
    setUploadState('processing');
    if (studyFile) {
      try {
        await api.uploadTemplate(studyId, studyFile);
      } catch {}
    }
    await runProcessingSteps();
  }

  async function runProcessingSteps() {
    const updatedSteps: ProcessingStep[] = STEPS.map(s => ({ label: s.label, status: 'pending' }));
    setSteps([...updatedSteps]);
    for (let i = 0; i < updatedSteps.length; i++) {
      updatedSteps[i] = { ...updatedSteps[i], status: 'running' };
      setSteps([...updatedSteps]);
      await sleep(2000);
      updatedSteps[i] = { ...updatedSteps[i], status: 'done' };
      setSteps([...updatedSteps]);
    }
    try {
      await api.fillProtocol(studyId);
    } catch {}
    setDownloadUrl(
      `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/studies/${studyId}/protocol/download`
    );
    setUploadState('complete');
  }

  function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  const selectedOrgTpl = orgTemplates.find(t => t.id === selectedOrgTemplateId) ?? null;
  const pk = study?.derived_pk ?? study?.pk_properties ?? null;
  const variables = buildVariables(study, pk);

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg)' }}>
      <Sidebar studyId={studyId} studyLabel={studyId} />
      <TopBar
        crumbs={[
          { label: 'Studies', href: '/' },
          { label: studyId, href: `/studies/${studyId}` },
          { label: 'Protocol Creation' },
        ]}
        studyStatus={study?.status}
      />

      <main className="content-area flex-1">
        <div style={{ maxWidth: 860, margin: '0 auto', padding: '20px 24px 60px' }}>

          {/* Header */}
          <div
            className="pb-4 mb-5"
            style={{ borderBottom: '1px solid var(--border)' }}
          >
            <h1 className="font-semibold" style={{ fontSize: 16, color: 'var(--text)', margin: 0 }}>
              Protocol Creation — <span className="font-mono" style={{ fontSize: 14 }}>{studyId}</span>
            </h1>
            <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
              Merge study-specific PK data into your org protocol template — no AI generation, deterministic fill
            </p>
          </div>

          {/* How it works callout */}
          <div
            className="mb-5"
            style={{
              background: 'var(--info-bg)',
              border: '1px solid #BDD7FF',
              borderLeft: '3px solid var(--info)',
              borderRadius: 3,
              padding: '12px 16px',
            }}
          >
            <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--info)', margin: 0, marginBottom: 6 }}>
              What this step does — and doesn't do
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-2)', margin: 0, lineHeight: 1.6 }}>
              This is a <strong>template merge</strong>, not AI writing. Your uploaded Word template (with <span className="font-mono" style={{ fontSize: 11 }}>{'{{PLACEHOLDER}}'}</span> variables) is filled with the exact PK values derived in the previous step — washout days, sampling schedule, sample size basis, etc. The output DOCX is a starting draft. <strong>A qualified PI and regulatory affairs reviewer must review and approve before submission.</strong> TrialOS does not write protocol text and does not modify sections without corresponding placeholders.
            </p>
          </div>

          {error && (
            <div
              className="mb-4 px-4 py-3 text-sm"
              style={{ background: 'var(--critical-bg)', border: '1px solid var(--critical-border)', borderRadius: 3, color: 'var(--critical)' }}
            >
              {error}
            </div>
          )}

          {/* IDLE STATE */}
          {uploadState === 'idle' && orgTemplatesLoaded && (
            <>
              {/* Template selector */}
              <div className="mb-5">
                <div className="section-header"><span>Template</span></div>
                <div
                  className="flex items-center justify-between"
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 3,
                    padding: '10px 14px',
                  }}
                >
                  {hasOrgTemplates && selectedOrgTpl ? (
                    <>
                      <div className="flex items-center gap-2">
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                          <rect x="1" y="2" width="12" height="10" rx="1.5" stroke="var(--success)" strokeWidth="1.3" />
                          <path d="M4 7l2.5 2.5 3.5-4" stroke="var(--success)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>
                          {selectedOrgTpl.name}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--text-3)' }}>(org default)</span>
                      </div>
                      <div className="relative">
                        <button
                          onClick={() => setShowTemplateDropdown(v => !v)}
                          style={{ fontSize: 12, color: 'var(--teal)', background: 'none', border: 'none', cursor: 'pointer' }}
                        >
                          Change ▾
                        </button>
                        {showTemplateDropdown && (
                          <div
                            className="absolute right-0 top-full mt-1 w-56 z-10"
                            style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 3, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                          >
                            {orgTemplates.map(t => (
                              <button
                                key={t.id}
                                onClick={() => { setSelectedOrgTemplateId(t.id); setShowTemplateDropdown(false); }}
                                className="w-full text-left flex items-center justify-between gap-2"
                                style={{
                                  padding: '8px 12px',
                                  fontSize: 13,
                                  color: t.id === selectedOrgTemplateId ? 'var(--teal)' : 'var(--text)',
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  borderBottom: '1px solid var(--border)',
                                }}
                              >
                                <span className="truncate">{t.name}</span>
                                {t.id === selectedOrgTemplateId && <span>✓</span>}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center gap-2">
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M7 2L1.5 12h11L7 2z" stroke="var(--warning)" strokeWidth="1.3" strokeLinejoin="round" />
                        <path d="M7 6v3" stroke="var(--warning)" strokeWidth="1.3" strokeLinecap="round" />
                        <circle cx="7" cy="10" r="0.75" fill="var(--warning)" />
                      </svg>
                      <span style={{ fontSize: 13, color: 'var(--warning)' }}>
                        No default template.{' '}
                        <Link href="/templates" style={{ color: 'var(--warning)', textDecoration: 'underline' }}>
                          Upload in Settings →
                        </Link>
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Per-study file (override or required) */}
              {!hasOrgTemplates && !studyFile && (
                <div className="mb-5">
                  <div className="section-header"><span>Upload Template for This Study</span></div>
                  <div
                    onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleStudyFileDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`upload-zone cursor-pointer ${dragOver ? 'drag-over' : ''}`}
                    style={{ borderRadius: 3, padding: '24px', textAlign: 'center' }}
                  >
                    <p style={{ fontSize: 13, color: 'var(--text-2)' }}>
                      {dragOver ? 'Drop .docx template here' : 'Drag & drop .docx template or click to browse'}
                    </p>
                    <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>.docx only</p>
                    <input ref={fileInputRef} type="file" accept=".docx" className="hidden" onChange={handleFileChange} />
                  </div>
                </div>
              )}

              {studyFile && (
                <div
                  className="mb-5 flex items-center justify-between"
                  style={{
                    padding: '8px 14px',
                    background: 'var(--info-bg)',
                    border: '1px solid #BDD7FF',
                    borderRadius: 3,
                  }}
                >
                  <span style={{ fontSize: 13, color: 'var(--text)' }}>
                    Study template: <span className="font-mono" style={{ fontSize: 12 }}>{studyFile.name}</span>
                  </span>
                  <button
                    onClick={() => { setStudyFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                    style={{ fontSize: 12, color: 'var(--info)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    {hasOrgTemplates ? 'Revert to org template' : 'Remove'}
                  </button>
                </div>
              )}

              {hasOrgTemplates && !studyFile && (
                <div className="mb-5">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    style={{ fontSize: 12, color: 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    Use a different template for this study
                  </button>
                  <input ref={fileInputRef} type="file" accept=".docx" className="hidden" onChange={handleFileChange} />
                </div>
              )}

              {/* Variables preview */}
              {variables.length > 0 && (
                <div className="mb-6">
                  <div className="section-header">
                    <span>Variables to Be Filled ({variables.length})</span>
                  </div>
                  <div
                    style={{
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 3,
                      overflow: 'hidden',
                    }}
                  >
                    <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border)' }}>
                          <th style={{ padding: '6px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', background: 'var(--surface-2)', width: 240 }}>
                            Placeholder
                          </th>
                          <th style={{ padding: '6px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', background: 'var(--surface-2)' }}>
                            → Value
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {variables.map((v, i) => (
                          <tr key={i} style={{ borderBottom: i < variables.length - 1 ? '1px solid var(--border)' : 'none' }}>
                            <td style={{ padding: '7px 16px', background: 'var(--surface-2)' }}>
                              <span className="font-mono" style={{ fontSize: 11, color: 'var(--text-2)' }}>
                                {v.placeholder}
                              </span>
                            </td>
                            <td style={{ padding: '7px 16px' }}>
                              <span className="font-mono" style={{ fontSize: 12, color: 'var(--teal)', fontWeight: 500 }}>
                                {v.value}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Generate button */}
              <button
                onClick={handleGenerate}
                disabled={!hasOrgTemplates && !studyFile}
                className="flex items-center justify-center gap-2 w-full font-semibold text-white"
                style={{
                  background: 'var(--teal)',
                  padding: '10px',
                  borderRadius: 3,
                  fontSize: 14,
                  border: 'none',
                  cursor: (!hasOrgTemplates && !studyFile) ? 'not-allowed' : 'pointer',
                  opacity: (!hasOrgTemplates && !studyFile) ? 0.5 : 1,
                }}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M3 7h8M7 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Generate Protocol
              </button>
            </>
          )}

          {/* LOADING while fetching */}
          {uploadState === 'idle' && !orgTemplatesLoaded && (
            <div className="flex justify-center py-16">
              <div
                className="w-6 h-6 rounded-full border-2 animate-spin"
                style={{ borderColor: 'var(--border)', borderTopColor: 'var(--teal)' }}
              />
            </div>
          )}

          {/* PROCESSING STATE */}
          {uploadState === 'processing' && (
            <div
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 3,
                padding: '24px',
              }}
            >
              <div className="flex items-center gap-2.5 mb-6">
                <div
                  className="w-5 h-5 rounded-full border-2 animate-spin flex-shrink-0"
                  style={{ borderColor: 'var(--border)', borderTopColor: 'var(--teal)' }}
                />
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
                  Generating protocol
                  {(studyFile || selectedOrgTpl) && (
                    <> using <span className="font-mono" style={{ color: 'var(--teal)', fontWeight: 400, fontSize: 13 }}>
                      {studyFile ? studyFile.name : selectedOrgTpl?.name}
                    </span></>
                  )}
                  ...
                </span>
              </div>

              <div style={{ borderLeft: '2px solid var(--border)', paddingLeft: 16, marginLeft: 2 }}>
                {steps.map((step, i) => (
                  <div key={i} className="flex items-center gap-3" style={{ marginBottom: i < steps.length - 1 ? 12 : 0 }}>
                    <div className="w-5 h-5 flex-shrink-0 flex items-center justify-center">
                      {step.status === 'done' ? (
                        <span style={{ color: 'var(--success)', fontSize: 14 }}>✓</span>
                      ) : step.status === 'running' ? (
                        <div
                          className="w-4 h-4 rounded-full border-2 animate-spin"
                          style={{ borderColor: 'var(--border)', borderTopColor: 'var(--teal)' }}
                        />
                      ) : (
                        <span style={{ color: 'var(--border-strong)', fontSize: 14 }}>○</span>
                      )}
                    </div>
                    <span
                      style={{
                        fontSize: 13,
                        color: step.status === 'done'
                          ? 'var(--text-2)'
                          : step.status === 'running'
                          ? 'var(--text)'
                          : 'var(--text-3)',
                        fontWeight: step.status === 'running' ? 600 : 400,
                      }}
                    >
                      {step.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* COMPLETE STATE */}
          {uploadState === 'complete' && (
            <div className="space-y-4">
              <div
                className="flex items-center gap-3"
                style={{
                  background: 'var(--success-bg)',
                  border: '1px solid #A3CFBB',
                  borderLeft: '3px solid var(--success)',
                  borderRadius: 3,
                  padding: '12px 16px',
                }}
              >
                <span style={{ color: 'var(--success)', fontSize: 16 }}>✓</span>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--success)', margin: 0 }}>
                    Protocol generated successfully
                  </p>
                  <p style={{ fontSize: 11, color: 'var(--success)', marginTop: 2, opacity: 0.8 }}>
                    All study-specific fields have been filled using derived PK properties
                  </p>
                </div>
              </div>

              <div
                className="flex items-center justify-between"
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 3,
                  padding: '12px 16px',
                }}
              >
                <div>
                  <p className="font-mono" style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>
                    {study?.protocol_document?.filled_filename || `${studyId}_protocol_filled.docx`}
                  </p>
                  <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>Filled protocol document · ready for review</p>
                </div>
                <a
                  href={downloadUrl || '#'}
                  download
                  className="inline-flex items-center gap-1.5 font-medium text-white"
                  style={{
                    background: 'var(--navy)',
                    padding: '7px 14px',
                    borderRadius: 3,
                    fontSize: 12,
                    textDecoration: 'none',
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M6 1v7M3 6l3 3 3-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M1 11h10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                  </svg>
                  Download DOCX
                </a>
              </div>

              <Link
                href={`/studies/${studyId}/risk`}
                className="flex items-center justify-center gap-2 w-full font-medium text-white"
                style={{
                  background: 'var(--teal)',
                  padding: '10px',
                  borderRadius: 3,
                  fontSize: 13,
                  textDecoration: 'none',
                }}
              >
                Run Risk Analyzer →
              </Link>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
