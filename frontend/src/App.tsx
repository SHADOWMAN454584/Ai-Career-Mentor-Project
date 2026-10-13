import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { getToken, removeToken, request, setToken } from './lib/api';
import { AnalysisJobStatus, AnalysisResult, DashboardProgress } from './types/api';
import { AppShell } from './components/layout/AppShell';
import { LandingPage } from './pages/LandingPage';
import { AuthPage } from './pages/AuthPage';
import { OverviewPage } from './pages/OverviewPage';
import { SkillsPage } from './pages/SkillsPage';
import { MentorPage } from './pages/MentorPage';
import { PlacementPage } from './pages/PlacementPage';
import { ResumeBuilderPage } from './pages/ResumeBuilderPage';

export function App() {
  const navigate = useNavigate();
  const [token, setAuthToken] = useState<string | null>(() => getToken());
  const [theme, setTheme] = useState<string>(() => localStorage.getItem('career_theme') || 'light');
  const [selectedRole, setSelectedRole] = useState<string>('Machine Learning Engineer');
  const [weeks, setWeeks] = useState<number>(12);
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<{ type: string; message: string }>({
    type: 'idle',
    message: 'Choose a resume to begin.',
  });
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [dashboard, setDashboard] = useState<DashboardProgress | null>(null);

  const loggedIn = Boolean(token);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('career_theme', theme);
  }, [theme]);

  function toggleTheme() {
    setTheme((curr) => (curr === 'light' ? 'dark' : 'light'));
  }

  function handleLoginSuccess(newToken: string) {
    setToken(newToken);
    setAuthToken(newToken);
  }

  function handleSignOut() {
    removeToken();
    setAuthToken(null);
    setResult(null);
    setDashboard(null);
    navigate('/');
  }

  async function loadDashboard() {
    if (!token) return;
    try {
      const data = await request<DashboardProgress>('/dashboard/progress', {}, token);
      setDashboard(data);
      if (data.result) {
        setResult(data.result);
        if (data.result.target_role) {
          setSelectedRole(data.result.target_role);
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('expired') || msg.includes('401')) {
        handleSignOut();
      }
    }
  }

  useEffect(() => {
    if (token) {
      loadDashboard();
    }
  }, [token]);

  async function uploadAndAnalyse(event: React.FormEvent) {
    event.preventDefault();
    if (!file) {
      setStatus({ type: 'error', message: 'Select a PDF or DOCX resume first.' });
      return;
    }
    try {
      setStatus({ type: 'uploading', message: 'Uploading your resume...' });
      const form = new FormData();
      form.append('file', file);
      await request('/resumes/upload', { method: 'POST', body: form }, token || undefined);

      setStatus({ type: 'processing', message: 'Parsing resume and generating analysis...' });
      const job = await request<{ id: string; status: string }>(
        '/analysis/run',
        {
          method: 'POST',
          body: JSON.stringify({ target_role: selectedRole, timeline_weeks: Number(weeks) }),
        },
        token || undefined
      );

      let current: AnalysisJobStatus | null = null;
      for (let attempt = 0; attempt < 25; attempt += 1) {
        current = await request<AnalysisJobStatus>(`/analysis/${job.id}/status`, {}, token || undefined);
        if (current.status === 'completed' || current.status === 'failed') break;
        await new Promise((resolve) => setTimeout(resolve, 750));
      }

      if (!current || current.status !== 'completed' || !current.result) {
        throw new Error('Analysis could not be completed. Please verify resume contents.');
      }

      setResult(current.result);
      await loadDashboard();
      setStatus({ type: 'complete', message: 'Analysis complete. Workspace updated.' });
    } catch (err: unknown) {
      setStatus({ type: 'error', message: err instanceof Error ? err.message : 'Analysis failed' });
    }
  }

  return (
    <Routes>
      <Route
        path="/"
        element={
          loggedIn ? (
            <Navigate to="/overview" replace />
          ) : (
            <LandingPage theme={theme} onToggleTheme={toggleTheme} />
          )
        }
      />

      <Route
        path="/auth"
        element={
          loggedIn ? (
            <Navigate to="/overview" replace />
          ) : (
            <AuthPage
              theme={theme}
              onToggleTheme={toggleTheme}
              onLoginSuccess={handleLoginSuccess}
            />
          )
        }
      />

      <Route
        path="/overview"
        element={
          loggedIn ? (
            <AppShell
              title="Overview"
              subtitle="Demo Student"
              selectedRole={selectedRole}
              weeks={weeks}
              statusMessage={status.message}
              isError={status.type === 'error'}
              theme={theme}
              onToggleTheme={toggleTheme}
              onSignOut={handleSignOut}
            >
              <OverviewPage
                selectedRole={selectedRole}
                setSelectedRole={setSelectedRole}
                weeks={weeks}
                setWeeks={setWeeks}
                file={file}
                setFile={setFile}
                onUploadAndAnalyse={uploadAndAnalyse}
                status={status}
                result={result}
                dashboard={dashboard}
              />
            </AppShell>
          ) : (
            <Navigate to="/auth" replace />
          )
        }
      />

      <Route
        path="/skills"
        element={
          loggedIn ? (
            <AppShell
              title="Skill Gaps"
              subtitle="Demo Student"
              selectedRole={selectedRole}
              weeks={weeks}
              statusMessage={status.message}
              isError={status.type === 'error'}
              theme={theme}
              onToggleTheme={toggleTheme}
              onSignOut={handleSignOut}
            >
              <SkillsPage result={result} onRefreshDashboard={loadDashboard} />
            </AppShell>
          ) : (
            <Navigate to="/auth" replace />
          )
        }
      />

      <Route
        path="/placement"
        element={
          loggedIn ? (
            <AppShell
              title="Placement Readiness"
              subtitle="Demo Student"
              selectedRole={selectedRole}
              weeks={weeks}
              statusMessage={status.message}
              isError={status.type === 'error'}
              theme={theme}
              onToggleTheme={toggleTheme}
              onSignOut={handleSignOut}
            >
              <PlacementPage result={result} />
            </AppShell>
          ) : (
            <Navigate to="/auth" replace />
          )
        }
      />

      <Route
        path="/mentor"
        element={
          loggedIn ? (
            <AppShell
              title="AI Mentor"
              subtitle="Demo Student"
              selectedRole={selectedRole}
              weeks={weeks}
              statusMessage={status.message}
              isError={status.type === 'error'}
              theme={theme}
              onToggleTheme={toggleTheme}
              onSignOut={handleSignOut}
            >
              <MentorPage selectedRole={selectedRole} />
            </AppShell>
          ) : (
            <Navigate to="/auth" replace />
          )
        }
      />

      <Route
        path="/resume-builder"
        element={
          loggedIn ? (
            <AppShell
              title="Resume Builder"
              subtitle="Demo Student"
              selectedRole={selectedRole}
              weeks={weeks}
              statusMessage="Resume studio ready"
              theme={theme}
              onToggleTheme={toggleTheme}
              onSignOut={handleSignOut}
            >
              <ResumeBuilderPage targetRole={selectedRole} />
            </AppShell>
          ) : (
            <Navigate to="/auth" replace />
          )
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
