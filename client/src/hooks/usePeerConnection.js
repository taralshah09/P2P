import { useState, useRef, useCallback } from 'react';
import { PeerConnectionManager } from '../lib/peerConnection.js';
import { CONNECTION_STATES } from '../lib/connectionState.js';

export function usePeerConnection() {
  const [connState, setConnState] = useState(CONNECTION_STATES.IDLE);
  const [connError, setConnError] = useState(null);
  const managerRef = useRef(null);

  const init = useCallback((signalingClient, iceConfig, isSender, callbacks = {}) => {
    if (managerRef.current) {
      managerRef.current.close();
    }
    const manager = new PeerConnectionManager(signalingClient, iceConfig, isSender);
    manager.onStateChange = (state, reason) => {
      setConnState(state);
      if (reason) setConnError(reason);
      callbacks.onStateChange?.(state, reason);
    };
    if (callbacks.onDataChannelMessage) {
      manager.onDataChannelMessage = callbacks.onDataChannelMessage;
    }
    managerRef.current = manager;
    setConnState(CONNECTION_STATES.SIGNALING);
    setConnError(null);
    return manager;
  }, []);

  const getManager = useCallback(() => managerRef.current, []);

  const close = useCallback(() => {
    managerRef.current?.close();
    managerRef.current = null;
    setConnState(CONNECTION_STATES.IDLE);
  }, []);

  return { connState, connError, init, getManager, close };
}
