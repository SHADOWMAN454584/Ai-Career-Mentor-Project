import React from 'react';

interface SkeletonProps {
  height?: string | number;
  width?: string | number;
  borderRadius?: string;
  className?: string;
  style?: React.CSSProperties;
}

export function Skeleton({
  height = '20px',
  width = '100%',
  borderRadius = '8px',
  className = '',
  style = {},
}: SkeletonProps) {
  return (
    <div
      className={`skeleton-shimmer ${className}`}
      style={{
        height,
        width,
        borderRadius,
        backgroundColor: 'var(--surface-muted)',
        opacity: 0.8,
        animation: 'pulse 1.6s ease-in-out infinite',
        ...style,
      }}
    />
  );
}

export function WidgetSkeleton() {
  return (
    <div style={{ padding: '24px', background: 'var(--surface)', borderRadius: '16px', display: 'grid', gap: '16px' }}>
      <Skeleton height="14px" width="30%" />
      <Skeleton height="36px" width="60%" />
      <Skeleton height="80px" width="100%" />
      <div style={{ display: 'flex', gap: '12px' }}>
        <Skeleton height="40px" width="50%" />
        <Skeleton height="40px" width="50%" />
      </div>
    </div>
  );
}
