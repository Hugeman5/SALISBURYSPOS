
'use client';
import { ReactNode } from 'react';
import { RoleGate } from '@/components/auth-gate';
import DashboardLayout from '../dashboard/layout';

export default function PosLayout({ children }: { children: ReactNode }) {
  return (
    <DashboardLayout>
      <RoleGate allow={['admin', 'manager', 'cashier', 'waiter', 'kitchen']}>
        {children}
      </RoleGate>
    </DashboardLayout>
  );
}
