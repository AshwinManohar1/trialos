'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

interface SidebarProps {
  studyId?: string;
  studyLabel?: string;
}

export function Sidebar({ studyId, studyLabel }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  function handleLogout() {
    localStorage.removeItem('trialos_auth');
    router.replace('/login');
  }

  const isActive = (href: string) => pathname === href;
  const isStartsWith = (prefix: string) => pathname.startsWith(prefix);

  const navLinkBase =
    'flex items-center gap-2.5 px-3 py-1.5 text-sm transition-colors relative';

  function navLink(href: string, exact = false) {
    const active = exact ? isActive(href) : isStartsWith(href);
    return `${navLinkBase} ${
      active
        ? 'text-white font-medium bg-white/10'
        : 'text-white/55 hover:text-white/90 hover:bg-white/5'
    }`;
  }

  function subLink(href: string) {
    const active = isStartsWith(href);
    return (
      'flex items-center pl-7 pr-3 py-1.5 text-sm transition-colors relative ' +
      (active
        ? 'text-white font-medium'
        : 'text-white/50 hover:text-white/80')
    );
  }

  function ActiveBar({ href, exact = false }: { href: string; exact?: boolean }) {
    const active = exact ? isActive(href) : isStartsWith(href);
    if (!active) return null;
    return (
      <span
        className="absolute left-0 top-1 bottom-1 w-0.5"
        style={{ background: 'var(--teal)', borderRadius: '0 2px 2px 0' }}
      />
    );
  }

  return (
    <div
      className="fixed top-0 left-0 h-full flex flex-col z-20"
      style={{ width: 240, background: 'var(--navy)' }}
    >
      {/* Logo */}
      <div
        className="px-5 py-4 flex-shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}
      >
        <div className="flex items-center gap-2.5">
          {/* Logo mark */}
          <div
            className="w-7 h-7 flex items-center justify-center flex-shrink-0"
            style={{ background: 'var(--teal)', borderRadius: 3 }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M3 5h10M3 8h7M3 11h5"
                stroke="white"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <div>
            <div className="text-white font-semibold text-base leading-none tracking-tight">
              TrialOS
            </div>
            <div className="text-xs leading-tight mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
              Clinical Operations
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3">
        {!studyId ? (
          /* Top-level nav */
          <div className="space-y-0.5 px-2">
            <div className="relative">
              <ActiveBar href="/" exact />
              <Link href="/" className={navLink('/', true)}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <rect x="1" y="1" width="5.5" height="5.5" rx="1" fill="currentColor" opacity="0.7" />
                  <rect x="7.5" y="1" width="5.5" height="5.5" rx="1" fill="currentColor" />
                  <rect x="1" y="7.5" width="5.5" height="5.5" rx="1" fill="currentColor" opacity="0.5" />
                  <rect x="7.5" y="7.5" width="5.5" height="5.5" rx="1" fill="currentColor" opacity="0.7" />
                </svg>
                Studies
              </Link>
            </div>

            <div className="relative">
              <ActiveBar href="/templates" />
              <Link href="/templates" className={navLink('/templates')}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <rect x="1" y="2" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
                  <path d="M4 5h6M4 7.5h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                </svg>
                Templates
              </Link>
            </div>
          </div>
        ) : (
          /* Study context nav */
          <div className="px-2">
            {/* Back link */}
            <div className="relative mb-1">
              <Link href="/" className={`${navLinkBase} text-white/45 hover:text-white/75 text-xs`}>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M7.5 2L3.5 6l4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Back to Studies
              </Link>
            </div>

            {/* Study ID block */}
            <div
              className="mx-1 px-3 py-2.5 mb-2"
              style={{
                background: 'rgba(255,255,255,0.06)',
                borderRadius: 3,
                borderLeft: '2px solid var(--teal)',
              }}
            >
              <div className="text-2xs uppercase tracking-wider font-semibold mb-0.5" style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10 }}>
                Active Study
              </div>
              <div
                className="font-mono font-semibold text-white/90 truncate"
                style={{ fontSize: 12 }}
              >
                {studyLabel || studyId}
              </div>
            </div>

            {/* Study workspace link */}
            <div className="space-y-0.5">
              <div className="relative">
                <ActiveBar href={`/studies/${studyId}`} exact />
                <Link href={`/studies/${studyId}`} className={navLink(`/studies/${studyId}`, true)}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <rect x="1" y="1" width="5.5" height="5.5" rx="1" fill="currentColor" opacity="0.7" />
                    <rect x="7.5" y="1" width="5.5" height="5.5" rx="1" fill="currentColor" />
                    <rect x="1" y="7.5" width="5.5" height="5.5" rx="1" fill="currentColor" opacity="0.5" />
                    <rect x="7.5" y="7.5" width="5.5" height="5.5" rx="1" fill="currentColor" opacity="0.7" />
                  </svg>
                  Workspace
                </Link>
              </div>

              {/* Divider label */}
              <div className="px-3 pt-2 pb-0.5">
                <span className="text-2xs uppercase tracking-widest font-semibold" style={{ color: 'rgba(255,255,255,0.25)', fontSize: 10 }}>
                  Study Pipeline
                </span>
              </div>

              <div className="relative">
                <ActiveBar href={`/studies/${studyId}/drug-properties`} />
                <Link href={`/studies/${studyId}/drug-properties`} className={subLink(`/studies/${studyId}/drug-properties`)}>
                  Drug Properties
                </Link>
              </div>

              <div className="relative">
                <ActiveBar href={`/studies/${studyId}/protocol`} />
                <Link href={`/studies/${studyId}/protocol`} className={subLink(`/studies/${studyId}/protocol`)}>
                  Protocol Creation
                </Link>
              </div>

              <div className="relative">
                <ActiveBar href={`/studies/${studyId}/risk`} />
                <Link href={`/studies/${studyId}/risk`} className={subLink(`/studies/${studyId}/risk`)}>
                  Risk Analyzer
                </Link>
              </div>

              <div className="relative">
                <ActiveBar href={`/studies/${studyId}/screening`} />
                <Link href={`/studies/${studyId}/screening`} className={subLink(`/studies/${studyId}/screening`)}>
                  Screening Forecast
                </Link>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* Footer */}
      <div
        className="px-5 py-3 flex-shrink-0"
        style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.25)', fontFamily: 'var(--mono)' }}>
            v0.1.0
          </span>
          <button
            onClick={handleLogout}
            className="text-xs hover:text-white/70 transition-colors flex items-center gap-1"
            style={{ color: 'rgba(255,255,255,0.3)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
              <path d="M7 2H9.5V9H7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M1.5 5.5h6M5 3l2.5 2.5L5 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}
