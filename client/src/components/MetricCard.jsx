import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

export default function MetricCard({
  icon: Icon,
  label,
  value,
  color = 'primary', // primary, cyan, violet, success, warning, danger
  trend,
  className = '',
}) {
  const iconColorClass = color !== 'primary' ? `metric-card-icon-${color}` : '';

  return (
    <div className={`metric-card ${className}`}>
      <div className={`metric-card-icon ${iconColorClass}`}>
        {Icon && <Icon size={20} />}
      </div>
      <div className="metric-card-value">{value}</div>
      <div className="metric-card-label">{label}</div>
      {trend && (
        <div className={`metric-card-trend ${trend.direction === 'up' ? 'metric-card-trend-up' : 'metric-card-trend-down'}`}>
          {trend.direction === 'up' ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          <span>{trend.value}</span>
        </div>
      )}
    </div>
  );
}
