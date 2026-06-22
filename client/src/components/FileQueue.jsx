import React, { useRef, useState } from 'react';

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return (bytes / Math.pow(k, i)).toFixed(1) + ' ' + sizes[i];
}

const STATUS_META = {
  waiting: { label: 'Waiting', color: '#9ca3af' },
  transferring: { label: 'Sending…', color: '#2563eb' },
  receiving: { label: 'Receiving…', color: '#2563eb' },
  done: { label: 'Done', color: '#16a34a' },
  failed: { label: 'Failed', color: '#dc2626' }
};

/**
 * Phase 7 — multi-file queue UI. Two modes:
 *  - editable: a multi-select drop zone + browse, with a removable file list
 *    (used before the transfer starts).
 *  - status (editable=false): a read-only ordered list with per-file status
 *    badges and progress bars (used during/after the transfer).
 *
 * `items` is the model to render. In editable mode pass the raw File[]; in
 * status mode pass the per-file status objects from the hook
 * ({ name, size, status, sentBytes|receivedBytes, totalBytes }).
 */
export default function FileQueue({
  items = [],
  editable = false,
  onAdd = () => {},
  onRemove = () => {},
  byteField = 'sentBytes'
}) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length) onAdd(Array.from(e.dataTransfer.files));
  }

  function handleChange(e) {
    if (e.target.files?.length) onAdd(Array.from(e.target.files));
    // reset so selecting the same file again still fires onChange
    e.target.value = '';
  }

  const totalBytes = items.reduce((sum, f) => sum + (f.size || f.totalBytes || 0), 0);

  return (
    <div>
      {editable && (
        <div
          className={`drop-zone${dragOver ? ' drag-over' : ''}`}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          style={{ cursor: 'pointer' }}
        >
          <input
            ref={inputRef}
            type="file"
            multiple
            style={{ display: 'none' }}
            onChange={handleChange}
          />
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📁</div>
          <div style={{ fontWeight: 500 }}>Drop files here or click to browse</div>
          <div style={{ color: '#9ca3af', fontSize: '0.8rem', marginTop: '0.25rem' }}>
            You can select multiple files
          </div>
        </div>
      )}

      {items.length > 0 && (
        <div style={{ marginTop: editable ? '0.75rem' : 0 }}>
          {items.map((f, i) => {
            const sent = f[byteField] ?? 0;
            const total = f.totalBytes ?? f.size ?? 0;
            const pct = total > 0 ? Math.min(100, Math.round((sent / total) * 100)) : (f.status === 'done' ? 100 : 0);
            const meta = STATUS_META[f.status] || null;
            return (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.5rem 0.75rem',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  marginBottom: '0.5rem',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}>
                    📄 {f.name || `File ${i + 1}`}
                  </div>
                  <div style={{ color: '#6b7280', fontSize: '0.8rem' }}>
                    {formatBytes(total)}
                    {meta && (f.status === 'transferring' || f.status === 'receiving') && total > 0
                      ? ` · ${pct}%`
                      : ''}
                  </div>
                  {meta && (f.status === 'transferring' || f.status === 'receiving') && (
                    <div style={{
                      height: '4px',
                      background: '#e5e7eb',
                      borderRadius: '2px',
                      overflow: 'hidden',
                      marginTop: '0.35rem',
                    }}>
                      <div style={{
                        width: `${pct}%`,
                        height: '100%',
                        background: meta.color,
                        transition: 'width 0.15s ease',
                      }} />
                    </div>
                  )}
                </div>

                {meta && (
                  <span style={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: meta.color,
                    whiteSpace: 'nowrap',
                  }}>
                    {f.status === 'done' ? '✓ ' : ''}{meta.label}
                  </span>
                )}

                {editable && (
                  <button
                    className="btn btn-secondary"
                    onClick={(e) => { e.stopPropagation(); onRemove(i); }}
                    style={{ padding: '0.15rem 0.5rem', fontSize: '0.8rem' }}
                    aria-label={`Remove ${f.name}`}
                  >
                    ✕
                  </button>
                )}
              </div>
            );
          })}

          <div style={{ color: '#9ca3af', fontSize: '0.8rem', marginTop: '0.25rem' }}>
            {items.length} file{items.length === 1 ? '' : 's'} · {formatBytes(totalBytes)} total
          </div>
        </div>
      )}
    </div>
  );
}
