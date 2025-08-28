'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/stores/auth-store';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { role, hydrated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (hydrated && !role) {
      router.replace('/login');
    }
  }, [hydrated, role, router]);

  if (!hydrated || !role) {
    return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  }
  return <>{children}</>;
}
