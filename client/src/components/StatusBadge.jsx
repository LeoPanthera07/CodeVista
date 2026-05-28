import React from 'react';

export default function StatusBadge({ status }) {
  const normStatus = (status || 'pending').toLowerCase();
  
  let label = 'Pending';
  let className = 'status-badge-pending';
  
  if (normStatus === 'ready' || normStatus === 'completed' || normStatus === 'active') {
    label = 'Ready';
    className = 'status-badge-ready';
  } else if (normStatus === 'analyzing' || normStatus === 'cloning' || normStatus === 'parsing' || normStatus === 'summarizing' || normStatus === 'processing') {
    label = 'Analyzing';
    className = 'status-badge-analyzing';
  } else if (normStatus === 'error' || normStatus === 'failed') {
    label = 'Failed';
    className = 'status-badge-error';
  } else if (normStatus === 'pending') {
    label = 'Pending';
    className = 'status-badge-pending';
  }

  return (
    <span className={`status-badge ${className}`}>
      {normStatus === 'analyzing' || normStatus === 'cloning' || normStatus === 'parsing' || normStatus === 'summarizing' || normStatus === 'processing' ? (
        <span className="animate-pulse" style={{ display: 'inline-block' }}>{label}</span>
      ) : label}
    </span>
  );
}
