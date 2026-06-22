import { useState, useCallback } from 'react';
import { sendFiles } from '../lib/sender.js';
import { CONNECTION_STATES } from '../lib/connectionState.js';

/**
 * Sender-side hook for the Phase 7 multi-file queue. Thin wrapper over
 * sendFiles(): the hook only holds React state (the per-file status list and
 * progress); all sequencing logic lives in lib/sender.js.
 *
 * `files` is the ordered status model the UI binds to — one object per queued
 * file: { name, size, status, sentBytes, totalBytes }. status is one of
 * 'waiting' | 'transferring' | 'done' | 'failed'.
 */
export function useFileQueue() {
  const [queueState, setQueueState] = useState('idle'); // idle | transferring | complete | error
  const [files, setFiles] = useState([]); // per-file status objects
  const [queueError, setQueueError] = useState(null);

  const startQueue = useCallback(async (fileList, manager) => {
    if (!fileList?.length || !manager?.dataChannel || !manager?.pc) {
      throw new Error('Not ready to transfer');
    }

    // Seed the status model — every file starts 'waiting'.
    setFiles(fileList.map((f) => ({
      name: f.name,
      size: f.size,
      status: 'waiting',
      sentBytes: 0,
      totalBytes: f.size
    })));
    setQueueState('transferring');
    setQueueError(null);
    manager.stateMachine.transition(CONNECTION_STATES.TRANSFERRING);

    const patch = (index, fields) => setFiles((prev) =>
      prev.map((f, i) => (i === index ? { ...f, ...fields } : f))
    );

    try {
      await sendFiles(fileList, manager.dataChannel, manager.pc, manager, {
        onFileStart: (i) => patch(i, { status: 'transferring' }),
        onProgress: (i, p) => patch(i, { sentBytes: p.sentBytes, totalBytes: p.totalBytes }),
        onFileComplete: (i) => patch(i, { status: 'done', sentBytes: fileList[i].size })
      });
      manager.stateMachine.transition(CONNECTION_STATES.COMPLETE);
      setQueueState('complete');
    } catch (err) {
      // Mark whichever file was mid-flight as failed; the rest stay 'waiting'.
      setFiles((prev) => prev.map((f) =>
        f.status === 'transferring' ? { ...f, status: 'failed' } : f
      ));
      manager.stateMachine.fail(err.message);
      setQueueState('error');
      setQueueError(err.message);
      throw err;
    }
  }, []);

  const reset = useCallback(() => {
    setQueueState('idle');
    setFiles([]);
    setQueueError(null);
  }, []);

  return { queueState, files, queueError, startQueue, reset };
}
