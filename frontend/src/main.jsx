import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BarChart, Bar, CartesianGrid, Cell, Line, LineChart, PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import './styles.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const roles = ['Machine Learning Engineer', 'Data Scientist', 'Data Analyst', 'Backend Developer', 'Software Development Engineer', 'Frontend Developer', 'DevOps Engineer', 'Business Analyst', 'AI Engineer', 'Cloud Engineer'];
async function request(path, options = {}, token) {
  const headers = { ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers };
  const response = await fetch(`${API}${path}`, { ...options, headers });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.detail || 'Request failed');
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
  return <main className="login-shell"><section className="hero"><p className="eyebrow">AI career diagnostic</p><h1>Know your next best career move.</h1><p>Upload a resume to turn your present skills into a practical role, learning, and interview plan.</p></section><form className="login-card" onSubmit={submit}><h2>Demo sign in</h2><p>Use the prefilled demo account or configure it in your backend environment.</p><label>Email<input value={email} onChange={e => setEmail(e.target.value)} type="email" /></label><label>Password<input value={password} onChange={e => setPassword(e.target.value)} type="password" /></label>{error && <p className="error">{error}</p>}<button>Open dashboard</button></form></main>;
}

function Metric({ label, value, detail }) { return <article className="metric"><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>; }
function App() {
  const [token, setToken] = useState(localStorage.getItem('career_token'));
  const [selectedRole, setSelectedRole] = useState('Machine Learning Engineer');
  const [weeks, setWeeks] = useState(12);
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState('Upload a PDF or DOCX resume to begin.');
  const [result, setResult] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [interview, setInterview] = useState(null);
  const [answers, setAnswers] = useState({});
  const [active, setActive] = useState('overview');
  const loggedIn = Boolean(token);
  function login(value) { localStorage.setItem('career_token', value); setToken(value); }
  function logout() { localStorage.removeItem('career_token'); setToken(null); setResult(null); }
  async function loadDashboard() { const data = await request('/dashboard/progress', {}, token); setDashboard(data); }
  async function uploadAndAnalyse(event) {
    event.preventDefault(); if (!file) { setStatus('Select a PDF or DOCX resume first.'); return; }
    try {
      setStatus('Uploading resume…'); const form = new FormData(); form.append('file', file); await request('/resumes/upload', { method: 'POST', body: form }, token);
      setStatus('Extracting your profile and calculating recommendations…'); const job = await request('/analysis/run', { method: 'POST', body: JSON.stringify({ target_role: selectedRole, timeline_weeks: Number(weeks) }) }, token);
      let current; for (let attempt = 0; attempt < 20; attempt += 1) { current = await request(`/analysis/${job.id}/status`, {}, token); if (current.status === 'completed' || current.status === 'failed') break; await new Promise(resolve => setTimeout(resolve, 700)); }
      if (current.status !== 'completed') throw new Error(current.error || 'Analysis did not finish'); setResult(current.result); await loadDashboard(); setStatus('Analysis complete.'); setActive('overview');
    } catch (err) { setStatus(`Error: ${err.message}`); }
  }
  async function startInterview() { try { const data = await request(`/interviews/session?role_name=${encodeURIComponent(selectedRole)}`, { method: 'POST' }, token); setInterview(data); setActive('interview'); } catch (err) { setStatus(`Error: ${err.message}`); } }
  async function submitAnswer(index) { try { const response = await request(`/interviews/${interview.id}/answer`, { method: 'POST', body: JSON.stringify({ question_index: index, answer: answers[index] || '' }) }, token); setAnswers(old => ({ ...old, [`score-${index}`]: response })); } catch (err) { setStatus(`Error: ${err.message}`); } }
  const radar = useMemo(() => dashboard?.skill_radar || [], [dashboard]);
  if (!loggedIn) return <Login onLogin={login} />;
  return <main className="app"><header><div><p className="eyebrow">AI CAREER MENTOR</p><h1>Your placement preparation cockpit</h1></div><button className="ghost" onClick={logout}>Sign out</button></header><nav>{['overview', 'skills', 'roadmap', 'interview'].map(tab => <button className={active === tab ? 'active' : ''} onClick={() => setActive(tab)} key={tab}>{tab}</button>)}</nav><section className="upload-panel"><form onSubmit={uploadAndAnalyse}><div><label>Target role<select value={selectedRole} onChange={e => setSelectedRole(e.target.value)}>{roles.map(role => <option key={role}>{role}</option>)}</select></label><label>Preparation weeks<input value={weeks} min="1" max="52" type="number" onChange={e => setWeeks(e.target.value)} /></label></div><label className="file-field">Resume (PDF/DOCX)<input type="file" accept=".pdf,.docx" onChange={e => setFile(e.target.files?.[0])} /></label><button>Upload & analyse</button></form><p className="status">{status}</p></section>{!result ? <section className="empty"><h2>Your results will appear here</h2><p>For a quick demo, upload any normal PDF or DOCX resume containing skills such as Python, SQL, React, or Machine Learning.</p></section> : <>{active === 'overview' && <Overview result={result} dashboard={dashboard} onInterview={startInterview} />}{active === 'skills' && <Skills result={result} />}{active === 'roadmap' && <Roadmap result={result} token={token} refresh={async () => { await loadDashboard(); }} />}{active === 'interview' && <Interview interview={interview} answers={answers} setAnswers={setAnswers} submitAnswer={submitAnswer} startInterview={startInterview} />}</>}</main>;
}

