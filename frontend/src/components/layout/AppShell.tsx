import React, { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { ThemeToggle } from '../common/ThemeToggle';

interface AppShellProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
  selectedRole?: string;
  weeks?: number;
  statusMessage?: string;
  isError?: boolean;
  theme: string;
  onToggleTheme: () => void;
  onSignOut: () => void;
}

export function AppShell({
  children,
  title,
  subtitle = 'Demo Student',
  selectedRole = 'Machine Learning Engineer',
  weeks = 12,
  statusMessage = 'Workspace ready',
  isError = false,
  theme,
  onToggleTheme,
  onSignOut,
}: AppShellProps) {
  return (
    <main className="app-shell">
      <Sidebar onSignOut={onSignOut} />

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="overline">{title}</p>
            <h1>{subtitle}</h1>
          </div>
          <div className="topbar-meta">
            <ThemeToggle theme={theme} onToggle={onToggleTheme} />
            <span className="live-dot" />
            Workspace synced
            <button className="avatar" type="button" aria-label="Account profile">
              DS
            </button>
          </div>
        </header>

        <section className="context-bar">
          <div>
            <span className="context-label">Target role</span>
            <strong>{selectedRole}</strong>
          </div>
          <div className="context-divider" />
          <div>
            <span className="context-label">Preparation window</span>
            <strong>{weeks} weeks</strong>
          </div>
          <div className="context-spacer" />
          <span className={isError ? 'status-message error-text' : 'status-message'}>
            {statusMessage}
          </span>
        </section>

        <section className="content">{children}</section>
      </section>
    </main>
  );
}
