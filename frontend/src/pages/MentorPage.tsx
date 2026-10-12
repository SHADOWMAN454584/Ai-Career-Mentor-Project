import React, { useState } from 'react';
import { MessageSquare, Target, RotateCcw, ArrowRight } from 'lucide-react';
import { InterviewAnswerResult, InterviewSession } from '../types/api';
import { request } from '../lib/api';
import { MentorChat } from '../components/chat/MentorChat';
import { ErrorBoundary } from '../components/common/ErrorBoundary';

interface MentorPageProps {
  selectedRole: string;
}

export function MentorPage({ selectedRole }: MentorPageProps) {
  const [interview, setInterview] = useState<InterviewSession | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<Record<string, InterviewAnswerResult>>({});
  const [isLoadingInterview, setIsLoadingInterview] = useState(false);
  const [submittingIndex, setSubmittingIndex] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'chat' | 'interview'>('chat');

  async function handleStartInterview() {
    setIsLoadingInterview(true);
    try {
      const data = await request<InterviewSession>(
        `/mentor/interview/session?role_name=${encodeURIComponent(selectedRole)}`,
        { method: 'POST' }
      );
      setInterview(data);
      setAnswers({});
      setFeedback({});
      setActiveTab('interview');
    } catch (err) {
      console.error('Failed to create interview session:', err);
    } finally {
      setIsLoadingInterview(false);
    }
  }

  async function handleSubmitAnswer(index: number) {
    if (!interview) return;
    const answerText = answers[index] || '';
    if (!answerText.trim()) return;

    setSubmittingIndex(index);
    try {
      const res = await request<InterviewAnswerResult>(
        `/mentor/interview/${interview.id}/answer`,
        {
          method: 'POST',
          body: JSON.stringify({ question_index: index, answer: answerText }),
        }
      );
      setFeedback((prev) => ({ ...prev, [index]: res }));
    } catch (err) {
      console.error('Failed to submit answer:', err);
    } finally {
      setSubmittingIndex(null);
    }
  }

  return (
    <ErrorBoundary fallbackTitle="AI Mentor Section Error">
      <section style={{ display: 'grid', gap: '28px' }}>
        <div style={{ display: 'flex', gap: '12px', borderBottom: '1px solid var(--border)', paddingBottom: '16px' }}>
          <button
            type="button"
            className={activeTab === 'chat' ? 'primary-button' : 'text-button'}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
            onClick={() => setActiveTab('chat')}
          >
            <MessageSquare size={16} color="currentColor" aria-hidden="true" />
            <span>Real-Time AI Chat</span>
          </button>
          <button
            type="button"
            className={activeTab === 'interview' ? 'primary-button' : 'text-button'}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
            onClick={() => setActiveTab('interview')}
          >
            <Target size={16} color="currentColor" aria-hidden="true" />
            <span>Mock Interview Practice</span>
          </button>
        </div>

        {activeTab === 'chat' ? (
          <MentorChat targetRole={selectedRole} />
        ) : (
          <section className="interview-section">
            {!interview ? (
              <div
                style={{
                  padding: '48px 32px',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  textAlign: 'center',
                  display: 'grid',
                  gap: '16px',
                  placeItems: 'center',
                }}
              >
                <p className="overline">Interview Simulator</p>
                <h2>Deliberate Practice for {selectedRole}</h2>
                <p className="muted" style={{ maxWidth: '480px' }}>
                  Generate 3 tailored technical, scenario, and behavioral questions. Submit your answers
                  and receive immediate lexical and semantic alignment scores.
                </p>
                <button
                  className="primary-button"
                  type="button"
                  disabled={isLoadingInterview}
                  onClick={handleStartInterview}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                >
                  <span>{isLoadingInterview ? 'Generating Questions...' : 'Start Mock Interview'}</span>
                  <ArrowRight size={14} color="currentColor" aria-hidden="true" />
                </button>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p className="overline">{interview.provider} · Evaluator</p>
                    <h2>{interview.role_name} Mock Practice</h2>
                  </div>
                  <button
                    className="text-button"
                    type="button"
                    disabled={isLoadingInterview}
                    onClick={handleStartInterview}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    <RotateCcw size={13} color="currentColor" aria-hidden="true" />
                    <span>Regenerate questions</span>
                  </button>
                </div>

                <div className="interview-note">
                  {interview.scoring_note ||
                    'Answer in your own words using clear structure. Detailed feedback appears immediately after submission.'}
                </div>

                <div className="question-list">
                  {interview.questions.map((q, idx) => (
                    <article className="question-block" key={idx}>
                      <div className="question-meta">
                        <span>Question 0{idx + 1}</span>
                        <span style={{ textTransform: 'capitalize' }}>{q.category}</span>
                      </div>
                      <h3>{q.question}</h3>

                      <textarea
                        value={answers[idx] || ''}
                        onChange={(e) => setAnswers((prev) => ({ ...prev, [idx]: e.target.value }))}
                        placeholder="Write your answer using the STAR method or clear technical reasoning..."
                        rows={5}
                      />

                      <div className="question-actions">
                        <span>{(answers[idx] || '').length}/5000 characters</span>
                        <button
                          className="primary-button"
                          type="button"
                          disabled={!(answers[idx] || '').trim() || submittingIndex === idx}
                          onClick={() => handleSubmitAnswer(idx)}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                        >
                          <span>
                            {submittingIndex === idx
                              ? 'Evaluating...'
                              : feedback[idx]
                              ? 'Update Answer'
                              : 'Submit Answer'}
                          </span>
                          <ArrowRight size={14} color="currentColor" aria-hidden="true" />
                        </button>
                      </div>

                      {feedback[idx] && (
                        <div className="feedback">
                          <div>
                            <span className="overline">Heuristic Score</span>
                            <strong>{feedback[idx].score}%</strong>
                          </div>
                          <p>{feedback[idx].note}</p>
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}
      </section>
    </ErrorBoundary>
  );
}
