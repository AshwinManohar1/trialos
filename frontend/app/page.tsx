'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/Sidebar';
import { TopBar } from '@/components/TopBar';
import { StatusBadge } from '@/components/Badge';
import { SkeletonRows } from '@/components/LoadingSpinner';
import { api } from '@/lib/api';
import { Study } from '@/lib/types';
import { formatDate } from '@/lib/utils';

export default function DashboardPage() {
  const router = useRouter();
  const [studies, setStudies] = useState<Study[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (localStorage.getItem('trialos_auth') !== 'true') {
      router.replace('/login');
      return;
    }
    loadStudies();
  }, []);

  async function loadStudies() {
    try {
      setLoading(true);
      setError(null);
      const data = await api.listStudies();
      setStudies(Array.isArray(data) ? data : []);
    } catch {
      setError('Unable to connect to backend. Make sure the API server is running.');
      setStudies([]);
    } finally {
      setLoading(false);
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(true);
  }

  function handleDragLeave() {
    setDragOver(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      alert(`File "${files[0].name}" received. Protocol analysis coming soon.`);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      alert(`File "${file.name}" received. Protocol analysis coming soon.`);
    }
  }

  const getDrugName = (study: Study) => study.drug_profile?.drug_name || '—';
  const getDose = (study: Study) =>
    study.drug_profile?.dose ? `${study.drug_profile.dose}` : '—';

  const activeCount = studies.filter(s => s.status === 'active').length;
  const completeCount = studies.filter(s => s.status === 'complete').length;
  const draftCount = studies.filter(s => s.status === 'draft').length;

  const getRiskCount = (study: Study) => {
    if (!study.risk_report) return null;
    const { critical_count, warning_count } = study.risk_report;
    return critical_count + warning_count;
  };

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg)' }}>
      <Sidebar />

      <TopBar crumbs={[{ label: 'Studies' }]} />

      <main className="content-area flex-1">
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '20px 24px 40px' }}>

          {/* Page header */}
          <div
            className="flex items-center justify-between pb-4 mb-0"
            style={{ borderBottom: '1px solid var(--border)' }}
          >
            <div>
              <h1 className="font-semibold" style={{ fontSize: 16, color: 'var(--text)', margin: 0 }}>
                Studies
              </h1>
              {!loading && studies.length > 0 && (
                <p className="mt-0.5" style={{ fontSize: 12, color: 'var(--text-3)' }}>
                  {studies.length} {studies.length === 1 ? 'study' : 'studies'}
                  {activeCount > 0 && <> · <span style={{ color: 'var(--teal)' }}>{activeCount} active</span></>}
                  {completeCount > 0 && <> · <span style={{ color: 'var(--success)' }}>{completeCount} complete</span></>}
                  {draftCount > 0 && <> · {draftCount} draft</>}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {/* Compact upload drop target */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`upload-zone cursor-pointer px-3 py-1.5 flex items-center gap-1.5 ${dragOver ? 'drag-over' : ''}`}
                style={{
                  borderRadius: 3,
                  border: '1.5px dashed var(--border-strong)',
                }}
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ color: 'var(--text-3)' }}>
                  <path d="M6 1v7M3 5l3-4 3 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M1 10h10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                </svg>
                <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Analyze PDF/DOCX</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>

              <Link
                href="/studies/new"
                className="inline-flex items-center gap-1.5 font-medium text-white transition-colors"
                style={{
                  background: 'var(--navy)',
                  padding: '6px 14px',
                  borderRadius: 3,
                  fontSize: 13,
                }}
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                New Study
              </Link>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div
              className="mt-4 px-4 py-3 text-sm"
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

          {/* Studies table */}
          <div
            className="mt-0"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderTop: 'none',
              borderRadius: '0 0 3px 3px',
            }}
          >
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th
                    className="text-left font-semibold uppercase tracking-wider"
                    style={{ padding: '8px 16px', fontSize: 11, color: 'var(--text-3)', background: 'var(--surface-2)', width: 140 }}
                  >
                    Protocol ID
                  </th>
                  <th
                    className="text-left font-semibold uppercase tracking-wider"
                    style={{ padding: '8px 16px', fontSize: 11, color: 'var(--text-3)', background: 'var(--surface-2)' }}
                  >
                    Drug (INN)
                  </th>
                  <th
                    className="text-left font-semibold uppercase tracking-wider"
                    style={{ padding: '8px 16px', fontSize: 11, color: 'var(--text-3)', background: 'var(--surface-2)', width: 100 }}
                  >
                    Dose
                  </th>
                  <th
                    className="text-left font-semibold uppercase tracking-wider"
                    style={{ padding: '8px 16px', fontSize: 11, color: 'var(--text-3)', background: 'var(--surface-2)', width: 120 }}
                  >
                    Status
                  </th>
                  <th
                    className="text-left font-semibold uppercase tracking-wider"
                    style={{ padding: '8px 16px', fontSize: 11, color: 'var(--text-3)', background: 'var(--surface-2)', width: 100 }}
                  >
                    Risk
                  </th>
                  <th
                    className="text-left font-semibold uppercase tracking-wider"
                    style={{ padding: '8px 16px', fontSize: 11, color: 'var(--text-3)', background: 'var(--surface-2)', width: 110 }}
                  >
                    Created
                  </th>
                  <th style={{ width: 60, background: 'var(--surface-2)' }} />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <SkeletonRows rows={3} cols={7} />
                ) : studies.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '32px 16px', textAlign: 'center' }}>
                      <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 8 }}>
                        No studies yet. Click <strong>+ New Study</strong> to begin.
                      </p>
                      <Link
                        href="/studies/new"
                        style={{ fontSize: 12, color: 'var(--teal)', textDecoration: 'underline' }}
                      >
                        Create first study →
                      </Link>
                    </td>
                  </tr>
                ) : (
                  studies.map((study) => {
                    const riskCount = getRiskCount(study);
                    const hasCritical = study.risk_report && study.risk_report.critical_count > 0;
                    return (
                      <tr
                        key={study.id}
                        onClick={() => router.push(`/studies/${study.id}`)}
                        onMouseEnter={() => setHoveredRow(study.id)}
                        onMouseLeave={() => setHoveredRow(null)}
                        className="cursor-pointer"
                        style={{
                          borderBottom: '1px solid var(--border)',
                          background: hoveredRow === study.id ? 'var(--surface-2)' : 'var(--surface)',
                          transition: 'background 0.1s',
                        }}
                      >
                        <td style={{ padding: '10px 16px' }}>
                          <span
                            className="font-mono font-semibold"
                            style={{ fontSize: 13, color: 'var(--text)', letterSpacing: '0.02em' }}
                          >
                            {study.id}
                          </span>
                        </td>
                        <td style={{ padding: '10px 16px' }}>
                          <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>
                            {getDrugName(study)}
                          </div>
                          {study.drug_profile?.formulation && (
                            <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>
                              {study.drug_profile.formulation}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '10px 16px' }}>
                          <span className="font-mono" style={{ fontSize: 13, color: 'var(--text-2)' }}>
                            {getDose(study)}
                          </span>
                        </td>
                        <td style={{ padding: '10px 16px' }}>
                          <StatusBadge status={study.status} />
                        </td>
                        <td style={{ padding: '10px 16px' }}>
                          {riskCount !== null ? (
                            <span
                              className="inline-flex items-center gap-1 font-mono text-xs font-semibold px-1.5 py-0.5"
                              style={{
                                color: hasCritical ? 'var(--critical)' : 'var(--warning)',
                                background: hasCritical ? 'var(--critical-bg)' : 'var(--warning-bg)',
                                border: `1px solid ${hasCritical ? 'var(--critical-border)' : 'var(--warning-border)'}`,
                                borderRadius: 3,
                              }}
                            >
                              ⚠ {riskCount}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--border-strong)', fontSize: 12 }}>—</span>
                          )}
                        </td>
                        <td style={{ padding: '10px 16px' }}>
                          <span style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>
                            {formatDate(study.created_at)}
                          </span>
                        </td>
                        <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                          {hoveredRow === study.id && (
                            <span style={{ fontSize: 12, color: 'var(--teal)', fontWeight: 500 }}>
                              Open →
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

        </div>
      </main>
    </div>
  );
}
