import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <section className="empty-state error-boundary-box" style={{ padding: '32px', textAlign: 'center' }}>
          <div className="empty-index" style={{ color: 'var(--danger)' }}>!</div>
          <div>
            <p className="overline" style={{ color: 'var(--danger)' }}>Component Error</p>
            <h2>{this.props.fallbackTitle || 'Unable to display this section'}</h2>
            <p className="muted">
              {this.state.error?.message || 'An unexpected rendering error occurred. Please refresh or try again.'}
            </p>
            <button
              className="primary-button"
              type="button"
              onClick={() => this.setState({ hasError: false })}
            >
              Try Again
            </button>
          </div>
        </section>
      );
    }

    return this.props.children;
  }
}
