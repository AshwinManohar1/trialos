'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Sidebar } from '@/components/Sidebar';
import { TopBar } from '@/components/TopBar';
import { api } from '@/lib/api';
import { Study, RiskReport, RiskFinding } from '@/lib/types';
import { formatDate } from '@/lib/utils';

export default function RiskPage() {
  const params = useParams();
  const studyId = params.id as string;

  const [study, setStudy] = useState<Study | null>(null);
  const [report, setReport] = useState<RiskReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [infoExpanded, setInfoExpanded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadStudy();
  }, [studyId]);

  async function loadStudy() {
    try {
      setLoading(true);
      const data = await api.getStudy(studyId);
      setStudy(data);
      if (data?.risk_report) {
        setReport(data.risk_report);
      } else {
        try {
          const riskData = await api.getRisk(studyId);
          if (riskData?.findings) setReport(riskData);
        } catch {}
      }
    } catch {
      setError('Unable to connect to backend. Make sure the API server is running.');
    } finally {
      setLoading(false);
    }
  }

  async function runAnalysis() {
    setRunning(true);
    setError(null);
    try {
      // Upload file first if user dropped one
      if (uploadedFile) {
        await api.uploadRiskDocument(studyId, uploadedFile);
      }
      const result = await api.analyzeRisk(studyId);
      if (result?.findings) {
        setReport(result);
      } else {
        await pollForRisk();
      }
    } catch {
      setError('Unable to connect to backend. Make sure the API server is running.');
    } finally {
      setRunning(false);
    }
  }

  async function pollForRisk() {
    let attempts = 0;
    return new Promise<void>((resolve) => {
      const interval = setInterval(async () => {
        attempts++;
        try {
          const data = await api.getRisk(studyId);
          if (data?.findings) {
            setReport(data);
            clearInterval(interval);
            resolve();
          }
          if (attempts > 20) {
            clearInterval(interval);
            resolve();
          }
        } catch {
          clearInterval(interval);
          resolve();
        }
      }, 2000);
    });
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) setUploadedFile(file);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) setUploadedFile(file);
  }

  const criticalFindings = report?.findings.filter(f => f.severity === 'critical') || [];
  const warningFindings = report?.findings.filter(f => f.severity === 'warning') || [];
  const infoFindings = report?.findings.filter(f => f.severity === 'info') || [];

  if (loading) {
    return (
      <div className="flex min-h-screen" style={{ background: 'var(--bg)' }}>
        <Sidebar studyId={studyId} studyLabel={studyId} />
        <TopBar crumbs={[{ label: 'Studies', href: '/' }, { label: studyId, href: `/studies/${studyId}` }, { label: 'Risk Analyzer' }]} />
        <main className="content-area flex-1 flex items-center justify-center">
          <div style={{ textAlign: 'center' }}>
            <div className="w-7 h-7 rounded-full border-2 animate-spin mx-auto mb-3" style={{ borderColor: 'var(--border)', borderTopColor: 'var(--teal)' }} />
            <p style={{ fontSize: 13, color: 'var(--text-3)' }}>Loading risk report...</p>
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
          { label: 'Risk Analyzer' },
        ]}
        studyStatus={study?.status}
      />

      <main className="content-area flex-1">
        <div style={{ maxWidth: 1000, margin: '0 auto', padding: '20px 24px 60px' }}>

          {/* Header */}
          <div
            className="flex items-start justify-between pb-4 mb-5"
            style={{ borderBottom: '1px solid var(--border)' }}
          >
            <div>
              <h1 className="font-semibold" style={{ fontSize: 16, color: 'var(--text)', margin: 0 }}>
                Protocol Risk Analysis —{' '}
                <span className="font-mono" style={{ fontSize: 14 }}>{studyId}</span>
              </h1>
              {report && (
                <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
                  Analyzed: {formatDate(report.generated_at)} ·{' '}
                  Source: {study?.protocol_document?.filled_filename || 'protocol document'}
                </p>
              )}
            </div>
            {report && (
              <button
                onClick={runAnalysis}
                style={{
                  fontSize: 12,
                  color: 'var(--text-2)',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 3,
                  padding: '6px 12px',
                  cursor: 'pointer',
                }}
              >
                Re-run Analysis
              </button>
            )}
          </div>

          {error && (
            <div
              className="mb-4 px-4 py-3 text-sm"
              style={{ background: 'var(--critical-bg)', border: '1px solid var(--critical-border)', borderRadius: 3, color: 'var(--critical)' }}
            >
              {error}
            </div>
          )}

          {/* Summary bar (if report exists) */}
          {report && !running && (
            <div
              className="flex items-center gap-4 mb-6 flex-wrap"
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 3,
                padding: '10px 16px',
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Summary</span>
              <span style={{ color: 'var(--border)', fontSize: 12 }}>|</span>
              {report.critical_count > 0 && (
                <span className="font-mono font-bold" style={{ fontSize: 13, color: 'var(--critical)' }}>
                  {report.critical_count} Critical
                </span>
              )}
              {report.warning_count > 0 && (
                <span className="font-mono font-semibold" style={{ fontSize: 13, color: 'var(--warning)' }}>
                  {report.warning_count} Warning{report.warning_count > 1 ? 's' : ''}
                </span>
              )}
              {report.info_count > 0 && (
                <span className="font-mono" style={{ fontSize: 13, color: 'var(--info)' }}>
                  {report.info_count} Informational
                </span>
              )}
              {report.critical_count === 0 && report.warning_count === 0 && (
                <span style={{ fontSize: 13, color: 'var(--success)', fontWeight: 600 }}>
                  ✓ No critical or warning issues
                </span>
              )}
              <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-3)' }}>
                {report.critical_count > 0
                  ? 'Address all critical findings before protocol submission'
                  : 'Protocol review complete'}
              </span>
            </div>
          )}

          {/* No report yet — upload / run */}
          {!report && !running && (
            <div className="space-y-4">
              {/* Protocol from study */}
              {study?.protocol_document?.status === 'complete' && (
                <div
                  className="flex items-center justify-between"
                  style={{
                    background: 'var(--teal-light)',
                    border: '1px solid rgba(15,123,108,0.25)',
                    borderRadius: 3,
                    padding: '12px 16px',
                  }}
                >
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', margin: 0 }}>
                      Analyze protocol from this study
                    </p>
                    <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
                      {study.protocol_document.filled_filename}
                    </p>
                  </div>
                  <button
                    onClick={runAnalysis}
                    style={{
                      fontSize: 13,
                      fontWeight: 500,
                      color: 'white',
                      background: 'var(--teal)',
                      border: 'none',
                      borderRadius: 3,
                      padding: '7px 16px',
                      cursor: 'pointer',
                    }}
                  >
                    Analyze →
                  </button>
                </div>
              )}

              {/* Upload zone */}
              <div>
                <div className="section-header"><span>Or Upload Protocol for Analysis</span></div>
                <div
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`upload-zone cursor-pointer ${dragOver ? 'drag-over' : ''}`}
                  style={{ borderRadius: 3, padding: '20px', textAlign: 'center' }}
                >
                  <p style={{ fontSize: 13, color: 'var(--text-2)' }}>
                    {uploadedFile ? uploadedFile.name : 'Drop PDF or DOCX protocol · click to browse'}
                  </p>
                  <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>PDF or DOCX</p>
                  <input ref={fileInputRef} type="file" accept=".pdf,.docx" className="hidden" onChange={handleFileChange} />
                </div>
              </div>

              <button
                onClick={runAnalysis}
                className="flex items-center justify-center gap-2 w-full font-semibold text-white"
                style={{
                  background: 'var(--navy)',
                  padding: '10px',
                  borderRadius: 3,
                  fontSize: 13,
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Run Risk Analysis
              </button>
            </div>
          )}

          {/* Running */}
          {running && (
            <div
              className="flex flex-col items-center"
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 3,
                padding: '48px 24px',
                textAlign: 'center',
              }}
            >
              <div className="w-8 h-8 rounded-full border-2 animate-spin mb-4" style={{ borderColor: 'var(--border)', borderTopColor: 'var(--teal)' }} />
              <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>
                Analyzing protocol...
              </p>
              <p style={{ fontSize: 12, color: 'var(--text-3)' }}>
                Checking clinical eligibility criteria, PK parameters, Schedule of Events, and regulatory requirements
              </p>
            </div>
          )}

          {/* Report */}
          {report && !running && (
            <div className="space-y-0">

              {/* Clinical methodology banner */}
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
                  Analysis methodology
                </p>
                <p style={{ fontSize: 12, color: 'var(--text-2)', margin: 0, lineHeight: 1.6 }}>
                  The clinical analysis engine reviews the drug's PK and safety profile against a structured regulatory framework: <strong>ICH M13A 2023</strong> (BE study design), <strong>FDA BE Recommendations</strong> (drug-specific), <strong>ICH E6(R3)</strong> (GCP), and <strong>ICH M3(R2)</strong> (healthy volunteer safety). Calculated parameters (washout, last sample, confinement) are verified arithmetically against the accepted PK values. Each finding cites the specific guideline section and provides a concrete corrective action. Severity: <strong style={{ color: 'var(--critical)' }}>Critical</strong> = must resolve before submission; <strong style={{ color: 'var(--warning)' }}>Warning</strong> = protocol gap; <strong style={{ color: 'var(--info)' }}>Info</strong> = advisory. Does not replace PI or regulatory affairs review.
                </p>
              </div>

              {/* CRITICAL section */}
              {criticalFindings.length > 0 && (
                <FindingSection
                  label="CRITICAL"
                  count={criticalFindings.length}
                  color="var(--critical)"
                  borderColor="var(--critical)"
                  bg="var(--critical-bg)"
                  findings={criticalFindings}
                  startIndex={1}
                  defaultExpanded
                />
              )}

              {/* WARNINGS section */}
              {warningFindings.length > 0 && (
                <FindingSection
                  label="WARNINGS"
                  count={warningFindings.length}
                  color="var(--warning)"
                  borderColor="var(--warning)"
                  bg="var(--warning-bg)"
                  findings={warningFindings}
                  startIndex={criticalFindings.length + 1}
                  defaultExpanded
                />
              )}

              {/* INFORMATIONAL section */}
              {infoFindings.length > 0 && (
                <FindingSection
                  label="INFORMATIONAL"
                  count={infoFindings.length}
                  color="var(--info)"
                  borderColor="var(--info)"
                  bg="var(--info-bg)"
                  findings={infoFindings}
                  startIndex={criticalFindings.length + warningFindings.length + 1}
                  defaultExpanded={false}
                  collapsible
                />
              )}

              {/* CTA */}
              <div
                className="flex items-center justify-between pt-5 mt-5"
                style={{ borderTop: '1px solid var(--border)' }}
              >
                <Link
                  href={`/studies/${studyId}`}
                  style={{ fontSize: 13, color: 'var(--text-3)' }}
                >
                  ← Back to Workspace
                </Link>
                <Link
                  href={`/studies/${studyId}/screening`}
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
                  Run Screening Forecast →
                </Link>
              </div>

            </div>
          )}

        </div>
      </main>
    </div>
  );
}

