'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Sidebar } from '@/components/Sidebar';
import { TopBar } from '@/components/TopBar';
import { StatusBadge } from '@/components/Badge';
import { LoadingPage } from '@/components/LoadingSpinner';
import { api } from '@/lib/api';
import { Study } from '@/lib/types';
import { formatDate } from '@/lib/utils';

export default function StudyWorkspacePage() {
  const params = useParams();
  const router = useRouter();
  const studyId = params.id as string;

  const [study, setStudy] = useState<Study | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    } catch {
      setError('Unable to connect to backend. Make sure the API server is running.');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen" style={{ background: 'var(--bg)' }}>
        <Sidebar studyId={studyId} studyLabel={studyId} />
        <TopBar crumbs={[{ label: 'Studies', href: '/' }, { label: studyId }]} />
        <main className="content-area flex-1">
          <LoadingPage text="Loading study workspace..." />
        </main>
      </div>
    );
  }

  if (!study) {
    return (
      <div className="flex min-h-screen" style={{ background: 'var(--bg)' }}>
        <Sidebar studyId={studyId} studyLabel={studyId} />
        <TopBar crumbs={[{ label: 'Studies', href: '/' }, { label: studyId }]} />
        <main className="content-area flex-1">
          <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px' }}>
            <div
              className="px-4 py-3 text-sm"
              style={{
                background: 'var(--critical-bg)',
                border: '1px solid var(--critical-border)',
                borderRadius: 3,
                color: 'var(--critical)',
              }}
            >
              {error || 'Study not found.'}
            </div>
          </div>
        </main>
      </div>
    );
  }

  const drug = study.drug_profile;
  const pk = study.derived_pk;
  const protocol = study.protocol_document;
  const risk = study.risk_report;
  const screening = study.screening_forecast;

  // Pipeline statuses
  const protocolStatus = protocol
    ? protocol.status === 'complete' ? 'complete'
    : protocol.status === 'processing' ? 'processing'
    : 'not_started'
    : 'not_started';

  const riskStatus = risk ? 'complete' : 'not_started';
  const screeningStatus = screening ? 'complete' : 'not_started';

  const drugLabel = drug ? `${drug.drug_name}${drug.dose ? ' ' + drug.dose : ''}` : studyId;

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg)' }}>
      <Sidebar studyId={studyId} studyLabel={studyId} />
      <TopBar
        crumbs={[{ label: 'Studies', href: '/' }, { label: drugLabel }]}
        studyStatus={study.status}
      />

      <main className="content-area flex-1">
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '20px 24px 60px' }}>

          {/* Study header */}
          <div
            className="flex items-start justify-between mb-5 pb-4"
            style={{ borderBottom: '1px solid var(--border)' }}
          >
            <div>
              <div className="flex items-center gap-3">
                <span
                  className="font-mono font-semibold"
                  style={{ fontSize: 14, color: 'var(--text)', letterSpacing: '0.03em' }}
                >
                  {studyId}
                </span>
                <span style={{ color: 'var(--border-strong)' }}>—</span>
                <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>
                  {drug?.drug_name || 'Unknown Drug'}
                  {drug?.dose && (
                    <span style={{ fontWeight: 400, color: 'var(--text-2)', marginLeft: 6 }}>
                      {drug.dose}
                    </span>
                  )}
                </span>
                <StatusBadge status={study.status} />
              </div>
              {study.name && (
                <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 3 }}>{study.name}</p>
              )}
            </div>
          </div>

          {error && (
            <div
              className="mb-4 px-4 py-3 text-sm"
              style={{
                background: 'var(--critical-bg)',
                border: '1px solid var(--critical-border)',
                borderRadius: 3,
                color: 'var(--critical)',
              }}
            >
              {error}
            </div>
          )}

          <div className="grid gap-5" style={{ gridTemplateColumns: '1fr 340px' }}>

            {/* Left: Pipeline */}
            <div>
              {/* Study Details */}
              {drug && (
                <div className="mb-5">
                  <div className="section-header">
                    <span>Study Details</span>
                  </div>
                  <div
                    style={{
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 3,
                    }}
                  >
                    <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                      <tbody>
                        {[
                          ['Drug', `${drug.drug_name} ${drug.dose || ''}`.trim(), true],
                          ['Formulation', drug.formulation, false],
                          ['Reference', `${drug.reference_product}${drug.reference_country ? ' (' + drug.reference_country + ')' : ''}`, false],
                          ['Sponsor', `${drug.sponsor_name}${drug.sponsor_country ? ' · ' + drug.sponsor_country : ''}`, false],
                          ['Regulators', drug.regulatory_targets?.join(' · ') || '—', false],
                          ['Subjects', String(drug.target_subjects || '—') + ' planned', true],
                          pk ? ['Washout', `${pk.washout_days} days between periods`, true] : null,
                        ].filter(Boolean).map((row, i, arr) => {
                          const [label, value, mono] = row as [string, string, boolean];
                          return (
                            <tr
                              key={i}
                              style={{ borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}
                            >
                              <td
                                style={{
                                  padding: '7px 16px',
                                  fontSize: 11,
                                  fontWeight: 600,
                                  color: 'var(--text-3)',
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.06em',
                                  width: 120,
                                  background: 'var(--surface-2)',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {label}
                              </td>
                              <td
                                style={{
                                  padding: '7px 16px',
                                  fontSize: 13,
                                  color: 'var(--text)',
                                  fontFamily: mono ? 'var(--mono)' : undefined,
                                }}
                              >
                                {value || '—'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Pipeline */}
              <div className="section-header">
                <span>Study Pipeline</span>
              </div>

              <div
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 3,
                  overflow: 'hidden',
                }}
              >
                {/* 01 Drug Properties */}
                <PipelineRow
                  number="01"
                  title="Drug Properties"
                  status={drug && study.derived_pk ? 'complete' : drug ? 'processing' : 'not_started'}
                  detail={
                    study.derived_pk
                      ? `t½ = ${study.derived_pk.half_life_hours}h · Tmax = ${study.derived_pk.tmax_hours}h · CV = ${study.derived_pk.intrasubject_cv || '?'}%`
                      : drug
                      ? 'Looking up pharmacokinetic profile...'
                      : 'Set up study to begin'
                  }
                  actions={
                    drug ? (
                      <Link
                        href={`/studies/${studyId}/drug-properties`}
                        className="action-btn"
                        style={actionBtnStyle}
                      >
                        {study.derived_pk ? 'View' : 'Check →'}
                      </Link>
                    ) : null
                  }
                  isLast={false}
                />

                {/* 02 Protocol Creation */}
                <PipelineRow
                  number="02"
                  title="Protocol Creation"
                  status={protocolStatus as PipelineStatus}
                  detail={
                    protocol?.status === 'complete'
                      ? `${protocol.filled_filename || 'Protocol generated'}`
                      : protocol?.status === 'processing'
                      ? 'Generating...'
                      : 'Upload template to generate filled protocol'
                  }
                  actions={
                    <div className="flex gap-2">
                      {protocol?.status === 'complete' && (
                        <a
                          href={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/studies/${studyId}/protocol/download`}
                          download
                          style={{ ...actionBtnStyle, color: 'var(--text-2)' }}
                        >
                          Download
                        </a>
                      )}
                      <Link
                        href={`/studies/${studyId}/protocol`}
                        style={actionBtnStyle}
                      >
                        {protocol?.status === 'complete' ? 'View' : 'Start →'}
                      </Link>
                    </div>
                  }
                  isLast={false}
                />

                {/* 03 Risk Analysis */}
                <PipelineRow
                  number="03"
                  title="Protocol Risk Analysis"
                  status={riskStatus as PipelineStatus}
                  statusOverride={
                    risk
                      ? risk.critical_count > 0
                        ? 'critical'
                        : risk.warning_count > 0
                        ? 'warning'
                        : undefined
                      : undefined
                  }
                  detail={
                    risk
                      ? `${risk.critical_count} critical · ${risk.warning_count} warnings · ${risk.info_count} info — Last run: ${formatDate(risk.generated_at)}`
                      : 'AI review of protocol against regulatory requirements'
                  }
                  actions={
                    <Link
                      href={`/studies/${studyId}/risk`}
                      style={actionBtnStyle}
                    >
                      {risk ? 'View Report' : 'Run Analysis →'}
                    </Link>
                  }
                  isLast={false}
                />

                {/* 04 Screening Forecast */}
                <PipelineRow
                  number="04"
                  title="Screening Efficiency Forecast"
                  status={screeningStatus as PipelineStatus}
                  detail={
                    screening
                      ? `Screen ${screening.subjects_to_screen} subjects to enroll ${drug?.target_subjects || 30} · ${screening.predicted_failure_rate_low}–${screening.predicted_failure_rate_high}% predicted failure`
                      : 'Predict screen failure rates by eligibility criterion'
                  }
                  actions={
                    <Link
                      href={`/studies/${studyId}/screening`}
                      style={actionBtnStyle}
                    >
                      {screening ? 'View Forecast' : 'Run Forecast →'}
                    </Link>
                  }
                  isLast={true}
                />
              </div>
            </div>

            {/* Right: PK quick summary (if available) */}
            {pk && (
              <div>
                <div className="section-header">
                  <span>PK Summary</span>
                </div>
                <div
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 3,
                  }}
                >
                  {[
                    ['t½', `${pk.half_life_hours} h`],
                    ['Tmax', `${pk.tmax_hours} h`],
                    ['CV', pk.intrasubject_cv !== undefined ? `${pk.intrasubject_cv}%` : '—'],
                    ['Washout', `${pk.washout_days} days`],
                    ['Confinement', `${pk.confinement_hours} h`],
                    ['PK samples', `${pk.pk_sampling_timepoints.length} pts / period`],
                    ['Last sample', `${pk.pk_sampling_timepoints[pk.pk_sampling_timepoints.length - 1]} h post-dose`],
                    ['n recommended', `${pk.sample_size_recommended} subjects`],
                  ].map(([label, value], i, arr) => (
                    <div
                      key={i}
                      className="flex items-center justify-between"
                      style={{
                        padding: '7px 14px',
                        borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none',
                      }}
                    >
                      <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{label}</span>
                      <span className="font-mono" style={{ fontSize: 12, color: 'var(--text)', fontWeight: 600 }}>
                        {value}
                      </span>
                    </div>
                  ))}
                </div>

                {pk.safety_flags && pk.safety_flags.length > 0 && (
                  <div className="mt-4">
                    <div className="section-header">
                      <span>Safety Flags</span>
                    </div>
                    <div className="space-y-2">
                      {pk.safety_flags.map((flag, i) => (
                        <div
                          key={i}
                          style={{
                            background: 'var(--warning-bg)',
                            border: '1px solid var(--warning-border)',
                            borderLeft: '3px solid var(--warning)',
                            borderRadius: 3,
                            padding: '8px 12px',
                          }}
                        >
                          <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--warning)', marginBottom: 2 }}>
                            ⚠ {flag.type}
                          </p>
                          <p style={{ fontSize: 11, color: 'var(--text-2)' }}>{flag.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-4">
                  <Link
                    href={`/studies/${studyId}/drug-properties`}
                    style={{
                      display: 'block',
                      textAlign: 'center',
                      fontSize: 12,
                      color: 'var(--teal)',
                      padding: '8px',
                      border: '1px solid var(--teal)',
                      borderRadius: 3,
                      textDecoration: 'none',
                    }}
                  >
                    View Full PK Profile →
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

type PipelineStatus = 'not_started' | 'processing' | 'complete' | 'critical' | 'warning';

const actionBtnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '4px 12px',
  fontSize: 12,
  fontWeight: 500,
  color: 'var(--teal)',
  background: 'var(--teal-light)',
  border: '1px solid rgba(15,123,108,0.25)',
  borderRadius: 3,
  textDecoration: 'none',
  whiteSpace: 'nowrap',
};

function PipelineRow({
  number,
  title,
  status,
  statusOverride,
  detail,
  actions,
  isLast,
}: {
  number: string;
  title: string;
  status: PipelineStatus;
  statusOverride?: 'critical' | 'warning';
  detail?: string;
  actions?: React.ReactNode;
  isLast: boolean;
}) {
  const effectiveStatus = statusOverride || status;

  const barColor: Record<string, string> = {
    complete: 'var(--success)',
    processing: 'var(--teal)',
    not_started: 'var(--border-strong)',
    critical: 'var(--critical)',
    warning: 'var(--warning)',
  };

  const statusLabel: Record<string, React.ReactNode> = {
    complete: <span style={{ color: 'var(--success)', fontSize: 12, fontWeight: 500 }}>✓ Complete</span>,
    processing: <span style={{ color: 'var(--teal)', fontSize: 12, fontWeight: 500 }}>⟳ Processing</span>,
    not_started: <span style={{ color: 'var(--text-3)', fontSize: 12 }}>○ Not started</span>,
    critical: (
      <span style={{ color: 'var(--critical)', fontSize: 12, fontWeight: 600 }}>
        ⚠ Findings
      </span>
    ),
    warning: (
      <span style={{ color: 'var(--warning)', fontSize: 12, fontWeight: 600 }}>
        ⚠ Warnings
      </span>
    ),
  };

  return (
    <div
      className="flex"
      style={{ borderBottom: isLast ? 'none' : '1px solid var(--border)' }}
    >
      {/* Status bar */}
      <div
        style={{
          width: 4,
          background: barColor[effectiveStatus],
          flexShrink: 0,
        }}
      />
      {/* Content */}
      <div className="flex items-start justify-between gap-4 flex-1" style={{ padding: '12px 16px' }}>
        <div className="flex items-start gap-3 flex-1">
          <span
            className="font-mono font-bold flex-shrink-0"
            style={{
              fontSize: 11,
              color: 'var(--text-3)',
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              borderRadius: 3,
              padding: '1px 6px',
              marginTop: 1,
            }}
          >
            {number}
          </span>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{title}</span>
              {statusLabel[effectiveStatus]}
            </div>
            {detail && (
              <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2, fontFamily: detail.match(/\d+h/) ? 'var(--mono)' : undefined }}>
                {detail}
              </p>
            )}
          </div>
        </div>
        {actions && (
          <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
