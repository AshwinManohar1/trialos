'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (localStorage.getItem('trialos_auth') === 'true') {
      router.replace('/');
    }
  }, [router]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    setTimeout(() => {
      if (username === 'admin' && password === 'admin') {
        localStorage.setItem('trialos_auth', 'true');
        router.replace('/');
      } else {
        setError('Invalid username or password.');
        setLoading(false);
      }
    }, 400);
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#F7F8FA',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'Inter, sans-serif',
      }}
    >
      <div style={{ width: '100%', maxWidth: 400, padding: '0 24px' }}>

        {/* Logo / brand */}
        <div style={{ marginBottom: 40, textAlign: 'center' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              marginBottom: 8,
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                background: '#1B2A3B',
                borderRadius: 6,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 2v12M4 6l4-4 4 4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 14h12" stroke="#0F7B6C" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
            <span style={{ fontSize: 18, fontWeight: 700, color: '#1B2A3B', letterSpacing: '-0.02em' }}>
              TrialOS
            </span>
          </div>
          <p style={{ fontSize: 13, color: '#94A3B8', margin: 0 }}>
            Clinical Trial Intelligence Platform
          </p>
        </div>

        {/* Card */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #E2E8F0',
            borderRadius: 8,
            padding: '36px 32px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          }}
        >
          <h1
            style={{
              fontSize: 16,
              fontWeight: 600,
              color: '#1B2A3B',
              margin: '0 0 4px',
            }}
          >
            Sign in
          </h1>
          <p style={{ fontSize: 13, color: '#94A3B8', margin: '0 0 28px' }}>
            Enter your credentials to continue
          </p>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 16 }}>
              <label
                style={{
                  display: 'block',
                  fontSize: 12,
                  fontWeight: 500,
                  color: '#475569',
                  marginBottom: 6,
                  letterSpacing: '0.01em',
                }}
              >
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Enter username"
                autoComplete="username"
                autoFocus
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  fontSize: 14,
                  color: '#1B2A3B',
                  background: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: 4,
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.15s',
                }}
                onFocus={e => (e.target.style.borderColor = '#0F7B6C')}
                onBlur={e => (e.target.style.borderColor = '#E2E8F0')}
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label
                style={{
                  display: 'block',
                  fontSize: 12,
                  fontWeight: 500,
                  color: '#475569',
                  marginBottom: 6,
                  letterSpacing: '0.01em',
                }}
              >
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter password"
                autoComplete="current-password"
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  fontSize: 14,
                  color: '#1B2A3B',
                  background: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: 4,
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.15s',
                }}
                onFocus={e => (e.target.style.borderColor = '#0F7B6C')}
                onBlur={e => (e.target.style.borderColor = '#E2E8F0')}
              />
            </div>

            {error && (
              <div
                style={{
                  marginBottom: 16,
                  padding: '9px 12px',
                  background: '#FEF2F2',
                  border: '1px solid #FECACA',
                  borderRadius: 4,
                  fontSize: 13,
                  color: '#DC2626',
                }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !username || !password}
              style={{
                width: '100%',
                padding: '10px',
                fontSize: 14,
                fontWeight: 600,
                color: '#ffffff',
                background: loading || !username || !password ? '#94A3B8' : '#1B2A3B',
                border: 'none',
                borderRadius: 4,
                cursor: loading || !username || !password ? 'not-allowed' : 'pointer',
                transition: 'background 0.15s',
              }}
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', fontSize: 12, color: '#CBD5E1', marginTop: 24 }}>
          Cliantha Research · Pilot
        </p>
      </div>
    </div>
  );
}
