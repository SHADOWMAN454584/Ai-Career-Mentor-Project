import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, RotateCcw } from 'lucide-react';
import { request, setToken } from '../lib/api';
import { TokenResponse } from '../types/api';
import { ThemeToggle } from '../components/common/ThemeToggle';

interface AuthPageProps {
  theme: string;
  onToggleTheme: () => void;
  onLoginSuccess: (token: string) => void;
}

export function AuthPage({ theme, onToggleTheme, onLoginSuccess }: AuthPageProps) {
  const navigate = useNavigate();
  const [email, setEmail] = useState('demo@careermentor.local');
  const [password, setPassword] = useState('demo123');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const data = await request<TokenResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      setToken(data.access_token);
      onLoginSuccess(data.access_token);
      navigate('/overview');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid login credentials.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-intro">
        <div className="login-nav">
          <button
            className="back-button"
            type="button"
            onClick={() => navigate('/')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <ArrowLeft size={14} color="currentColor" aria-hidden="true" />
            Back home
          </button>
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
        </div>

        <img
          src="/assets/logos/C2C_logo.svg"
          alt="Campus2Career Official Logo"
          className="brand-logo"
          style={{ height: '48px', width: 'auto', objectFit: 'contain', marginBottom: '20px', display: 'block' }}
        />
        <p className="overline">Campus2Career</p>
        <h1>From campus to career with confidence.</h1>
        <p className="intro-copy">
          Your launchpad for turning coursework and projects into an industry-ready profile,
          actionable skill plan, and interview practice.
        </p>
        <div className="intro-rule" />
        <p className="quiet">Resume analysis / role matches / ML readiness / AI mentorship</p>
      </section>

      <form className="login-form" onSubmit={handleSubmit}>
        <div>
          <p className="overline">Welcome back</p>
          <h2>Sign in to your workspace</h2>
          <p className="muted">Use the pre-filled demo student account to explore the platform.</p>
        </div>

        <label>
          Email address
          <input
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            autoComplete="email"
            placeholder="demo@careermentor.local"
          />
        </label>

        <label>
          Password
          <input
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            autoComplete="current-password"
            placeholder="demo123"
          />
        </label>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <button className="primary-button" type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Signing in...' : 'Continue'}
          <ArrowRight size={14} color="currentColor" style={{ marginLeft: '6px', verticalAlign: 'middle', display: 'inline' }} />
        </button>

        <div style={{ marginTop: '20px', display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            type="button"
            className="text-button"
            style={{ fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            onClick={() => {
              setEmail('demo@careermentor.local');
              setPassword('demo123');
            }}
          >
            <RotateCcw size={12} color="currentColor" aria-hidden="true" />
            Reset demo credentials
          </button>
        </div>

        <p className="form-note">
          Security: API endpoints are rate-limited with slowapi and secured via JSON Web Tokens.
        </p>
      </form>
    </main>
  );
}
