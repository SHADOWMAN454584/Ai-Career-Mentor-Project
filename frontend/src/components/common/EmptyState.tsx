import React from 'react';
import { ArrowRight } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  text: string;
  action?: string;
  onAction?: () => void;
  badge?: string;
}

export function EmptyState({ title, text, action, onAction, badge = '00' }: EmptyStateProps) {
  return (
    <section className="empty-state">
      <div className="empty-index">{badge}</div>
      <div>
        <p className="overline">Next step</p>
        <h2>{title}</h2>
        <p className="muted">{text}</p>
        {action && onAction && (
          <button
            className="primary-button"
            type="button"
            onClick={onAction}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <span>{action}</span>
            <ArrowRight size={14} color="currentColor" aria-hidden="true" />
          </button>
        )}
      </div>
    </section>
  );
}
