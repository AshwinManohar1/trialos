'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Sidebar } from '@/components/Sidebar';
import { TopBar } from '@/components/TopBar';
import { SkeletonRows } from '@/components/LoadingSpinner';
import { api } from '@/lib/api';
import { Study, ScreeningForecast, CriterionRisk } from '@/lib/types';
import { formatCurrency, getRiskLevel, formatDate } from '@/lib/utils';

function getRiskIndicator(level: 'High' | 'Medium' | 'Low'): { symbol: string; color: string } {
  switch (level) {
    case 'High': return { symbol: '■ HIGH', color: 'var(--critical)' };
    case 'Medium': return { symbol: '▲ MED', color: 'var(--warning)' };
    case 'Low': return { symbol: '● LOW', color: 'var(--text-3)' };
  }
}

export default function ScreeningPage() {
  const params = useParams();
  const studyId = params.id as string;

  const [study, setStudy] = useState<Study | null>(null);
  const [forecast, setForecast] = useState<ScreeningForecast | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [studyId]);

  async function loadData() {
    try {
      setLoading(true);
      const data = await api.getStudy(studyId);
      setStudy(data);
      if (data?.screening_forecast) {
        setForecast(data.screening_forecast);
      } else {
        try {
          const sf = await api.getScreening(studyId);
          if (sf?.criteria_risks) setForecast(sf);
        } catch {}
      }
    } catch {
      setError('Unable to connect to backend. Make sure the API server is running.');
    } finally {
      setLoading(false);
    }
  }

  async function runForecast() {
    setRunning(true);
    setError(null);
    try {
      const result = await api.runScreening(studyId);
      if (result?.criteria_risks) {
        setForecast(result);
      } else {
        await pollForForecast();
      }
    } catch {
      setError('Unable to connect to backend. Make sure the API server is running.');
    } finally {
      setRunning(false);
    }
  }

  async function pollForForecast() {
    let attempts = 0;
    return new Promise<void>((resolve) => {
      const interval = setInterval(async () => {
        attempts++;
        try {
          const data = await api.getScreening(studyId);
          if (data?.criteria_risks) {
            setForecast(data);
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

  const targetSubjects = study?.drug_profile?.target_subjects || 30;
  const sortedCriteria: CriterionRisk[] = forecast
    ? [...forecast.criteria_risks].sort((a, b) => b.failure_probability - a.failure_probability)
    : [];

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg)' }}>
      <Sidebar studyId={studyId} studyLabel={studyId} />
      <TopBar
        crumbs={[
          { label: 'Studies', href: '/' },
          { label: studyId, href: `/studies/${studyId}` },
          { label: 'Screening Forecast' },
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
                Screening Efficiency Forecast —{' '}
                <span className="font-mono" style={{ fontSize: 14 }}>{studyId}</span>
              </h1>
              {forecast && (
                <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
                  Run: {formatDate(forecast.generated_at)}
                </p>
              )}
            </div>
            {forecast && (
              <button
                onClick={runForecast}
                disabled={running}
                style={{
                  fontSize: 12,
                  color: 'var(--text-2)',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 3,
                  padding: '6px 12px',
                  cursor: running ? 'not-allowed' : 'pointer',
                  opacity: running ? 0.6 : 1,
                }}
              >
                Re-run Forecast
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

          {/* No forecast yet */}
          {!forecast && !running && !loading && (
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
              <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>
                No screening forecast yet
              </p>
              <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 20, maxWidth: 400 }}>
                Run the AI forecast to predict which eligibility criteria will most likely cause screen failures,
                and the optimized screening order to minimize cost per enrolment.
              </p>
              <button
                onClick={runForecast}
                className="inline-flex items-center gap-2 font-semibold text-white"
                style={{
                  background: 'var(--teal)',
                  padding: '9px 24px',
                  borderRadius: 3,
                  fontSize: 13,
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Run Screening Forecast
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
                Running screening forecast...
              </p>
              <p style={{ fontSize: 12, color: 'var(--text-3)' }}>
                Analyzing eligibility criteria for {study?.drug_profile?.drug_name}
              </p>
            </div>
          )}

          {/* Loading skeleton */}
          {loading && !forecast && (
            <div
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 3,
                overflow: 'hidden',
              }}
            >
              <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                <tbody>
                  <SkeletonRows rows={5} cols={4} />
                </tbody>
              </table>
            </div>
          )}

          {/* Forecast results */}
          {forecast && !running && (
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
                  How screening numbers are estimated
                </p>
                <p style={{ fontSize: 12, color: 'var(--text-2)', margin: 0, lineHeight: 1.6 }}>
                  Each eligibility criterion is scored for <strong>failure probability</strong> using population epidemiology for healthy Indian adults — prevalence of QTcF &gt;450ms, BMI outliers, chronic conditions, substance use — cross-referenced with threshold stringency per <strong>FDA BE Recommendation</strong> for this drug class. Both standard ICH/FDA healthy volunteer criteria and drug-specific exclusions are covered. Screening volume = target enrollment ÷ (1 − failure rate). The <strong>optimised screening order</strong> ranks tests by failure rate ÷ cost — cheapest high-yield disqualifiers first to minimise cost per enrolled subject. Validate against your site's historical screen-fail data before budgeting. Cost estimates use a ₹5,000/screen-fail benchmark.
                </p>
              </div>

              {/* Summary metrics */}
              <div className="section-header"><span>Forecast Summary</span></div>
              <div
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 3,
                  overflow: 'hidden',
                }}
              >
                <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                  <tbody>
                    <SummaryRow
                      label="Target enrollment"
                      value={String(targetSubjects) + ' subjects'}
                      mono
                    />
                    <SummaryRow
                      label="Predicted failure rate"
                      value={`${(forecast.predicted_failure_rate_low * (forecast.predicted_failure_rate_low <= 1 ? 100 : 1)).toFixed(0)} – ${(forecast.predicted_failure_rate_high * (forecast.predicted_failure_rate_high <= 1 ? 100 : 1)).toFixed(0)}%`}
                      mono
                      bold
                      valueColor={(forecast.predicted_failure_rate_high * (forecast.predicted_failure_rate_high <= 1 ? 100 : 1)) >= 40 ? 'var(--critical)' : 'var(--text)'}
                    />
                    <SummaryRow
                      label="Subjects to screen"
                      value={`${forecast.subjects_to_screen} subjects`}
                      mono
                      bold
                    />
                    {forecast.estimated_cost_inr !== undefined && (
                      <SummaryRow
                        label="Estimated screening cost"
                        value={`₹ ${formatCurrency(Math.round(forecast.estimated_cost_inr * forecast.predicted_failure_rate_low / 100))} – ₹ ${formatCurrency(Math.round(forecast.estimated_cost_inr))}`}
                        mono
                        note="₹ 5,000/screen-fail basis"
                        isLast
                      />
                    )}
                  </tbody>
                </table>
              </div>

              {/* Criteria risk table */}
              {sortedCriteria.length > 0 && (
                <>
                  <div className="section-header"><span>Eligibility Criteria Risk Ranking</span></div>
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
                          <th style={{ padding: '7px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', background: 'var(--surface-2)', width: 50 }}>Rank</th>
                          <th style={{ padding: '7px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', background: 'var(--surface-2)', width: 70 }}>ID</th>
                          <th style={{ padding: '7px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', background: 'var(--surface-2)' }}>Criterion</th>
                          <th style={{ padding: '7px 16px', textAlign: 'right', fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', background: 'var(--surface-2)', width: 110 }}>Failure Prob.</th>
                          <th style={{ padding: '7px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', background: 'var(--surface-2)', width: 90 }}>Risk</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedCriteria.map((c, i) => {
                          const level = getRiskLevel(c.failure_probability);
                          const indicator = getRiskIndicator(level);
                          return (
                            <tr
                              key={i}
                              style={{ borderBottom: i < sortedCriteria.length - 1 ? '1px solid var(--border)' : 'none' }}
                            >
                              <td style={{ padding: '9px 16px' }}>
                                <span className="font-mono" style={{ fontSize: 12, color: 'var(--text-3)' }}>
                                  {i + 1}
                                </span>
                              </td>
                              <td style={{ padding: '9px 16px' }}>
                                <span className="font-mono font-semibold" style={{ fontSize: 12, color: 'var(--text-2)' }}>
                                  {c.criterion_id}
                                </span>
                              </td>
                              <td style={{ padding: '9px 16px' }}>
                                <div style={{ fontSize: 13, color: 'var(--text)' }}>{c.criterion_text}</div>
                                <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{c.reason}</div>
                              </td>
                              <td style={{ padding: '9px 16px', textAlign: 'right' }}>
                                <span className="font-mono font-bold" style={{ fontSize: 13, color: indicator.color }}>
                                  {(c.failure_probability * (c.failure_probability <= 1 ? 100 : 1)).toFixed(0)}%
                                </span>
                              </td>
                              <td style={{ padding: '9px 16px' }}>
                                <span className="font-mono font-semibold" style={{ fontSize: 11, color: indicator.color }}>
                                  {indicator.symbol}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {/* Optimized screening order */}
              {forecast.screening_order && forecast.screening_order.length > 0 && (
                <>
                  <div className="section-header"><span>Optimized Screening Order</span></div>
                  <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: -8, marginBottom: 8 }}>
                    Run highest-fail, cheapest tests first to minimize cost per enrolment.
                  </p>
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
                          <th style={{ padding: '7px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', background: 'var(--surface-2)', width: 60 }}>Step</th>
                          <th style={{ padding: '7px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', background: 'var(--surface-2)' }}>Test</th>
                          <th style={{ padding: '7px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', background: 'var(--surface-2)' }}>Rationale</th>
                          <th style={{ padding: '7px 16px', textAlign: 'right', fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', background: 'var(--surface-2)', width: 120 }}>Cost / Screen</th>
                        </tr>
                      </thead>
                      <tbody>
                        {forecast.screening_order.map((step, i) => (
                          <tr
                            key={i}
                            style={{ borderBottom: i < forecast.screening_order.length - 1 ? '1px solid var(--border)' : 'none' }}
                          >
                            <td style={{ padding: '9px 16px' }}>
                              <span
                                className="font-mono font-bold"
                                style={{
                                  fontSize: 12,
                                  color: 'var(--text-3)',
                                  background: 'var(--surface-2)',
                                  border: '1px solid var(--border)',
                                  borderRadius: 3,
                                  padding: '1px 6px',
                                }}
                              >
                                {step.step}
                              </span>
                            </td>
                            <td style={{ padding: '9px 16px', fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>
                              {step.test}
                            </td>
                            <td style={{ padding: '9px 16px', fontSize: 12, color: 'var(--text-3)' }}>
                              {step.rationale}
                            </td>
                            <td style={{ padding: '9px 16px', textAlign: 'right' }}>
                              <span className="font-mono" style={{ fontSize: 12, color: 'var(--text-2)', fontWeight: 500 }}>
                                {step.cost_per_screen_inr === 0 ? '₹ 0' : `₹ ${formatCurrency(step.cost_per_screen_inr)}`}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {/* Bottom nav */}
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
              </div>

            </div>
          )}

        </div>
      </main>
    </div>
  );
}

function SummaryRow({
  label, value, mono, bold, note, valueColor, isLast
}: {
  label: string;
  value: string;
  mono?: boolean;
  bold?: boolean;
  note?: string;
  valueColor?: string;
  isLast?: boolean;
}) {
  return (
    <tr style={{ borderBottom: isLast ? 'none' : '1px solid var(--border)' }}>
      <td
        style={{
          padding: '9px 16px',
          fontSize: 12,
          color: 'var(--text-3)',
          fontWeight: 500,
          background: 'var(--surface-2)',
          width: 280,
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </td>
      <td style={{ padding: '9px 16px' }}>
        <span
          className={mono ? 'font-mono' : ''}
          style={{
            fontSize: 13,
            fontWeight: bold ? 700 : 500,
            color: valueColor || 'var(--text)',
          }}
        >
          {value}
        </span>
        {note && (
          <span style={{ fontSize: 11, color: 'var(--text-3)', marginLeft: 10 }}>{note}</span>
        )}
      </td>
    </tr>
  );
}
