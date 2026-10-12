import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, CheckSquare, TrendingUp, Bot, LogOut } from 'lucide-react';

interface SidebarProps {
  onSignOut: () => void;
}

export function Sidebar({ onSignOut }: SidebarProps) {
  const navItems = [
    { to: '/overview', label: 'Overview', hint: 'Your current position', icon: LayoutDashboard },
    { to: '/skills', label: 'Skills', hint: 'Close priority gaps', icon: CheckSquare },
    { to: '/placement', label: 'Placement', hint: 'ML readiness predictor', icon: TrendingUp },
    { to: '/mentor', label: 'AI Mentor', hint: 'Real-time chat & mock Q&A', icon: Bot },
  ];

  return (
    <aside className="sidebar">
      <div className="brand" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <img
          src="/assets/logos/C2C_logo.svg"
          alt="Campus2Career Brand Logo"
          className="brand-logo"
          style={{ height: '32px', width: 'auto', objectFit: 'contain', display: 'block' }}
        />
        <div>
          <strong>Campus2Career</strong>
          <span>Degree to Dream Job</span>
        </div>
      </div>

      <div className="sidebar-label">Workspace</div>

      <nav className="main-nav" aria-label="Main navigation">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Icon size={16} color="currentColor" aria-hidden="true" style={{ flexShrink: 0 }} />
                <div>
                  <span>{item.label}</span>
                  <small>{item.hint}</small>
                </div>
              </div>
            </NavLink>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <span className="status-dot" />
        Analysis estimates are guidance, not guarantees.
        <button
          className="sign-out"
          type="button"
          onClick={onSignOut}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
        >
          <LogOut size={13} color="currentColor" aria-hidden="true" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
