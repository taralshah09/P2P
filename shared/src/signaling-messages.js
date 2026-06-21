export const SIGNALING_TYPES = {
  CREATE_SESSION: 'CREATE_SESSION',
  SESSION_CREATED: 'SESSION_CREATED',
  JOIN_SESSION: 'JOIN_SESSION',
  SESSION_JOINED: 'SESSION_JOINED',
  PEER_JOINED: 'PEER_JOINED',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  ERROR: 'ERROR',
  OFFER: 'OFFER',
  ANSWER: 'ANSWER',
  ICE_CANDIDATE: 'ICE_CANDIDATE'
};

export function isValidSignalingMessage(message) {
  if (!message || typeof message !== 'object') return false;
  return Object.values(SIGNALING_TYPES).includes(message.type);
}
