import type { Timestamp } from 'firebase/firestore';

export type Role = 'admin'|'manager'|'cashier'|'waiter'|'kitchen';

export type User = {
  id: string;
  name: string;
  role: Role;
  active: boolean;
  avatarUrl?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastSignInAt?: Timestamp;
  email?: string;
  phone?: string;
};
