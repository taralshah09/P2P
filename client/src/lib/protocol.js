export const HEADER_SIZE = 38; // 2 (fileIndex) + 4 (chunkIndex) + 32 (sha256)

export const CONTROL_MESSAGES = {
  FILE_METADATA: 'FILE_METADATA',
  TRANSFER_COMPLETE: 'TRANSFER_COMPLETE',
  ERROR: 'ERROR',
  // Phase 6 — text sharing. Both are low-frequency JSON control messages
  // (never binary chunk frames). TEXT_MESSAGE carries the whole snippet;
  // TEXT_RECEIVED is the receiver's delivery ack back to the sender.
  TEXT_MESSAGE: 'TEXT_MESSAGE',
  TEXT_RECEIVED: 'TEXT_RECEIVED',
  // Phase 7 — multi-file queue. After the receiver has verified and saved
  // file N it sends TRANSFER_CONFIRMED { fileIndex } back to the sender; the
  // sender waits for that ack before announcing the next file with
  // NEXT_FILE_READY and sending file N+1's FILE_METADATA. This gates the
  // sequence so the receiver finishes writing/downloading one file (which
  // may include its own save-file prompt) before the next one starts.
  TRANSFER_CONFIRMED: 'TRANSFER_CONFIRMED',
  NEXT_FILE_READY: 'NEXT_FILE_READY'
};

/**
 * Packs a chunk payload with its binary header.
 * @param {number} fileIndex - uint16
 * @param {number} chunkIndex - uint32
 * @param {Uint8Array} chunkHash - 32 bytes
 * @param {Uint8Array} payload - raw chunk data
 * @returns {Uint8Array} - packed data
 */
export function packChunk(fileIndex, chunkIndex, chunkHash, payload) {
  const buffer = new ArrayBuffer(HEADER_SIZE + payload.byteLength);
  const dataView = new DataView(buffer);
  
  dataView.setUint16(0, fileIndex, true);
  dataView.setUint32(2, chunkIndex, true);
  
  const uint8Array = new Uint8Array(buffer);
  uint8Array.set(chunkHash, 6);
  uint8Array.set(payload, HEADER_SIZE);
  
  return uint8Array;
}

/**
 * Unpacks a received chunk buffer into its components.
 * @param {ArrayBuffer} buffer 
 * @returns {{ fileIndex: number, chunkIndex: number, chunkHash: Uint8Array, payload: Uint8Array }}
 */
export function unpackChunk(buffer) {
  const dataView = new DataView(buffer);
  
  const fileIndex = dataView.getUint16(0, true);
  const chunkIndex = dataView.getUint32(2, true);
  
  const uint8Array = new Uint8Array(buffer);
  const chunkHash = uint8Array.slice(6, HEADER_SIZE);
  const payload = uint8Array.slice(HEADER_SIZE);
  
  return { fileIndex, chunkIndex, chunkHash, payload };
}
