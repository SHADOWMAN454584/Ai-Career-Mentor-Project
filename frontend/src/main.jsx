import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const roles = ['Machine Learning Engineer', 'Data Scientist', 'Data Analyst', 'Backend Developer', 'Software Development Engineer', 'Frontend Developer', 'DevOps Engineer', 'Business Analyst', 'AI Engineer', 'Cloud Engineer'];
const tabs = [
  { id: 'overview', label: 'Overview', hint: 'Your current position' },
  { id: 'skills', label: 'Skills', hint: 'Close the important gaps' },
  { id: 'roadmap', label: 'Roadmap', hint: 'Your preparation plan' },
  { id: 'interview', label: 'Interview', hint: 'Practise under pressure' },
];

async function request(path, options = {}, token) {
  const headers = { ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers };
  const response = await fetch(`${API}${path}`, { ...options, headers });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = response.status === 401 ? 'Your session has expired. Sign in again.' : response.status === 413 ? 'That file is too large. Choose a smaller resume.' : response.status === 415 ? 'Use a PDF or DOCX resume.' : response.status >= 500 ? 'The service is temporarily unavailable. Try again shortly.' : body.detail || 'Something went wrong. Try again.';
    throw new Error(message);
  }
  return body;
}

function Login({ onLogin }) {
  const [email, setEmail] = useState('demo@careermentor.local');
  const [password, setPassword] = useState('demo123');
  const [error, setError] = useState('');
  async function submit(event) {
    event.preventDefault(); setError('');
    try { const data = await request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }); onLogin(data.access_token); }
    catch (err) { setError(err.message); }
  }
  return <main className="login-page"><section className="login-intro"><div className="brand-mark">CM</div><p className="overline">Career Mentor</p><h1>Make your next move with evidence.</h1><p className="intro-copy">A focused workspace for turning your resume into a role target, practical skill plan, and interview practice.</p><div className="intro-rule" /><p className="quiet">Resume analysis / role matches / preparation roadmap</p></section><form className="login-form" onSubmit={submit}><div><p className="overline">Welcome back</p><h2>Sign in to your workspace</h2><p className="muted">Use the demo account to explore the complete experience.</p></div><label>Email<input required value={email} onChange={event => setEmail(event.target.value)} type="email" autoComplete="email" /></label><label>Password<input required value={password} onChange={event => setPassword(event.target.value)} type="password" autoComplete="current-password" /></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="primary-button" type="submit">Continue <span aria-hidden="true">-&gt;</span></button><p className="form-note">Your estimates are based on the information extracted from your resume.</p></form></main>;
}

