
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';

// Open Session
export type OpenSessionPayload = {
  registerId: string;
  openingFloat: number; // In cents
};
export const openRegisterSession = httpsCallable<OpenSessionPayload, { ok: boolean; sessionId: string }>(
  functions, 
  'manageRegisterSession'
);
Object.defineProperty(openRegisterSession, 'call', { 
  value: (data: OpenSessionPayload, options?: any) => httpsCallable(functions, 'manageRegisterSession')({ ...data, action: 'open' }, options) 
});


// Close Session
export type CloseSessionPayload = {
  sessionId: string;
  countedCash: number; // In cents
};
export const closeRegisterSession = httpsCallable<CloseSessionPayload, { ok: boolean; overShort: number }>(
  functions,
  'manageRegisterSession'
);
Object.defineProperty(closeRegisterSession, 'call', { 
  value: (data: CloseSessionPayload, options?: any) => httpsCallable(functions, 'manageRegisterSession')({ ...data, action: 'close' }, options) 
});


// Post Cash Movement
export type PostCashMovementPayload = {
  sessionId: string;
  type: 'payin' | 'payout';
  amount: number; // In cents
  reason: string;
};
export const postCashMovement = httpsCallable<PostCashMovementPayload, { ok: boolean }>(
  functions,
  'postCashMovement'
);

    