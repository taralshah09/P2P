import React from 'react';

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return (bytes / Math.pow(k, i)).toFixed(1) + ' ' + sizes[i];
}

export default function TransferProgress({ sentBytes, totalBytes, label }) {
  const pct = totalBytes > 0 ? Math.round((sentBytes / totalBytes) * 100) : 0;

  return (
    <div>
      {label && (
        <div style={{ fontSize: '0.875rem', color: '#555', marginBottom: '0.5rem' }}>{label}</div>
      )}
      <div className="progress-bar-track">
        <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: '0.8rem',
        color: '#666',
        marginTop: '0.25rem',
      }}>
        <span>{formatBytes(sentBytes)} / {formatBytes(totalBytes)}</span>
        <span>{pct}%</span>
      </div>
    </div>
  );
}