function App() {
  const [token, setToken] = useState(localStorage.getItem('career_token'));
  const [selectedRole, setSelectedRole] = useState('Machine Learning Engineer');
  const [weeks, setWeeks] = useState(12);
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState({ type: 'idle', message: 'Choose a resume to begin.' });
  const [result, setResult] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [interview, setInterview] = useState(null);
  const [answers, setAnswers] = useState({});
  const [active, setActive] = useState('overview');
  const loggedIn = Boolean(token);

  function login(value) { localStorage.setItem('career_token', value); setToken(value); }
  function logout() { localStorage.removeItem('career_token'); setToken(null); setResult(null); setDashboard(null); }
  async function loadDashboard() {
    try { const data = await request('/dashboard/progress', {}, token); setDashboard(data); if (data.result) { setResult(data.result); setSelectedRole(data.result.target_role || selectedRole); } }
    catch (err) { if (err.message.includes('expired')) logout(); }
  }
  useEffect(() => { if (token) loadDashboard(); }, [token]);

  async function uploadAndAnalyse(event) {
    event.preventDefault();
    if (!file) { setStatus({ type: 'error', message: 'Select a PDF or DOCX resume first.' }); return; }
    try {
      setStatus({ type: 'uploading', message: 'Uploading your resume' });
      const form = new FormData(); form.append('file', file); await request('/resumes/upload', { method: 'POST', body: form }, token);
      setStatus({ type: 'processing', message: 'Reading your resume and building your plan' });
      const job = await request('/analysis/run', { method: 'POST', body: JSON.stringify({ target_role: selectedRole, timeline_weeks: Number(weeks) }) }, token);
      let current;
      for (let attempt = 0; attempt < 20; attempt += 1) { current = await request(`/analysis/${job.id}/status`, {}, token); if (current.status === 'completed' || current.status === 'failed') break; await new Promise(resolve => setTimeout(resolve, 700)); }
      if (current.status !== 'completed') throw new Error('The analysis could not be completed. Try another resume.');
      setResult(current.result); await loadDashboard(); setStatus({ type: 'complete', message: 'Analysis complete. Your workspace is ready.' }); setActive('overview');
    } catch (err) { setStatus({ type: 'error', message: err.message }); }
  }
  async function startInterview() {
    try { setStatus({ type: 'idle', message: 'Preparing your interview questions' }); const data = await request(`/interviews/session?role_name=${encodeURIComponent(selectedRole)}`, { method: 'POST' }, token); setInterview(data); setAnswers({}); setActive('interview'); }
    catch (err) { setStatus({ type: 'error', message: err.message }); }
  }
  async function submitAnswer(index) {
    try { const response = await request(`/interviews/${interview.id}/answer`, { method: 'POST', body: JSON.stringify({ question_index: index, answer: answers[index] || '' }) }, token); setAnswers(old => ({ ...old, [`score-${index}`]: response })); }
    catch (err) { setStatus({ type: 'error', message: err.message }); }
  }
  if (!loggedIn) return <Login onLogin={login} />;
  const displayName = 'Demo Student';
  return <main className="app-shell"><aside className="sidebar"><div className="brand"><div className="brand-mark">CM</div><div><strong>Career Mentor</strong><span>Preparation workspace</span></div></div><div className="sidebar-label">Workspace</div><nav className="main-nav" aria-label="Main navigation">{tabs.map(tab => <button className={active === tab.id ? 'nav-item active' : 'nav-item'} onClick={() => setActive(tab.id)} key={tab.id}><span>{tab.label}</span><small>{tab.hint}</small></button>)}</nav><div className="sidebar-footer"><span className="status-dot" />Analysis estimates are guidance, not guarantees.<button className="sign-out" onClick={logout}>Sign out</button></div></aside><section className="workspace"><header className="topbar"><div><p className="overline">{tabs.find(tab => tab.id === active)?.label || 'Workspace'}</p><h1>{displayName}</h1></div><div className="topbar-meta"><span className="live-dot" />Workspace synced<button className="avatar" aria-label="Account menu">DS</button></div></header><section className="context-bar"><div><span className="context-label">Target role</span><strong>{selectedRole}</strong></div><div className="context-divider" /><div><span className="context-label">Preparation window</span><strong>{weeks} weeks</strong></div><div className="context-spacer" /><span className={status.type === 'error' ? 'status-message error-text' : 'status-message'}>{status.message}</span></section><section className="content">{active === 'overview' && <><ResumePanel selectedRole={selectedRole} setSelectedRole={setSelectedRole} weeks={weeks} setWeeks={setWeeks} file={file} setFile={setFile} submit={uploadAndAnalyse} status={status} /><Overview result={result} dashboard={dashboard} onInterview={startInterview} onSkills={() => setActive('skills')} onRoadmap={() => setActive('roadmap')} /></>}{active === 'skills' && (result ? <Skills result={result} /> : <EmptyState title="No skill analysis yet" text="Upload your resume to see the capabilities that support your target role and the gaps worth closing first." action="Analyse resume" onAction={() => setActive('overview')} />)}{active === 'roadmap' && (result ? <Roadmap result={result} token={token} refresh={loadDashboard} /> : <EmptyState title="Your roadmap is waiting" text="Complete a resume analysis to generate a preparation plan based on your target role." action="Analyse resume" onAction={() => setActive('overview')} />)}{active === 'interview' && <Interview interview={interview} answers={answers} setAnswers={setAnswers} submitAnswer={submitAnswer} startInterview={startInterview} />}</section></section></main>;
}

