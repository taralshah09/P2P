import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CONTROL_MESSAGES } from '../src/lib/protocol.js';
import { sendFile, sendFiles } from '../src/lib/sender.js';
import { FileReceiver } from '../src/lib/receiver.js';

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function makeFileLike(data, name = 'test.bin', type = 'application/octet-stream') {
  const u8 = data instanceof Uint8Array ? data : new Uint8Array(data);
  return {
    name,
    type,
    size: u8.byteLength,
    slice: (start, end) => new Blob([u8.slice(start, end)])
  };
}

/**
 * A loopback channel + manager that drives a real FileReceiver. Every byte the
 * sender writes is replayed into the receiver. Whatever the receiver acks back
 * (TRANSFER_CONFIRMED / TEXT_RECEIVED) is delivered to manager.onDataChannelMessage,
 * which is exactly what sendFiles listens on. This exercises the full
 * sequencing handshake end to end.
 */
function makeLoopback(receiver) {
  const manager = { onDataChannelMessage: null, dataChannel: null, pc: null };
  const sentControl = [];
  // Process messages strictly in send-order, mirroring a real DataChannel's
  // sequential onmessage delivery (the receiver hook awaits each message).
  let chain = Promise.resolve();

  const channel = {
    readyState: 'open',
    bufferedAmount: 0,
    bufferedAmountLowThreshold: 0,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    send: (msg) => {
      if (typeof msg === 'string') {
        sentControl.push(JSON.parse(msg));
      }
      chain = chain.then(async () => {
        const result = await receiver.handleMessage(msg);
        if (result?.success) {
          // Mimic the receiver hook: ack so the sender releases the next file.
          manager.sendData(JSON.stringify({
            type: CONTROL_MESSAGES.TRANSFER_CONFIRMED,
            fileIndex: result.fileIndex
          }));
        }
      });
    }
  };

  manager.dataChannel = channel;
  manager.sendData = (data) => {
    if (manager.onDataChannelMessage) manager.onDataChannelMessage(data);
  };

  return { manager, channel, sentControl };
}

const pc = { sctp: { maxMessageSize: 65536 } };

beforeEach(() => {
  if (typeof URL.createObjectURL !== 'function') {
    URL.createObjectURL = vi.fn(() => 'blob:mock');
  }
});

// ──────────────────────────────────────────────
// FILE_METADATA carries totalFiles
// ──────────────────────────────────────────────

describe('sendFile — multi-file metadata', () => {
  it('defaults totalFiles to 1 for the single-file path', async () => {
    const file = makeFileLike(new Uint8Array(10).fill(1));
    const messages = [];
    const channel = { readyState: 'open', bufferedAmount: 0, bufferedAmountLowThreshold: 0, addEventListener: vi.fn(), removeEventListener: vi.fn(), send: (m) => messages.push(m) };

    await sendFile(file, channel, pc);

    const meta = JSON.parse(messages[0]);
    expect(meta.type).toBe(CONTROL_MESSAGES.FILE_METADATA);
    expect(meta.totalFiles).toBe(1);
    expect(meta.fileIndex).toBe(0);
  });

  it('stamps the provided fileIndex and totalFiles', async () => {
    const file = makeFileLike(new Uint8Array(10).fill(1));
    const messages = [];
    const channel = { readyState: 'open', bufferedAmount: 0, bufferedAmountLowThreshold: 0, addEventListener: vi.fn(), removeEventListener: vi.fn(), send: (m) => messages.push(m) };

    await sendFile(file, channel, pc, 2, () => {}, 5);

    const meta = JSON.parse(messages[0]);
    expect(meta.fileIndex).toBe(2);
    expect(meta.totalFiles).toBe(5);
  });
});

// ──────────────────────────────────────────────
// sendFiles — sequencing
// ──────────────────────────────────────────────

