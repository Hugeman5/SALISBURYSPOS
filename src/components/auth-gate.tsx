'use client';
import { ReactNode, useEffect } from 'react';
import { useAuth, attachAuthListenerOnce } from '@/stores/auth-store';
import { useRouter } from 'next/navigation';

export function AuthGate({ children }: { children: ReactNode }) {
  attachAuthListenerOnce();
  const router = useRouter();
  const profile = useAuth(s => s.profile);

  useEffect(() => {
    if (!profile) router.replace('/login');
  }, [profile, router]);

  if (!profile) return <div style={{ padding:24 }}>Checking session…</div>;
  return <>{children}</>;
}

export function RoleGate({ allow, children }: { allow: Array<'admin'|'manager'|'cashier'|'waiter'|'kitchen'>, children: ReactNode }) {
  const role = useAuth(s => s.role);
  if (!role || !allow.includes(role)) return <div style={{ padding:24 }}>Not authorized</div>;
  return <>{children}</>;
}
