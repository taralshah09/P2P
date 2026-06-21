import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function HomePage() {
  const navigate = useNavigate();
  return (
    <div className="card text-center">
      <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.5rem' }}>P2P File Share</h1>
      <p style={{ color: '#666', marginBottom: '2rem' }}>
        Direct device-to-device. No uploads. Your files never touch our servers.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <button
          className="btn btn-primary"
          style={{ padding: '1rem', fontSize: '1rem' }}
          onClick={() => navigate('/send')}
        >
          Send a File
        </button>
        <button
          className="btn btn-secondary"
          style={{ padding: '1rem', fontSize: '1rem' }}
          onClick={() => navigate('/receive')}
        >
          Receive a File
        </button>
      </div>
    </div>
  );
}
