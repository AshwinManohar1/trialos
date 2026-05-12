'use client';

import { StudyStatus, Severity } from '@/lib/types';

interface StatusBadgeProps {
  status: StudyStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  if (status === 'active') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium" style={{ color: 'var(--teal)' }}>
        <span style={{ fontSize: 10 }}>●</span> Active
      </span>
    );
  }
  if (status === 'complete') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium" style={{ color: 'var(--success)' }}>
        <span style={{ fontSize: 10 }}>✓</span> Complete
      </span>
    );
  }
  // draft
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium" style={{ color: 'var(--text-3)' }}>
      <span style={{ fontSize: 10 }}>○</span> Draft
    </span>
  );
}

interface SeverityBadgeProps {
  severity: Severity;
}

export function SeverityBadge({ severity }: SeverityBadgeProps) {
  if (severity === 'critical') {
    return (
      <span
        className="inline-flex items-center px-2 py-0.5 text-xs font-semibold uppercase tracking-wide"
        style={{
          color: 'var(--critical)',
          background: 'var(--critical-bg)',
          border: '1px solid var(--critical-border)',
          borderRadius: 3,
        }}
      >
        Critical
      </span>
    );
  }
  if (severity === 'warning') {
    return (
      <span
        className="inline-flex items-center px-2 py-0.5 text-xs font-semibold uppercase tracking-wide"
        style={{
          color: 'var(--warning)',
          background: 'var(--warning-bg)',
          border: '1px solid var(--warning-border)',
          borderRadius: 3,
        }}
      >
        Warning
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 text-xs font-semibold uppercase tracking-wide"
      style={{
        color: 'var(--info)',
        background: 'var(--info-bg)',
        border: '1px solid #BDD7FF',
        borderRadius: 3,
      }}
    >
      Info
    </span>
  );
}

interface GenericBadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  className?: string;
}

export function Badge({ children, variant = 'default', className = '' }: GenericBadgeProps) {
  const styles: Record<string, React.CSSProperties> = {
    default: { color: 'var(--text-2)', background: 'var(--surface-2)', border: '1px solid var(--border)' },
    success: { color: 'var(--success)', background: 'var(--success-bg)', border: '1px solid #A3CFBB' },
    warning: { color: 'var(--warning)', background: 'var(--warning-bg)', border: '1px solid var(--warning-border)' },
    danger: { color: 'var(--critical)', background: 'var(--critical-bg)', border: '1px solid var(--critical-border)' },
    info: { color: 'var(--info)', background: 'var(--info-bg)', border: '1px solid #BDD7FF' },
    neutral: { color: 'var(--text-3)', background: 'var(--surface-2)', border: '1px solid var(--border)' },
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-xs font-medium ${className}`}
      style={{ borderRadius: 3, ...styles[variant] }}
    >
      {children}
    </span>
  );
}