function ResumePanel({ selectedRole, setSelectedRole, weeks, setWeeks, file, setFile, submit, status }) { return <section className="resume-panel"><div className="panel-copy"><p className="overline">Start here</p><h2>Build your preparation plan</h2><p>Use your latest resume to get a grounded view of role fit, priority gaps, and what to practise next.</p></div><form className="analysis-form" onSubmit={submit}><label>Target role<select value={selectedRole} onChange={event => setSelectedRole(event.target.value)}>{roles.map(role => <option key={role}>{role}</option>)}</select></label><label>Timeline<select value={weeks} onChange={event => setWeeks(event.target.value)}>{[4, 8, 12, 16, 24].map(value => <option value={value} key={value}>{value} weeks</option>)}</select></label><label className="file-picker">Resume<input type="file" accept=".pdf,.docx" onChange={event => setFile(event.target.files?.[0] || null)} /><span>{file ? file.name : 'Choose PDF or DOCX'}</span></label><button className="primary-button" type="submit" disabled={status.type === 'uploading' || status.type === 'processing'}>{status.type === 'uploading' || status.type === 'processing' ? 'Working...' : 'Analyse resume'} <span aria-hidden="true">-&gt;</span></button></form></section>; }

function Overview({ result, dashboard, onInterview, onSkills, onRoadmap }) {
  if (!result) return <EmptyState title="Your workspace starts with a resume" text="Upload a PDF or DOCX to generate role matches, skill gaps, learning recommendations, and a weekly preparation roadmap." action="How it works" onAction={() => document.querySelector('.file-picker input')?.click()} />;
  const score = Math.round(result.placement_probability * 100); const completed = dashboard?.roadmap_completion || 0; const topRole = result.role_scores?.[0]; const gaps = result.skill_gaps?.slice(0, 3) || [];
  return <><section className="overview-grid"><article className="readiness-panel"><div><p className="overline">Estimated readiness</p><h2>{score}<span>%</span></h2><p className="muted">Based on the information extracted from your resume. This is a preparation signal, not a hiring prediction.</p></div><div className="readiness-track"><span style={{ width: `${score}%` }} /></div><div className="readiness-footer"><span>Current signal</span><strong>{score >= 70 ? 'Good foundation' : 'Build the basics first'}</strong></div></article><article className="next-panel"><p className="overline">Recommended next step</p><h2>{gaps[0] ? `Practise ${gaps[0].skill}` : 'Complete your first roadmap task'}</h2><p>{gaps[0]?.explanation || 'Small, consistent progress is the fastest way to turn this analysis into evidence.'}</p><button className="text-button" onClick={onRoadmap}>Open roadmap <span>-&gt;</span></button></article></section><section className="section-intro"><div><p className="overline">At a glance</p><h2>What deserves your attention</h2></div><p className="muted">Three signals to help you decide what to do next.</p></section><section className="signal-grid"><article className="signal-block"><span className="signal-number">01</span><p className="overline">Strongest role match</p><h3>{topRole?.role_name || 'Not available'}</h3><strong className="signal-value">{topRole?.match_score || 0}% match</strong><p className="muted">{topRole?.contributing_skills?.slice(0, 3).join(', ') || 'Run analysis to see supporting skills.'}</p><button className="text-button" onClick={onSkills}>Review skills <span>-&gt;</span></button></article><article className="signal-block attention"><span className="signal-number">02</span><p className="overline">Priority gaps</p><h3>{result.skill_gaps?.length || 0} skills to strengthen</h3><div className="mini-list">{gaps.map(gap => <div key={gap.skill}><span>{gap.skill}</span><b>{Math.round((1 - gap.similarity) * 100)}%</b></div>)}</div><button className="text-button" onClick={onSkills}>See all gaps <span>-&gt;</span></button></article><article className="signal-block"><span className="signal-number">03</span><p className="overline">Roadmap progress</p><h3>{completed}% complete</h3><div className="progress-track"><span style={{ width: `${completed}%` }} /></div><p className="muted">Follow the weekly plan to build evidence, not just familiarity.</p><button className="text-button" onClick={onRoadmap}>View roadmap <span>-&gt;</span></button></article></section><section className="bottom-action"><div><p className="overline">Interview practice</p><h2>Turn preparation into confidence.</h2><p className="muted">Answer role-specific questions and get a transparent, heuristic score after you submit.</p></div><button className="primary-button" onClick={onInterview}>Start mock interview <span>-&gt;</span></button></section></>;
}

