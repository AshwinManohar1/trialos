'use client';

import Link from 'next/link';
import { StudyStatus } from '@/lib/types';
import { StatusBadge } from './Badge';

interface Crumb {
  label: string;
  href?: string;
}

interface TopBarProps {
  crumbs: Crumb[];
  studyStatus?: StudyStatus;
}

export function TopBar({ crumbs, studyStatus }: TopBarProps) {
  return (
    <div className="topbar">
      <nav className="flex items-center gap-1.5 text-sm flex-1">
        {crumbs.map((crumb, i) => (
          <span key={i} className="flex items-center gap-1.5">
            {i > 0 && (
              <span style={{ color: 'var(--border-strong)' }}>/</span>
            )}
            {crumb.href ? (
              <Link
                href={crumb.href}
                className="hover:underline"
                style={{ color: 'var(--text-3)' }}
              >
                {crumb.label}
              </Link>
            ) : (
              <span style={{ color: 'var(--text)', fontWeight: 500 }}>{crumb.label}</span>
            )}
          </span>
        ))}
      </nav>
      {studyStatus && (
        <div>
          <StatusBadge status={studyStatus} />
        </div>
      )}
    </div>
  );
}
