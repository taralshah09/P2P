import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSignaling } from '../hooks/useSignaling.js';
import { usePeerConnection } from '../hooks/usePeerConnection.js';
import { useFileReceiver } from '../hooks/useFileReceiver.js';
import { CONNECTION_STATES } from '../lib/connectionState.js';
import { supportsFileSystemAccessAPI } from '../lib/capabilities.js';
import AccessCodeEntry from '../components/AccessCodeEntry.jsx';
import TransferProgress from '../components/TransferProgress.jsx';

export default function ReceiverPage() {
  const navigate = useNavigate();
  const { code: urlCode } = useParams();
  const [uiStep, setUiStep] = useState(urlCode ? 'connecting' : 'idle');
  const [uiError, setUiError] = useState(null);

  const { sessionCode, iceConfig, getClient, joinSession } = useSignaling();
  const { connState, connError, init, getManager } = usePeerConnection();
  const {
    receiveState,
    progress,
    result,
    receiveError,
    fileInfo,
    init: initReceiver,
  } = useFileReceiver();

  // Auto-connect when URL has a code
  useEffect(() => {
    if (urlCode) {
      handleJoin(urlCode);
    }
  }, []);

  // Sync connState -> uiStep
  useEffect(() => {
    if (connState === CONNECTION_STATES.AWAITING_APPROVAL) {
      setUiStep('waiting');
      const manager = getManager();
      if (manager) initReceiver(manager);
    } else if (
      connState === CONNECTION_STATES.FAILED ||
      connState === CONNECTION_STATES.ABORTED
    ) {
      setUiStep('error');
      setUiError(connError || 'Connection failed');
    }
  }, [connState, connError]);

  // Sync receiveState -> uiStep
  useEffect(() => {
    if (receiveState === 'receiving') setUiStep('receiving');
    else if (receiveState === 'complete') setUiStep('complete');
    else if (receiveState === 'error') {
      setUiStep('error');
      setUiError(receiveError);
    }
  }, [receiveState, receiveError]);

  async function handleJoin(code) {
    setUiStep('connecting');
    setUiError(null);
    try {
      await joinSession(code);
    } catch (err) {
      setUiStep('error');
      setUiError(err.message);
    }
  }

  // When session + iceConfig ready, init peer connection as receiver
  useEffect(() => {
    if (!sessionCode || !iceConfig) return;
    const client = getClient();
    if (!client) return;
    init(client, iceConfig, false, {});
  }, [sessionCode, iceConfig]);

  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
        <button
          className="btn btn-secondary"
          onClick={() => navigate('/')}
          style={{ padding: '0.25rem 0.75rem', fontSize: '0.875rem' }}
        >
          Back
        </button>
        <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>Receive a File</h2>
      </div>

      {!supportsFileSystemAccessAPI() && (
        <div className="alert alert-warning" style={{ marginBottom: '1rem', fontSize: '0.85rem' }}>
          On this browser, files over 150 MB may not transfer reliably. Use Chrome or Edge on desktop for large files.
        </div>
      )}

      {uiStep === 'idle' && (
        <div>
          <p style={{ color: '#666', marginBottom: '1rem' }}>Enter the session code from the sender:</p>
          <AccessCodeEntry onJoin={handleJoin} disabled={false} />
        </div>
      )}

      {uiStep === 'connecting' && (
        <div className="text-center">
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Connecting...</div>
          <p style={{ color: '#666' }}>Joining session</p>
        </div>
      )}

      {uiStep === 'waiting' && (
        <div className="text-center">
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Connected</div>
          <h3 style={{ margin: '0 0 0.5rem' }}>Connected to Sender</h3>
          <p style={{ color: '#666' }}>Waiting for the sender to start the transfer...</p>
        </div>
      )}

      {uiStep === 'receiving' && (
        <div>
          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Downloading...</div>
            <h3 style={{ margin: 0 }}>Receiving {fileInfo?.name}</h3>
          </div>
          <TransferProgress
            sentBytes={progress.receivedBytes}
            totalBytes={progress.totalBytes}
            label="Download progress"
          />
        </div>
      )}

      {uiStep === 'complete' && (
        <div className="text-center">
          <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>Done!</div>
          <h3>Download Complete</h3>
          {result?.savedToDisk ? (
            <p style={{ color: '#666' }}>File saved to your chosen location.</p>
          ) : (
            <p style={{ color: '#666' }}>{fileInfo?.name} downloaded successfully.</p>
          )}
          <button
            className="btn btn-primary"
            onClick={() => navigate('/')}
            style={{ marginTop: '0.5rem' }}
          >
            Receive Another File
          </button>
        </div>
      )}

      {uiStep === 'error' && (
        <div className="text-center">
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Error</div>
          <h3>Connection Failed</h3>
          <div className="alert alert-error" style={{ textAlign: 'left', marginBottom: '1rem' }}>
            {uiError}
          </div>
          <button className="btn btn-primary" onClick={() => navigate('/')}>
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}
