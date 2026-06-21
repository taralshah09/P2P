import React, { useState } from 'react';

export default function AccessCodeEntry({ onJoin, disabled }) {
  const [code, setCode] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length === 6) onJoin(trimmed);
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '0.5rem' }}>
      <input
        className="input"
        type="text"
        placeholder="Enter 6-char code"
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))}
        disabled={disabled}
        maxLength={6}
        style={{
          letterSpacing: '0.2em',
          fontFamily: 'monospace',
          fontSize: '1.1rem',
          flexGrow: 1,
        }}
      />
      <button
        type="submit"
        className="btn btn-primary"
        disabled={disabled || code.trim().length !== 6}
      >
        Join
      </button>
    </form>
  );
}