function FindingSection({
  label, count, color, borderColor, bg, findings, startIndex, defaultExpanded, collapsible = false
}: {
  label: string;
  count: number;
  color: string;
  borderColor: string;
  bg: string;
  findings: RiskFinding[];
  startIndex: number;
  defaultExpanded: boolean;
  collapsible?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className="mb-5">
      {/* Section divider */}
      <div
        className="flex items-center gap-3 mb-3"
        style={{
          cursor: collapsible ? 'pointer' : 'default',
        }}
        onClick={collapsible ? () => setExpanded(v => !v) : undefined}
      >
        <div
          className="font-mono font-bold"
          style={{
            fontSize: 11,
            letterSpacing: '0.1em',
            color,
            flexShrink: 0,
            textTransform: 'uppercase',
          }}
        >
          ━━━ {label} ({count}) ━━━
        </div>
        <div style={{ flex: 1, height: 1, background: color, opacity: 0.3 }} />
        {collapsible && (
          <button
            style={{ fontSize: 11, color, background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0 }}
          >
            {expanded ? 'collapse ▲' : 'expand ▼'}
          </button>
        )}
      </div>

      {expanded && (
        <div className="space-y-3">
          {findings.map((finding, i) => (
            <FindingRow
              key={i}
              finding={finding}
              index={startIndex + i}
              color={color}
              borderColor={borderColor}
              bg={bg}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FindingRow({
  finding, index, color, borderColor, bg
}: {
  finding: RiskFinding;
  index: number;
  color: string;
  borderColor: string;
  bg: string;
}) {
  return (
    <div
      style={{
        background: bg,
        border: `1px solid ${borderColor}`,
        borderLeft: `4px solid ${borderColor}`,
        borderRadius: 3,
        overflow: 'hidden',
      }}
    >
      {/* Finding header */}
      <div
        className="flex items-center gap-3"
        style={{ padding: '8px 14px', borderBottom: `1px solid ${borderColor}`, opacity: 0.85 }}
      >
        <span
          className="font-mono font-bold"
          style={{ fontSize: 12, color, flexShrink: 0 }}
        >
          [R-{String(index).padStart(3, '0')}]
        </span>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', flex: 1 }}>
          {finding.issue}
        </span>
        <span
          className="font-mono"
          style={{ fontSize: 11, color: 'var(--text-3)', flexShrink: 0 }}
        >
          {finding.section}
        </span>
      </div>

      {/* Finding body */}
      <div style={{ padding: '12px 14px' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <tbody>
            <tr style={{ verticalAlign: 'top' }}>
              <td
                style={{
                  width: 60,
                  paddingRight: 12,
                  paddingBottom: 10,
                  fontSize: 11,
                  fontWeight: 700,
                  color: 'var(--text-3)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  whiteSpace: 'nowrap',
                }}
              >
                Issue
              </td>
              <td style={{ paddingBottom: 10, fontSize: 13, color: 'var(--text)' }}>
                {finding.issue}
              </td>
            </tr>
            <tr style={{ verticalAlign: 'top' }}>
              <td style={{ width: 60, paddingRight: 12, paddingBottom: 10, fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
                Basis
              </td>
              <td style={{ paddingBottom: 10, fontSize: 12, color: 'var(--text-2)', lineHeight: 1.5 }}>
                {finding.clinical_basis}
              </td>
            </tr>
            <tr style={{ verticalAlign: 'top' }}>
              <td style={{ width: 60, paddingRight: 12, fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
                Fix
              </td>
              <td style={{ fontSize: 12, color: 'var(--success)', lineHeight: 1.5, fontWeight: 500 }}>
                {finding.fix}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
