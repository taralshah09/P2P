import { test, expect } from 'vitest';
import { SIGNALING_TYPES, isValidSignalingMessage } from './signaling-messages.js';
import { CODE_LENGTH } from './constants.js';

test('constants are exported', () => {
  expect(CODE_LENGTH).toBe(6);
});

test('isValidSignalingMessage validates correctly', () => {
  expect(isValidSignalingMessage({ type: SIGNALING_TYPES.OFFER })).toBe(true);
  expect(isValidSignalingMessage({ type: 'UNKNOWN' })).toBe(false);
  expect(isValidSignalingMessage(null)).toBe(false);
});
