import { chunkFile, getSafeChunkSize } from './chunker.js';
import { computeChunkHash, RootHasher } from './hasher.js';
import { packChunk, CONTROL_MESSAGES } from './protocol.js';
import { BUFFERED_AMOUNT_HIGH_WATERMARK, BUFFERED_AMOUNT_LOW_WATERMARK } from 'shared/src/constants.js';

export async function sendFile(file, dataChannel, pc, fileIndex = 0, onProgress = () => {}, totalFiles = 1) {
  return new Promise(async (resolve, reject) => {
    try {
      const chunkSize = getSafeChunkSize(pc);
      const totalChunks = Math.ceil(file.size / chunkSize) || 1; // handle empty file

      // Send metadata. `totalFiles` lets the receiver label "file 2 of 5";
      // it stays 1 for the single-file path so that flow is unchanged.
      const metadata = {
        type: CONTROL_MESSAGES.FILE_METADATA,
        fileIndex,
        totalFiles,
        name: file.name,
        size: file.size,
        mime: file.type,
        chunkSize,
        totalChunks
      };
      dataChannel.send(JSON.stringify(metadata));

      // Setup backpressure
      dataChannel.bufferedAmountLowThreshold = BUFFERED_AMOUNT_LOW_WATERMARK;

      const rootHasher = new RootHasher();
      const chunkIterator = chunkFile(file, chunkSize);

      let chunkResult = await chunkIterator.next();
      
      const sendNext = async () => {
        while (!chunkResult.done) {
          if (dataChannel.readyState !== 'open') {
            return reject(new Error('DataChannel closed during transfer'));
          }

          if (dataChannel.bufferedAmount > BUFFERED_AMOUNT_HIGH_WATERMARK) {
            // Pause until bufferedAmount drops
            dataChannel.addEventListener('bufferedamountlow', function onLow() {
              dataChannel.removeEventListener('bufferedamountlow', onLow);
              sendNext();
            });
            return;
          }

          const { chunkIndex, payload } = chunkResult.value;
          const chunkHash = await computeChunkHash(payload);
          rootHasher.addChunkHash(chunkHash);
          
          const packed = packChunk(fileIndex, chunkIndex, chunkHash, payload);
          dataChannel.send(packed);

          onProgress({ sentBytes: Math.min((chunkIndex + 1) * chunkSize, file.size), totalBytes: file.size });

          chunkResult = await chunkIterator.next();
        }

        // Finished sending all chunks
        const rootHash = await rootHasher.getRootHash();
        dataChannel.send(JSON.stringify({
          type: CONTROL_MESSAGES.TRANSFER_COMPLETE,
          fileIndex,
          rootHash
        }));
        
        resolve();
      };

      await sendNext();

    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Phase 7 — multi-file queue. Sends an ordered list of files sequentially over
 * the same open DataChannel. After each file's TRANSFER_COMPLETE, it waits for
 * the receiver's TRANSFER_CONFIRMED ack (so the receiver has fully written and
 * downloaded that file) before announcing NEXT_FILE_READY and starting the next.
 *
 * Logic stays framework-agnostic: `manager` is any object exposing
 * `onDataChannelMessage` (the incoming-message hook used by PeerConnectionManager).
 * We install our own listener to capture confirmations, chaining to any prior
 * handler and restoring it when done. A channel `close` mid-queue rejects the
 * pending wait so the session fails cleanly instead of hanging.
 *
 * @param {File[]} files
 * @param {RTCDataChannel} dataChannel
 * @param {RTCPeerConnection} pc
 * @param {{ onDataChannelMessage?: Function }} manager
 * @param {{ onFileStart?: Function, onProgress?: Function, onFileComplete?: Function }} callbacks
 */
export async function sendFiles(files, dataChannel, pc, manager, callbacks = {}) {
  const { onFileStart, onProgress, onFileComplete } = callbacks;
  const total = files.length;
  if (total === 0) return;

  // fileIndex -> { resolve, reject } for that file's TRANSFER_CONFIRMED ack
  const pending = new Map();

  const prevHandler = manager.onDataChannelMessage;
  manager.onDataChannelMessage = (data) => {
    if (typeof data === 'string') {
      try {
        const msg = JSON.parse(data);
        if (msg && msg.type === CONTROL_MESSAGES.TRANSFER_CONFIRMED) {
          const entry = pending.get(msg.fileIndex);
          if (entry) {
            pending.delete(msg.fileIndex);
            entry.resolve();
          }
          return;
        }
      } catch {
        // not JSON — fall through to any prior handler
      }
    }
    if (prevHandler) prevHandler(data);
  };

  const onClose = () => {
    const err = new Error('DataChannel closed during transfer');
    for (const { reject } of pending.values()) reject(err);
    pending.clear();
  };
  dataChannel.addEventListener?.('close', onClose);

  try {
    for (let i = 0; i < total; i++) {
      const file = files[i];
      onFileStart?.(i, file, total);

      // Register the confirmation waiter before sending so a fast receiver
      // ack can never race ahead of us.
      const confirmed = new Promise((resolve, reject) => pending.set(i, { resolve, reject }));

      await sendFile(file, dataChannel, pc, i, (p) => onProgress?.(i, p), total);
      await confirmed;

      onFileComplete?.(i, file, total);

      // Announce the next file is coming (informational; the receiver also
      // learns this from the next FILE_METADATA).
      if (i < total - 1 && dataChannel.readyState === 'open') {
        dataChannel.send(JSON.stringify({
          type: CONTROL_MESSAGES.NEXT_FILE_READY,
          fileIndex: i + 1
        }));
      }
    }
  } finally {
    dataChannel.removeEventListener?.('close', onClose);
    manager.onDataChannelMessage = prevHandler;
  }
}
