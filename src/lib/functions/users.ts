import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';

// Types must match the payload shapes expected by the Cloud Functions
import type { Role } from '@/types';

export type UpsertUserPayload = {
  id: string;
  name: string;
  role: Role;
  active: boolean;
  hourlyRateZar: number;
};
export const upsertUser = httpsCallable<UpsertUserPayload, { ok: boolean, id: string }>(functions, 'adminUpsertUser');


export type DeleteUserPayload = {
  id: string;
};
export const deleteUser = httpsCallable<DeleteUserPayload, { ok: boolean, id: string }>(functions, 'adminDeleteUser');


export type SetPinPayload = {
  id: string;
  pin: string;
};
export const setUserPin = httpsCallable<SetPinPayload, { ok: boolean }>(functions, 'adminSetUserPin');
