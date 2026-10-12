import React from 'react';
import { ArrowRight } from 'lucide-react';
import { AnalysisResult, DashboardProgress } from '../../types/api';
import { EmptyState } from '../common/EmptyState';

interface OverviewProps {
  result: AnalysisResult | null;
  dashboard: DashboardProgress | null;
  onNavigateSkills: () => void;
  onNavigateMentor: () => void;
  onNavigatePlacement: () => void;
  onTriggerUpload: () => void;
}

export function Overview({
  result,
  dashboard,
  onNavigateSkills,
  onNavigateMentor,
  onNavigatePlacement,
  onTriggerUpload,
}: OverviewProps) {
  if (!result) {
    return (
      <EmptyState
        title="Your workspace starts with a resume"
        text="Upload a PDF or DOCX resume to generate role matches, audited skill gaps, learning recommendations, and a weekly preparation roadmap."
        action="Upload resume"
        onAction={onTriggerUpload}
      />
    );
  }

  const score = Math.round(result.placement_probability * 100);
  const completed = dashboard?.roadmap_completion || 0;
  const topRole = result.role_scores?.[0];
  const gaps = result.skill_gaps?.slice(0, 3) || [];

  return (
    <>
      <section className="overview-grid">
        <article className="readiness-panel">
          <div>
            <p className="overline">Estimated readiness</p>
            <h2>
              {score}
              <span>%</span>
            </h2>
            <p className="muted">
              Based on the information extracted from your resume. This is a preparation signal, not a hiring guarantee.
            </p>
          </div>
          <div className="readiness-track">
            <span style={{ width: `${score}%` }} />
          </div>
          <div className="readiness-footer">
            <span>Model signal</span>
            <strong>{score >= 70 ? 'Strong foundation' : 'Build core competencies first'}</strong>
          </div>
        </article>

        <article className="next-panel">
          <p className="overline">Recommended next step</p>
          <h2>{gaps[0] ? `Practise ${gaps[0].skill}` : 'Review placement forecast'}</h2>
          <p>
            {gaps[0]?.explanation ||
              'Small, consistent progress is the fastest way to turn this analysis into industry-ready proof.'}
          </p>
          <button className="text-button" type="button" onClick={onNavigatePlacement} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <span>Test ML readiness simulator</span>
            <ArrowRight size={13} color="currentColor" aria-hidden="true" />
          </button>
        </article>
      </section>

      <section className="section-intro">
        <div>
          <p className="overline">At a glance</p>
          <h2>Key signals requiring attention</h2>
        </div>
        <p className="muted">Three signals to help you decide what to do next.</p>
      </section>

      <section className="signal-grid">
        <article className="signal-block">
          <span className="signal-number">01</span>
          <p className="overline">Strongest role match</p>
          <h3>{topRole?.role_name || 'Not evaluated'}</h3>
          <strong className="signal-value">{topRole?.match_score || 0}% match</strong>
          <p className="muted">
            {topRole?.contributing_skills?.slice(0, 3).join(', ') || 'Run analysis to see supporting skills.'}
          </p>
          <button className="text-button" type="button" onClick={onNavigateSkills} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <span>Review all skills</span>
            <ArrowRight size={13} color="currentColor" aria-hidden="true" />
          </button>
        </article>

        <article className="signal-block attention">
          <span className="signal-number">02</span>
          <p className="overline">Priority gaps</p>
          <h3>{result.skill_gaps?.length || 0} skills to strengthen</h3>
          <div className="mini-list">
            {gaps.map((gap) => (
              <div key={gap.skill}>
                <span>{gap.skill}</span>
                <b>{Math.round((1 - gap.similarity) * 100)}%</b>
              </div>
            ))}
          </div>
          <button className="text-button" type="button" onClick={onNavigateSkills} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <span>See all gaps</span>
            <ArrowRight size={13} color="currentColor" aria-hidden="true" />
          </button>
        </article>

        <article className="signal-block">
          <span className="signal-number">03</span>
          <p className="overline">Roadmap progress</p>
          <h3>{completed}% complete</h3>
          <div className="progress-track">
            <span style={{ width: `${completed}%` }} />
          </div>
          <p className="muted">Follow the weekly milestones to build practical code evidence.</p>
          <button className="text-button" type="button" onClick={onNavigateMentor} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <span>Practice with AI Mentor</span>
            <ArrowRight size={13} color="currentColor" aria-hidden="true" />
          </button>
        </article>
      </section>

      <section className="bottom-action">
        <div>
          <p className="overline">Real-Time Mentorship</p>
          <h2>Get immediate AI guidance & practice under pressure.</h2>
          <p className="muted">
            Ask targeted career questions or run a mock interview with real-time feedback.
          </p>
        </div>
        <button className="primary-button" type="button" onClick={onNavigateMentor} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <span>Open AI Mentor</span>
          <ArrowRight size={14} color="currentColor" aria-hidden="true" />
        </button>
      </section>
    </>
  );
}
