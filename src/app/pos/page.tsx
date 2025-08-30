
'use client';
import { RoleGate } from '@/components/auth-gate';
import { redirect } from 'next/navigation';

export default function PosPage() {
  // This page is a guard; non-admin/manager users are redirected here from login.
  // We then immediately redirect to the actual sale screen.
  // This structure allows for future expansion of the POS dashboard.
  return (
    <RoleGate allow={['admin', 'manager', 'cashier', 'waiter', 'kitchen']}>
      {redirect('/pos/sale')}
    </RoleGate>
  )
}
