export type Role = 'admin'|'manager'|'cashier'|'waiter'|'kitchen';

export type User = {
  id: string;
  name: string;
  role: Role;
  active: boolean;
  pin?: string;        // stored as plain text for demo; move to hashed later
};
