import React from 'react';
import { TrendingUp, TrendingDown, Info } from 'lucide-react';

export default function MetricCard({
  icon: Icon,
  label,
  value,
  color = 'primary', // primary, cyan, violet, success, warning, danger
  trend,
  tooltip,
  className = '',
}) {
  const iconColorClass = color !== 'primary' ? `metric-card-icon-${color}` : '';

  return (
    <div className={`metric-card ${className}`}>
      <div className={`metric-card-icon ${iconColorClass}`}>
        {Icon && <Icon size={20} />}
      </div>
      <div className="metric-card-value">{value}</div>
      <div className="metric-card-label" style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
        {label}
        {tooltip && (
          <span className="tooltip-container">
            <Info size={12} style={{ color: 'var(--text-dim)', cursor: 'help' }} />
            <span className="tooltip-text" style={{ bottom: '150%', left: '50%', transform: 'translateX(-50%)', width: '200px' }}>
              {tooltip}
            </span>
          </span>
        )}
      </div>
      {trend && (
        <div className={`metric-card-trend ${trend.direction === 'up' ? 'metric-card-trend-up' : 'metric-card-trend-down'}`}>
          {trend.direction === 'up' ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          <span>{trend.value}</span>
        </div>
      )}
    </div>
  );
}
