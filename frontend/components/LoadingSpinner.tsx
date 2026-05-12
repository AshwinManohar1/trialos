'use client';

interface LoadingSpinnerProps {
  text?: string;
  className?: string;
}

export function LoadingSpinner({ text, className = '' }: LoadingSpinnerProps) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <div
        className="w-4 h-4 rounded-full border-2 animate-spin flex-shrink-0"
        style={{ borderColor: 'var(--border)', borderTopColor: 'var(--teal)' }}
      />
      {text && <span className="text-sm" style={{ color: 'var(--text-3)' }}>{text}</span>}
    </div>
  );
}

export function SkeletonRows({ rows = 4, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i}>
          {Array.from({ length: cols }).map((_, j) => (
            <td key={j} style={{ padding: '10px 16px' }}>
              <div
                className="skeleton"
                style={{
                  height: 12,
                  width: j === 0 ? '80%' : j === cols - 1 ? '40%' : '60%',
                }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

interface LoadingPageProps {
  text?: string;
}

export function LoadingPage({ text = 'Loading...' }: LoadingPageProps) {
  return (
    <div className="flex flex-col items-center justify-center" style={{ minHeight: 240, gap: 12 }}>
      <div
        className="w-8 h-8 rounded-full border-2 animate-spin"
        style={{ borderColor: 'var(--border)', borderTopColor: 'var(--teal)' }}
      />
      <p className="text-sm" style={{ color: 'var(--text-3)' }}>{text}</p>
    </div>
  );
}
