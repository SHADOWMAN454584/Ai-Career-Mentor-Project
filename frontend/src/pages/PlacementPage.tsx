import React, { useState } from 'react';
import { TrendingUp, TrendingDown, ArrowRight } from 'lucide-react';
import { AnalysisResult, PlacementPredictResponse } from '../types/api';
import { request } from '../lib/api';
import { ErrorBoundary } from '../components/common/ErrorBoundary';

interface PlacementPageProps {
  result: AnalysisResult | null;
}

export function PlacementPage({ result }: PlacementPageProps) {
  const [cgpa, setCgpa] = useState<number>(7.8);
  const [skillCount, setSkillCount] = useState<number>(result ? result.skill_gaps.length + 3 : 5);
  const [internshipCount, setInternshipCount] = useState<number>(1);
  const [projectCount, setProjectCount] = useState<number>(3);
  const [certificationCount, setCertificationCount] = useState<number>(1);
  const [branch, setBranch] = useState<string>('Computer Science');
  const [isPredicting, setIsPredicting] = useState<boolean>(false);
  const [predictionData, setPredictionData] = useState<PlacementPredictResponse | null>(null);

  async function handlePredict(e: React.FormEvent) {
    e.preventDefault();
    setIsPredicting(true);
    try {
      const data = await request<PlacementPredictResponse>('/placement/predict', {
        method: 'POST',
        body: JSON.stringify({
          cgpa,
          skill_count: skillCount,
          internship_count: internshipCount,
          project_count: projectCount,
          certification_count: certificationCount,
          branch,
        }),
      });
      setPredictionData(data);
    } catch (err) {
      console.error('Failed to predict placement readiness:', err);
    } finally {
      setIsPredicting(false);
    }
  }

  const currentScore = predictionData
    ? Math.round(predictionData.placement_probability * 100)
    : result
    ? Math.round(result.placement_probability * 100)
    : 74;

  const currentVersion = predictionData?.model_version || result?.model_version || 'ml-logistic_regression';
  const factors = predictionData?.shap_factors || result?.shap_factors || [
    { feature: 'CGPA', impact: 0.12, direction: 'up' },
    { feature: 'Technical Skills', impact: 0.20, direction: 'up' },
    { feature: 'Internships', impact: 0.07, direction: 'up' },
    { feature: 'Project Portfolio', impact: 0.15, direction: 'up' },
  ];

  return (
    <ErrorBoundary fallbackTitle="Placement Predictor Error">
      <section style={{ display: 'grid', gap: '32px' }}>
        <div className="section-intro">
          <div>
            <p className="overline">Machine Learning Inference</p>
            <h2>Predictive Placement Readiness Score</h2>
          </div>
          <p className="muted">
            Powered by serialized scikit-learn models loaded directly in backend memory with SHAP factor analysis.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
          {/* Readiness Gauge & Factor Breakdown */}
          <article className="readiness-panel" style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <p className="overline">Inference Output ({currentVersion})</p>
              <h2 style={{ fontSize: '72px' }}>
                {currentScore}
                <span>%</span>
              </h2>
              <p className="muted">
                {currentScore >= 70
                  ? 'High placement probability. Your academic and project baseline aligns with campus recruitments.'
                  : 'Moderate placement signal. Increasing targeted internships or core project depth will yield the largest gain.'}
              </p>
            </div>

            <div style={{ margin: '24px 0' }}>
              <div className="readiness-track">
                <span style={{ width: `${currentScore}%` }} />
              </div>
            </div>

            <div>
              <p className="overline">SHAP Feature Contributions</p>
              <div style={{ display: 'grid', gap: '10px' }}>
                {factors.map((f) => (
                  <div
                    key={f.feature}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 12px',
                      background: 'var(--surface-muted)',
                      borderRadius: '8px',
                      fontSize: '13px',
                    }}
                  >
                    <span>{f.feature}</span>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        color: f.direction === 'up' ? 'var(--primary-hover)' : 'var(--danger)',
                        fontWeight: 700,
                      }}
                    >
                      {f.direction === 'up' ? (
                        <TrendingUp size={14} color="currentColor" aria-hidden="true" />
                      ) : (
                        <TrendingDown size={14} color="currentColor" aria-hidden="true" />
                      )}
                      <span>
                        {f.direction === 'up' ? '+' : '-'}
                        {Math.abs(f.impact)}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </article>

          {/* Interactive Feature Simulator Form */}
          <article
            style={{
              padding: '32px',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border)',
              background: 'var(--surface)',
            }}
          >
            <p className="overline">What-If Simulator</p>
            <h2>Adjust Student Parameters</h2>
            <p className="muted" style={{ marginBottom: '24px' }}>
              Test how completing another internship, raising your CGPA, or building more projects changes your model probability.
            </p>

            <form onSubmit={handlePredict} style={{ display: 'grid', gap: '18px' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600 }}>Cumulative GPA (CGPA)</label>
                  <strong style={{ fontSize: '14px' }}>{cgpa.toFixed(1)} / 10.0</strong>
                </div>
                <input
                  type="range"
                  min="5.0"
                  max="10.0"
                  step="0.1"
                  value={cgpa}
                  onChange={(e) => setCgpa(parseFloat(e.target.value))}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <label>
                  Identified Skills
                  <input
                    type="number"
                    min="1"
                    max="30"
                    value={skillCount}
                    onChange={(e) => setSkillCount(parseInt(e.target.value) || 0)}
                  />
                </label>

                <label>
                  Internships
                  <input
                    type="number"
                    min="0"
                    max="10"
                    value={internshipCount}
                    onChange={(e) => setInternshipCount(parseInt(e.target.value) || 0)}
                  />
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <label>
                  Portfolio Projects
                  <input
                    type="number"
                    min="0"
                    max="15"
                    value={projectCount}
                    onChange={(e) => setProjectCount(parseInt(e.target.value) || 0)}
                  />
                </label>

                <label>
                  Certifications
                  <input
                    type="number"
                    min="0"
                    max="10"
                    value={certificationCount}
                    onChange={(e) => setCertificationCount(parseInt(e.target.value) || 0)}
                  />
                </label>
              </div>

              <label>
                Academic Branch
                <select value={branch} onChange={(e) => setBranch(e.target.value)}>
                  <option value="Computer Science">Computer Science</option>
                  <option value="Information Technology">Information Technology</option>
                  <option value="Electronics">Electronics</option>
                  <option value="Mechanical">Mechanical</option>
                  <option value="Civil">Civil</option>
                </select>
              </label>

              <button
                className="primary-button"
                type="submit"
                disabled={isPredicting}
                style={{ marginTop: '10px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                <span>{isPredicting ? 'Computing Inference...' : 'Run ML Prediction'}</span>
                <ArrowRight size={14} color="currentColor" aria-hidden="true" />
              </button>
            </form>
          </article>
        </div>
      </section>
    </ErrorBoundary>
  );
}
