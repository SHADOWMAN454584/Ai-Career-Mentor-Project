import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { ThemeToggle } from '../components/common/ThemeToggle';

interface LandingPageProps {
  theme: string;
  onToggleTheme: () => void;
}

export function LandingPage({ theme, onToggleTheme }: LandingPageProps) {
  const navigate = useNavigate();

  return (
    <main className="landing-page">
      <header className="landing-nav">
        <a className="brand-lockup" href="#top" aria-label="Campus2Career home">
          <img
            src="/assets/logos/C2C_logo.svg"
            alt="Campus2Career Official Logo"
            className="brand-logo"
            style={{ height: '32px', width: 'auto', objectFit: 'contain', display: 'block' }}
          />
          <span>
            <strong>Campus2Career</strong>
            <small>Degree to Dream Job</small>
          </span>
        </a>
        <nav className="landing-links" aria-label="Landing page navigation">
          <a href="#method">How it works</a>
          <a href="#signals">What you get</a>
        </nav>
        <div className="landing-actions">
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
          <button className="text-button" type="button" onClick={() => navigate('/auth')}>
            Sign in <ArrowRight size={14} color="currentColor" style={{ marginLeft: '4px', verticalAlign: 'middle', display: 'inline' }} />
          </button>
        </div>
      </header>

      <section className="landing-hero" id="top">
        <div className="hero-copy">
          <p className="overline">Bridge the gap from degree to dream job</p>
          <h1>Turn your degree into your dream career.</h1>
          <p className="hero-lede">
            Campus2Career bridges the transition from college to corporate life. Discover your role fit,
            close priority skill gaps, and prepare with weekly roadmaps and AI mock interviews.
          </p>
          <div className="hero-actions">
            <button className="primary-button" type="button" onClick={() => navigate('/auth')}>
              Build my preparation plan{' '}
              <ArrowRight size={15} color="currentColor" style={{ marginLeft: '4px', verticalAlign: 'middle', display: 'inline' }} />
            </button>
            <span className="hero-note">Resume analysis · skill gaps · ML readiness · AI mentor</span>
          </div>
        </div>

        <div className="hero-preview" aria-label="Preview of a career readiness workspace">
          <div className="preview-topline">
            <span className="preview-kicker">Readiness snapshot</span>
            <span className="preview-status">
              <i /> Live signal
            </span>
          </div>
          <div className="preview-score">
            <strong>72</strong>
            <span>%</span>
            <div>
              <b>Good foundation</b>
              <small>Based on your profile</small>
            </div>
          </div>
          <div className="preview-rule" />
          <div className="preview-grid">
            <div>
              <span className="preview-kicker">Role fit</span>
              <strong>Frontend Developer</strong>
              <small>84% match</small>
            </div>
            <div>
              <span className="preview-kicker">Priority gap</span>
              <strong>Testing & CI/CD</strong>
              <small>Practise next</small>
            </div>
          </div>
          <div className="preview-roadmap">
            <span className="preview-kicker">This week</span>
            <div>
              <strong>Build a stronger foundation</strong>
              <span>03 / 05 tasks complete</span>
            </div>
            <em>
              <span />
            </em>
          </div>
        </div>
      </section>

      <section className="landing-proof" id="signals">
        <div>
          <span className="proof-number">01</span>
          <strong>See your position</strong>
          <p>Understand role fit and readiness from the evidence already in your resume.</p>
        </div>
        <div>
          <span className="proof-number">02</span>
          <strong>Close high-impact gaps</strong>
          <p>Focus your time on the skills that make the biggest difference in placement rounds.</p>
        </div>
        <div>
          <span className="proof-number">03</span>
          <strong>AI Mentorship & ML Signals</strong>
          <p>Chat with a streaming AI mentor and calculate your predictive readiness probability.</p>
        </div>
      </section>

      <section className="landing-method" id="method">
        <div>
          <p className="overline">A workspace for preparation</p>
          <h2>Less guessing. More actionable next steps.</h2>
        </div>
        <div className="method-copy">
          <p>
            Effective preparation is not about reading endless tutorials. It is about knowing what
            specific capabilities hiring managers look for right now.
          </p>
          <button className="text-button" type="button" onClick={() => navigate('/auth')}>
            Start with your resume{' '}
            <ArrowRight size={14} color="currentColor" style={{ marginLeft: '4px', verticalAlign: 'middle', display: 'inline' }} />
          </button>
        </div>
      </section>

      <footer className="landing-footer">
        <span>Campus2Career</span>
        <span>Bridge the gap from degree to dream job.</span>
      </footer>
    </main>
  );
}