function Skills({ result }) { return <section><div className="section-intro"><div><p className="overline">Skills</p><h2>Close the gaps that matter most</h2></div><p className="muted">Estimated from your resume and the requirements of your target role.</p></div><div className="skills-layout"><article className="surface-list"><div className="list-heading"><span>Priority</span><span>Estimated gap</span></div>{result.skill_gaps.map((gap, index) => <div className="skill-row" key={gap.skill}><span className="rank">0{index + 1}</span><div className="skill-copy"><h3>{gap.skill}</h3><p>{gap.explanation}</p><span className="importance">Importance {gap.importance}/5</span></div><div className="gap-meter"><strong>{Math.round((1 - gap.similarity) * 100)}%</strong><div><span style={{ width: `${(1 - gap.similarity) * 100}%` }} /></div></div></div>)}</article><article className="learning-panel"><p className="overline">Suggested learning</p><h2>Make each gap actionable.</h2>{result.courses.slice(0, 4).map(group => <div className="course-row" key={group.skill_gap}><strong>{group.skill_gap}</strong>{group.recommendations.slice(0, 1).map(course => <a href={course.link} target="_blank" rel="noreferrer" key={course.link}>{course.name}<span>{course.platform} <span aria-hidden="true">-&gt;</span></span></a>)}</div>)}</article></div></section>; }

function Roadmap({ result, token, refresh }) { const [saving, setSaving] = useState(''); async function toggle(task) { setSaving(task.task_id); try { await request(`/roadmap/tasks/${task.task_id}`, { method: 'PATCH', body: JSON.stringify({ completed: !task.completed }) }, token); await refresh(); } finally { setSaving(''); } } const total = result.roadmap.flatMap(week => week.tasks).length; const done = result.roadmap.flatMap(week => week.tasks).filter(task => task.completed).length; return <section><div className="section-intro"><div><p className="overline">Roadmap</p><h2>A plan you can actually follow</h2></div><p className="muted">{done} of {total} tasks complete</p></div><div className="roadmap-list">{result.roadmap.map(week => <article className="week-row" key={week.week_number}><div className="week-index">W{String(week.week_number).padStart(2, '0')}</div><div className="week-content"><p className="overline">Focus</p><h3>{week.focus_skills.join(' + ')}</h3>{week.tasks.map(task => <label className={task.completed ? 'task done' : 'task'} key={task.task_id}><input checked={task.completed} disabled={saving === task.task_id} type="checkbox" onChange={() => toggle(task)} /><span>{task.title}</span></label>)}</div></article>)}</div></section>; }

function Interview({ interview, answers, setAnswers, submitAnswer, startInterview }) { if (!interview) return <EmptyState title="Practise before the real conversation" text="Generate a focused mock interview for your selected role. Your model answers stay private until you submit." action="Generate interview" onAction={startInterview} />; return <section><div className="section-intro"><div><p className="overline">{interview.provider} / heuristic feedback</p><h2>{interview.role_name} interview</h2></div><button className="secondary-button" onClick={startInterview}>New questions</button></div><div className="interview-note">Answer in your own words. Feedback appears only after submission and is a rough signal, not a complete assessment.</div><div className="question-list">{interview.questions.map((question, index) => <article className="question-block" key={index}><div className="question-meta"><span>Question {String(index + 1).padStart(2, '0')}</span><span>{question.category}</span></div><h3>{question.question}</h3><textarea aria-label={`Answer to question ${index + 1}`} value={answers[index] || ''} onChange={event => setAnswers(old => ({ ...old, [index]: event.target.value }))} placeholder="Write your answer here..." /><div className="question-actions"><span>{(answers[index] || '').length}/5000</span><button className="primary-button" disabled={!answers[index]?.trim()} onClick={() => submitAnswer(index)}>{answers[`score-${index}`] ? 'Update feedback' : 'Submit answer'} <span>-&gt;</span></button></div>{answers[`score-${index}`] && <div className="feedback"><div><span className="overline">Heuristic score</span><strong>{answers[`score-${index}`].score}%</strong></div><p>{answers[`score-${index}`].note}</p></div>}</article>)}</div></section>; }

function EmptyState({ title, text, action, onAction }) { return <section className="empty-state"><div className="empty-index">00</div><div><p className="overline">Next step</p><h2>{title}</h2><p className="muted">{text}</p><button className="primary-button" onClick={onAction}>{action} <span>-&gt;</span></button></div></section>; }

createRoot(document.getElementById('root')).render(<App />);
