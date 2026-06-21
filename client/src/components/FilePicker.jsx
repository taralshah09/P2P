import React, { useRef, useState } from 'react';

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return (bytes / Math.pow(k, i)).toFixed(1) + ' ' + sizes[i];
}

export default function FilePicker({ file, onFileSelect, disabled }) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) onFileSelect(f);
  }

  function handleChange(e) {
    const f = e.target.files[0];
    if (f) onFileSelect(f);
  }

  return (
    <div
      className={`drop-zone${dragOver ? ' drag-over' : ''}`}
      onClick={() => !disabled && inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={disabled ? undefined : handleDrop}
      style={{ cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1 }}
    >
      <input
        ref={inputRef}
        type="file"
        style={{ display: 'none' }}
        onChange={handleChange}
        disabled={disabled}
      />
      {file ? (
        <div>
          <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>📄 {file.name}</div>
          <div style={{ color: '#666', fontSize: '0.875rem' }}>{formatBytes(file.size)}</div>
        </div>
      ) : (
        <div>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📁</div>
          <div style={{ fontWeight: 500 }}>Drop a file here or click to browse</div>
        </div>
      )}
    </div>
  );
}
