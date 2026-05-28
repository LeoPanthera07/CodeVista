import React from 'react';

export function Spinner({ size = 'md', className = '' }) {
  const sizeClass = size === 'sm' ? 'spinner-sm' : size === 'lg' ? 'spinner-lg' : '';
  return <div className={`spinner ${sizeClass} ${className}`} />;
}

export function SkeletonCard({ count = 1, className = '' }) {
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className={`skeleton skeleton-card ${className}`} />
      ))}
    </>
  );
}

export function SkeletonText({ lines = 3, className = '' }) {
  return (
    <div className={`flex flex-col gap-2 ${className}`} style={{ width: '100%' }}>
      {Array.from({ length: lines }).map((_, index) => {
        const isLast = index === lines - 1;
        return (
          <div
            key={index}
            className="skeleton skeleton-text"
            style={isLast && lines > 1 ? { width: '60%' } : {}}
          />
        );
      })}
    </div>
  );
}

export function SkeletonCode({ className = '' }) {
  return (
    <div className={`skeleton skeleton-code p-4 flex flex-col gap-3 ${className}`}>
      <div className="skeleton skeleton-text" style={{ width: '30%', height: '12px' }} />
      <div className="skeleton skeleton-text" style={{ width: '80%', height: '12px' }} />
      <div className="skeleton skeleton-text" style={{ width: '50%', height: '12px' }} />
      <div className="skeleton skeleton-text" style={{ width: '70%', height: '12px' }} />
    </div>
  );
}

export function ProgressBar({ progress, label, className = '' }) {
  const roundedProgress = Math.min(100, Math.max(0, Math.round(progress || 0)));
  return (
    <div className={`flex flex-col gap-2 w-full ${className}`}>
      {(label || roundedProgress !== undefined) && (
        <div className="flex justify-between items-center text-sm font-medium">
          <span className="text-muted">{label || 'Processing...'}</span>
          <span className="text-primary-light font-mono">{roundedProgress}%</span>
        </div>
      )}
      <div className="progress-bar">
        <div
          className="progress-bar-fill"
          style={{ width: `${roundedProgress}%` }}
        />
      </div>
    </div>
  );
}

export function LoadingOverlay({ message = 'Loading...', className = '' }) {
  return (
    <div className={`loading-overlay ${className}`}>
      <Spinner size="lg" />
      {message && <span className="text-muted font-medium text-sm animate-pulse">{message}</span>}
    </div>
  );
}
