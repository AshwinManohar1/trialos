'use client';

import Link from 'next/link';

interface ModuleCardProps {
  number: string;
  title: string;
  description: string;
  status: 'not_started' | 'processing' | 'complete' | 'failed';
  statusLabel?: string;
  actionLabel: string;
  actionHref?: string;
  onAction?: () => void;
  secondaryAction?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  children?: React.ReactNode;
}

const statusStyles: Record<string, string> = {
  not_started: 'bg-gray-100 text-gray-500',
  processing: 'bg-yellow-100 text-yellow-700',
  complete: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
};

const statusLabels: Record<string, string> = {
  not_started: 'Not started',
  processing: 'Processing',
  complete: 'Complete',
  failed: 'Failed',
};

export function ModuleCard({
  number,
  title,
  description,
  status,
  statusLabel,
  actionLabel,
  actionHref,
  onAction,
  secondaryAction,
  children,
}: ModuleCardProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm border-l-4 border-l-[#4A8B7B] overflow-hidden">
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-900 text-white flex items-center justify-center text-xs font-bold font-mono">
              {number}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-gray-900 text-sm">{title}</h3>
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusStyles[status]}`}>
                  {statusLabel || statusLabels[status]}
                </span>
              </div>
              <p className="text-sm text-gray-500 mt-1">{description}</p>
              {children && <div className="mt-3">{children}</div>}
            </div>
          </div>

          <div className="flex flex-col gap-2 flex-shrink-0">
            {actionHref ? (
              <Link
                href={actionHref}
                className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md bg-[#1E2A3A] text-white hover:bg-[#2D3F55] transition-colors whitespace-nowrap"
              >
                {actionLabel}
              </Link>
            ) : (
              <button
                onClick={onAction}
                className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md bg-[#1E2A3A] text-white hover:bg-[#2D3F55] transition-colors whitespace-nowrap"
              >
                {actionLabel}
              </button>
            )}
            {secondaryAction && (
              secondaryAction.href ? (
                <Link
                  href={secondaryAction.href}
                  className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 transition-colors whitespace-nowrap text-center justify-center"
                >
                  {secondaryAction.label}
                </Link>
              ) : (
                <button
                  onClick={secondaryAction.onClick}
                  className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 transition-colors whitespace-nowrap"
                >
                  {secondaryAction.label}
                </button>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
