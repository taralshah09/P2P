import React from 'react';
import { QRCodeSVG } from 'qrcode.react';

export default function QRDisplay({ code, joinUrl }) {
  return (
    <div className="text-center">
      <div style={{
        display: 'inline-block',
        padding: '1rem',
        background: 'white',
        borderRadius: '8px',
        border: '1px solid #e5e7eb',
      }}>
        <QRCodeSVG value={joinUrl} size={180} />
      </div>
      <div style={{ marginTop: '1rem' }}>
        <div style={{ fontSize: '0.875rem', color: '#666', marginBottom: '0.5rem' }}>Or enter this code:</div>
        <div className="code-display">{code}</div>
      </div>
    </div>
  );
}
