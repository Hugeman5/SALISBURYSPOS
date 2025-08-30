import type { Role } from '@/types';
import { call } from './call';

// Types must match the payload shapes expected by the Cloud Functions
export type UpsertUserPayload = {
  id?: string;
  name: string;
  role: Role;
  active: boolean;
  hourlyRateZar: number;
};
export const upsertUser = (data: UpsertUserPayload) => 
  call<{ ok: boolean, id: string }, UpsertUserPayload>('adminUpsertUser', data);


export type DeleteUserPayload = {
  id: string;
};
export const deleteUser = (data: DeleteUserPayload) =>
  call<{ ok: boolean, id: string }, DeleteUserPayload>('adminDeleteUser', data);


export type SetPinPayload = {
  id: string;
  pin: string;
};
export const setUserPin = (data: SetPinPayload) =>
  call<{ ok: boolean }, SetPinPayload>('adminSetUserPin', data);