describe('sendFiles — sequential queue', () => {
  it('transfers five files in order, each confirmed before the next', async () => {
    const files = Array.from({ length: 5 }, (_, i) =>
      makeFileLike(new Uint8Array(20 + i).fill(i + 1), `file-${i}.bin`)
    );

    const receiver = new FileReceiver();
    const { manager, sentControl } = makeLoopback(receiver);

    const starts = [];
    const completes = [];
    await sendFiles(files, manager.dataChannel, pc, manager, {
      onFileStart: (i) => starts.push(i),
      onFileComplete: (i) => completes.push(i),
    });

    // Every file started and completed, strictly in order.
    expect(starts).toEqual([0, 1, 2, 3, 4]);
    expect(completes).toEqual([0, 1, 2, 3, 4]);

    // Metadata announced each file with the right index and totalFiles=5.
    const metas = sentControl.filter((m) => m.type === CONTROL_MESSAGES.FILE_METADATA);
    expect(metas.map((m) => m.fileIndex)).toEqual([0, 1, 2, 3, 4]);
    expect(metas.every((m) => m.totalFiles === 5)).toBe(true);

    // NEXT_FILE_READY emitted between files (4 gaps for 5 files).
    const readys = sentControl.filter((m) => m.type === CONTROL_MESSAGES.NEXT_FILE_READY);
    expect(readys.map((m) => m.fileIndex)).toEqual([1, 2, 3, 4]);
  });

  it('does not start file N+1 before file N is confirmed', async () => {
    const files = [
      makeFileLike(new Uint8Array(8).fill(1), 'a.bin'),
      makeFileLike(new Uint8Array(8).fill(2), 'b.bin'),
    ];

    const receiver = new FileReceiver();
    const { manager } = makeLoopback(receiver);

    const order = [];
    await sendFiles(files, manager.dataChannel, pc, manager, {
      onFileStart: (i) => order.push(`start:${i}`),
      onFileComplete: (i) => order.push(`done:${i}`),
    });

    // File 0 must fully complete before file 1 starts.
    expect(order).toEqual(['start:0', 'done:0', 'start:1', 'done:1']);
  });

  it('restores the prior onDataChannelMessage handler when finished', async () => {
    const files = [makeFileLike(new Uint8Array(8).fill(1), 'a.bin')];
    const receiver = new FileReceiver();
    const { manager } = makeLoopback(receiver);

    const prior = () => {};
    manager.onDataChannelMessage = prior;

    await sendFiles(files, manager.dataChannel, pc, manager, {});
    expect(manager.onDataChannelMessage).toBe(prior);
  });

  it('rejects the queue when the channel closes mid-transfer', async () => {
    const files = [
      makeFileLike(new Uint8Array(8).fill(1), 'a.bin'),
      makeFileLike(new Uint8Array(8).fill(2), 'b.bin'),
    ];

    // A channel that never acks, but lets us fire its 'close' listener.
    let closeHandler = null;
    const channel = {
      readyState: 'open',
      bufferedAmount: 0,
      bufferedAmountLowThreshold: 0,
      addEventListener: (event, handler) => { if (event === 'close') closeHandler = handler; },
      removeEventListener: vi.fn(),
      send: vi.fn(),
    };
    const manager = { onDataChannelMessage: null, dataChannel: channel, pc };

    const promise = sendFiles(files, channel, pc, manager, {});
    // Let file 0 finish sending and start awaiting its confirmation.
    await new Promise((r) => setTimeout(r, 10));
    expect(typeof closeHandler).toBe('function');
    closeHandler(); // simulate the peer dropping

    await expect(promise).rejects.toThrow(/closed during transfer/i);
  });
});

// ──────────────────────────────────────────────
// FileReceiver — reuse across files
// ──────────────────────────────────────────────

describe('FileReceiver — multi-file reuse', () => {
  it('returns fileIndex and totalFiles on each completed file', async () => {
    const files = [
      makeFileLike(new Uint8Array(12).fill(7), 'one.bin'),
      makeFileLike(new Uint8Array(12).fill(9), 'two.bin'),
    ];

    const receiver = new FileReceiver();
    const results = [];
    const { manager } = makeLoopback(receiver);

    await sendFiles(files, manager.dataChannel, pc, manager, {});

    // Replay independently to assert the receiver's return shape directly.
    const r2 = new FileReceiver();
    const msgs = [];
    const channel = { readyState: 'open', bufferedAmount: 0, bufferedAmountLowThreshold: 0, addEventListener: vi.fn(), removeEventListener: vi.fn(), send: (m) => msgs.push(m) };
    await sendFile(files[1], channel, pc, 1, () => {}, 2);
    let final = null;
    for (const m of msgs) {
      const res = await r2.handleMessage(m);
      if (res) final = res;
    }
    expect(final.success).toBe(true);
    expect(final.fileIndex).toBe(1);
    expect(final.totalFiles).toBe(2);
  });
});
