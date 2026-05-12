'use client';

import { RiskFinding, Severity } from '@/lib/types';

interface FindingCardProps {
  finding: RiskFinding;
}

const severityConfig: Record<Severity, { borderColor: string; bg: string; label: string }> = {
  critical: {
    borderColor: 'var(--critical)',
    bg: 'var(--critical-bg)',
    label: 'Critical',
  },
  warning: {
    borderColor: 'var(--warning)',
    bg: 'var(--warning-bg)',
    label: 'Warning',
  },
  info: {
    borderColor: 'var(--info)',
    bg: 'var(--info-bg)',
    label: 'Info',
  },
};

export function FindingCard({ finding }: FindingCardProps) {
  const config = severityConfig[finding.severity];

  return (
    <div
      style={{
        background: config.bg,
        border: `1px solid ${config.borderColor}`,
        borderLeft: `4px solid ${config.borderColor}`,
        borderRadius: 3,
        overflow: 'hidden',
      }}
    >
      <div
        className="flex items-center gap-3"
        style={{ padding: '8px 14px', borderBottom: `1px solid ${config.borderColor}`, opacity: 0.85 }}
      >
        <span style={{ fontSize: 12, fontWeight: 700, color: config.borderColor }}>
          [{config.label.toUpperCase()}]
        </span>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', flex: 1 }}>
          {finding.issue}
        </span>
        <span className="font-mono" style={{ fontSize: 11, color: 'var(--text-3)' }}>
          {finding.section}
        </span>
      </div>

      <div style={{ padding: '12px 14px' }}>
        <div style={{ marginBottom: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Basis:{' '}
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{finding.clinical_basis}</span>
        </div>
        <div>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Fix:{' '}
          </span>
          <span style={{ fontSize: 12, color: 'var(--success)', fontWeight: 500 }}>{finding.fix}</span>
        </div>
      </div>
    </div>
  );
}
