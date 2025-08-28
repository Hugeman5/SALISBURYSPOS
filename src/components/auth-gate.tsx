'use client';
import { ReactNode, useEffect } from 'react';
import { useAuth } from '@/stores/auth-store';
import { useRouter } from 'next/navigation';

export function AuthGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const profile = useAuth(s => s.profile);
  const hydrated = useAuth(s => s.hydrated);

  useEffect(() => {
    if (hydrated && !profile) {
      router.replace('/login');
    }
  }, [hydrated, profile, router]);

  if (!hydrated || !profile) {
    return <div style={{ padding: 24 }}>Checking session…</div>;
  }

  return <>{children}</>;
}

export function RoleGate({ allow, children }: { allow: Array<'admin'|'manager'|'cashier'|'waiter'|'kitchen'>, children: ReactNode }) {
  const role = useAuth(s => s.role);
  if (!role || !allow.includes(role)) return <div style={{ padding:24 }}>Not authorized</div>;
  return <>{children}</>;
}
