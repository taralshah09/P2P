import { useState, useCallback } from 'react';
import { sendFile } from '../lib/sender.js';
import { CONNECTION_STATES } from '../lib/connectionState.js';

export function useFileTransfer() {
  const [transferState, setTransferState] = useState('idle'); // idle | transferring | complete | error
  const [progress, setProgress] = useState({ sentBytes: 0, totalBytes: 0 });
  const [transferError, setTransferError] = useState(null);

  const startTransfer = useCallback(async (file, manager) => {
    if (!file || !manager?.dataChannel || !manager?.pc) {
      throw new Error('Not ready to transfer');
    }
    setTransferState('transferring');
    setProgress({ sentBytes: 0, totalBytes: file.size });
    manager.stateMachine.transition(CONNECTION_STATES.TRANSFERRING);
    try {
      await sendFile(file, manager.dataChannel, manager.pc, 0, (p) => setProgress(p));
      manager.stateMachine.transition(CONNECTION_STATES.COMPLETE);
      setTransferState('complete');
    } catch (err) {
      manager.stateMachine.fail(err.message);
      setTransferState('error');
      setTransferError(err.message);
      throw err;
    }
  }, []);

  const reset = useCallback(() => {
    setTransferState('idle');
    setProgress({ sentBytes: 0, totalBytes: 0 });
    setTransferError(null);
  }, []);

  return { transferState, progress, transferError, startTransfer, reset };
}
