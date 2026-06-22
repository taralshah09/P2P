import { useState, useRef, useCallback } from 'react';
import { FileReceiver } from '../lib/receiver.js';
import { CONTROL_MESSAGES } from '../lib/protocol.js';
import { CONNECTION_STATES } from '../lib/connectionState.js';

export function useFileReceiver() {
  const [receiveState, setReceiveState] = useState('idle'); // idle | receiving | complete | text | error
  const [progress, setProgress] = useState({ receivedBytes: 0, totalBytes: 0 });
  const [result, setResult] = useState(null);
  const [receiveError, setReceiveError] = useState(null);
  const [fileInfo, setFileInfo] = useState(null);
  const [receivedText, setReceivedText] = useState(null);
  // Phase 7 — multi-file queue. `files` is the per-file status model the UI
  // binds to; `totalFiles` is learned from the first FILE_METADATA. The
  // receiver doesn't know the file list up front, so entries are filled in as
  // each file's metadata arrives.
  const [files, setFiles] = useState([]);
  const [totalFiles, setTotalFiles] = useState(1);
  const receiverRef = useRef(null);
  const currentIndexRef = useRef(0);

  const init = useCallback((manager) => {
    const fileReceiver = new FileReceiver((p) => {
      // Progress is reported for whichever file is currently arriving.
      const idx = currentIndexRef.current;
      setProgress(p);
      setFiles((prev) => prev.map((f, i) =>
        i === idx ? { ...f, receivedBytes: p.receivedBytes, totalBytes: p.totalBytes } : f
      ));
    });
    receiverRef.current = fileReceiver;

    manager.onDataChannelMessage = async (data) => {
      try {
        // Peek at metadata message to surface file info in the UI before handleMessage processes it
        if (typeof data === 'string') {
          try {
            const msg = JSON.parse(data);
            if (msg.type === CONTROL_MESSAGES.TEXT_MESSAGE) {
              // Phase 6 — text sharing. Handled entirely here; the FileReceiver
              // has no concept of text, so surface it and ack the sender.
              setReceivedText(msg.text);
              setReceiveState('text');
              manager.stateMachine.transition(CONNECTION_STATES.COMPLETE);
              try {
                manager.sendData(JSON.stringify({ type: CONTROL_MESSAGES.TEXT_RECEIVED }));
              } catch (_) {
                // ack is best-effort; the receiver already has the text
              }
              return;
            }
            if (msg.type === CONTROL_MESSAGES.NEXT_FILE_READY) {
              // Informational — the FILE_METADATA that follows does the real work.
              return;
            }
            if (msg.type === CONTROL_MESSAGES.FILE_METADATA) {
              const idx = msg.fileIndex ?? 0;
              const total = msg.totalFiles ?? 1;
              currentIndexRef.current = idx;
              setTotalFiles(total);
              setFileInfo({ name: msg.name, size: msg.size, mime: msg.mime });
              setReceiveState('receiving');
              setProgress({ receivedBytes: 0, totalBytes: msg.size });
              // Grow/seed the status list and mark this file as receiving.
              setFiles((prev) => {
                const next = prev.slice();
                while (next.length < total) {
                  next.push({ name: '', size: 0, status: 'waiting', receivedBytes: 0, totalBytes: 0 });
                }
                next[idx] = {
                  name: msg.name,
                  size: msg.size,
                  status: 'receiving',
                  receivedBytes: 0,
                  totalBytes: msg.size
                };
                return next;
              });
            }
          } catch (_) {
            // not JSON — let handleMessage deal with it
          }
        }

        const transferResult = await fileReceiver.handleMessage(data);

        if (transferResult?.success) {
          const idx = transferResult.fileIndex ?? 0;
          const total = transferResult.totalFiles ?? 1;
          const isLast = idx >= total - 1;

          // Mark this file done in the status model.
          setFiles((prev) => prev.map((f, i) =>
            i === idx
              ? { ...f, status: 'done', receivedBytes: f.totalBytes, savedToDisk: transferResult.savedToDisk }
              : f
          ));
          setResult(transferResult);

          // Auto-trigger download for in-memory blob path
          if (!transferResult.savedToDisk && transferResult.blobUrl) {
            const a = document.createElement('a');
            a.href = transferResult.blobUrl;
            a.download = transferResult.name;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
          }

          // Ack so the sender can release the next file. Best-effort: even if
          // the channel is gone, this file is already saved.
          try {
            manager.sendData(JSON.stringify({
              type: CONTROL_MESSAGES.TRANSFER_CONFIRMED,
              fileIndex: idx
            }));
          } catch (_) {
            // ignore — sender will detect the closed channel instead
          }

          if (isLast) {
            // Whole session done — only now is the state machine COMPLETE.
            manager.stateMachine.transition(CONNECTION_STATES.COMPLETE);
            setReceiveState('complete');
          }
          // Otherwise stay in 'receiving' and wait for the next FILE_METADATA.
        }
      } catch (err) {
        manager.stateMachine.fail(err.message);
        setReceiveState('error');
        setReceiveError(err.message);
      }
    };
  }, []);

  const reset = useCallback(() => {
    receiverRef.current = null;
    currentIndexRef.current = 0;
    setReceiveState('idle');
    setProgress({ receivedBytes: 0, totalBytes: 0 });
    setResult(null);
    setReceiveError(null);
    setFileInfo(null);
    setReceivedText(null);
    setFiles([]);
    setTotalFiles(1);
  }, []);

  return { receiveState, progress, result, receiveError, fileInfo, receivedText, files, totalFiles, init, reset };
}
