import React from 'react';

export default function KpiCard({ icon, title, value, helper, tone = 'blue' }) {
  return (
    <div className="kpi-card">
      <div className={`kpi-icon ${tone}`}>{icon}</div>
      <div>
        <p className="kpi-title">{title}</p>
        <h2 className={`kpi-value ${tone}`}>{value}</h2>
        {helper ? <p className="kpi-helper">{helper}</p> : null}
      </div>
    </div>
  );
}