function Overview({ result, dashboard, onInterview }) { const score = Math.round(result.placement_probability * 100); return <><section className="metrics"><Metric label="Placement readiness" value={`${score}%`} detail="Estimate, not a hiring guarantee" /><Metric label="Skill gaps" value={result.skill_gaps.length} detail="Prioritized for your target role" /><Metric label="Roadmap tasks" value={result.roadmap.flatMap(w => w.tasks).length} detail="Sequenced by prerequisites" /><Metric label="Model version" value={result.model_version} detail="Transparent demo baseline" /></section><section className="grid two"><article className="card"><div className="card-title"><h2>Role fit</h2><span>Top 5 matches</span></div><ResponsiveContainer width="100%" height={250}><BarChart data={result.role_scores}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="role_name" tick={{ fontSize: 11 }} interval={0} angle={-18} textAnchor="end" height={70} /><YAxis /><Tooltip /><Bar dataKey="match_score" fill="#6d5dfc" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer></article><article className="card"><div className="card-title"><h2>Readiness factors</h2><span>Feature impact</span></div>{result.shap_factors.map(factor => <div className="factor" key={factor.feature}><span>{factor.feature.replaceAll('_', ' ')}</span><div><i style={{ width: `${Math.abs(factor.impact) * 500}%` }} className={factor.direction === 'down' ? 'negative' : ''}/></div><b>{factor.impact > 0 ? '+' : ''}{factor.impact}</b></div>)}</article></section><section className="grid two"><article className="card"><div className="card-title"><h2>Current gap profile</h2><span>Higher means more attention</span></div><ResponsiveContainer width="100%" height={270}><RadarChart data={dashboard?.skill_radar || []}><PolarGrid /><PolarAngleAxis dataKey="skill" tick={{ fontSize: 11 }} /><Radar dataKey="value" stroke="#f28b30" fill="#f28b30" fillOpacity={0.45} /><Tooltip /></RadarChart></ResponsiveContainer></article><article className="card action"><p className="eyebrow">NEXT STEP</p><h2>Practise a tailored mock interview</h2><p>Questions use Gemini or your configured OpenAI-compatible provider. If neither key is set, the demo generator is clearly labelled.</p><button onClick={onInterview}>Generate interview</button></article></section></>; }
function Skills({ result }) { return <section className="grid two"><article className="card"><h2>Priority skill gaps</h2><div className="list">{result.skill_gaps.map(gap => <div className="gap" key={gap.skill}><div><strong>{gap.skill}</strong><p>{gap.explanation}</p></div><span>{Math.round((1-gap.similarity)*100)}% gap</span></div>)}</div></article><article className="card"><h2>Recommended learning</h2><div className="list">{result.courses.map(group => <div className="course" key={group.skill_gap}><strong>{group.skill_gap}</strong>{group.recommendations.map(course => <a key={course.link} href={course.link} target="_blank" rel="noreferrer">{course.name}<span>{course.platform} · {course.relevance_score}%</span></a>)}</div>)}</div></article></section>; }
function Roadmap({ result, token, refresh }) { const [saving, setSaving] = useState(''); async function toggle(task) { setSaving(task.task_id); try { await request(`/roadmap/tasks/${task.task_id}`, { method: 'PATCH', body: JSON.stringify({ completed: !task.completed }) }, token); task.completed = !task.completed; await refresh(); } finally { setSaving(''); } } return <section className="roadmap">{result.roadmap.map(week => <article className="card week" key={week.week_number}><span>WEEK {week.week_number}</span><h2>{week.focus_skills.join(' + ')}</h2>{week.tasks.map(task => <label className={task.completed ? 'done task' : 'task'} key={task.task_id}><input checked={task.completed} disabled={saving === task.task_id} type="checkbox" onChange={() => toggle(task)} />{task.title}</label>)}</article>)}</section>; }
function Interview({ interview, answers, setAnswers, submitAnswer, startInterview }) { if (!interview) return <section className="empty"><h2>Ready when you are</h2><p>Generate a tailored interview from the Overview tab.</p><button onClick={startInterview}>Generate interview</button></section>; return <section className="interview"><div className="section-heading"><div><p className="eyebrow">{interview.provider}</p><h2>{interview.role_name} mock interview</h2></div><button className="ghost" onClick={startInterview}>New questions</button></div>{interview.questions.map((question, index) => <article className="card question" key={index}><span>{question.category}</span><h3>{question.question}</h3><textarea value={answers[index] || ''} onChange={e => setAnswers(old => ({ ...old, [index]: e.target.value }))} placeholder="Write your answer…" /><button disabled={!answers[index]} onClick={() => submitAnswer(index)}>Get feedback</button>{answers[`score-${index}`] && <div className="feedback"><strong>Similarity score: {answers[`score-${index}`].score}%</strong><p>{answers[`score-${index}`].note}</p><p><b>Model-answer guide:</b> {answers[`score-${index}`].model_answer}</p></div>}</article>)}</section>; }
createRoot(document.getElementById('root')).render(<App />);
