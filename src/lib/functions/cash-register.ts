import { call } from './call';

// Open Session
export type OpenSessionPayload = {
  registerId: string;
  openingFloat: number; // In cents
};
export const openRegisterSession = (data: OpenSessionPayload) =>
  call<{ ok: boolean; sessionId: string }, any>('manageRegisterSession', { ...data, action: 'open' });

// Close Session
export type CloseSessionPayload = {
  sessionId: string;
  countedCash: number; // In cents
};
export const closeRegisterSession = (data: CloseSessionPayload) =>
  call<{ ok: boolean; overShort: number }, any>('manageRegisterSession', { ...data, action: 'close' });


// Post Cash Movement
export type PostCashMovementPayload = {
  sessionId: string;
  type: 'payin' | 'payout';
  amount: number; // In cents
  reason: string;
};
export const postCashMovement = (data: PostCashMovementPayload) =>
  call<{ ok: boolean }, PostCashMovementPayload>('postCashMovement', data);
