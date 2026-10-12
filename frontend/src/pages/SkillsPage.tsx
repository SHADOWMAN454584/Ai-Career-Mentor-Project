import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ExternalLink, ArrowRight } from 'lucide-react';
import { AnalysisResult } from '../types/api';
import { EmptyState } from '../components/common/EmptyState';
import { ErrorBoundary } from '../components/common/ErrorBoundary';
import { RoadmapWidget } from '../components/dashboard/RoadmapWidget';

interface SkillsPageProps {
  result: AnalysisResult | null;
  onRefreshDashboard: () => Promise<void>;
}

export function SkillsPage({ result, onRefreshDashboard }: SkillsPageProps) {
  const navigate = useNavigate();

  if (!result) {
    return (
      <EmptyState
        title="No skill gap analysis yet"
        text="Upload and analyze your resume on the Overview tab to view missing requirements and recommended learning paths."
        action="Upload resume"
        onAction={() => navigate('/overview')}
      />
    );
  }

  return (
    <ErrorBoundary fallbackTitle="Skills Assessment Error">
      <section style={{ display: 'grid', gap: '32px' }}>
        <div className="section-intro">
          <div>
            <p className="overline">Skill Assessment</p>
            <h2>Audited Gaps for {result.target_role || 'Target Role'}</h2>
          </div>
          <p className="muted">
            Ranked by relevance and industry importance based on your resume evidence.
          </p>
        </div>

        <div className="skills-layout">
          <article className="surface-list">
            <div className="list-heading">
              <span>Priority</span>
              <span>Audited Gap & Importance</span>
            </div>
            {result.skill_gaps.map((gap, index) => (
              <div className="skill-row" key={gap.skill}>
                <span className="rank">0{index + 1}</span>
                <div className="skill-copy">
                  <h3>{gap.skill}</h3>
                  <p>{gap.explanation}</p>
                  <span className="importance">Importance {gap.importance}/10</span>
                </div>
                <div className="gap-meter">
                  <strong>{Math.round((1 - gap.similarity) * 100)}% gap</strong>
                  <div>
                    <span style={{ width: `${(1 - gap.similarity) * 100}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </article>

          <article className="learning-panel">
            <p className="overline">Suggested Learning</p>
            <h2>Actionable course recommendations</h2>
            {result.courses.slice(0, 4).map((group) => (
              <div className="course-row" key={group.skill_gap}>
                <strong>{group.skill_gap}</strong>
                {group.recommendations.slice(0, 1).map((course) => (
                  <a
                    href={course.link}
                    target="_blank"
                    rel="noreferrer"
                    key={course.link}
                  >
                    {course.name}
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <span>{course.platform}</span>
                      <ExternalLink size={12} color="currentColor" aria-hidden="true" />
                    </span>
                  </a>
                ))}
              </div>
            ))}
          </article>
        </div>

        <div style={{ marginTop: '20px' }}>
          <RoadmapWidget result={result} onRefresh={onRefreshDashboard} />
        </div>
      </section>
    </ErrorBoundary>
  );
}
