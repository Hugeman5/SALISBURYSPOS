
'use client';
import { ReactNode, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/stores/auth-store';

function DashboardGuard({ children }: { children: ReactNode }) {
  const { profile, hydrated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (hydrated && !profile) {
      router.replace('/login');
    }
  }, [hydrated, profile, router]);

  if (!hydrated || !profile) {
    return (
        <div className="flex h-screen items-center justify-center text-muted-foreground">
            Checking session…
        </div>
    );
  }

  return <>{children}</>;
}


export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <DashboardGuard>{children}</DashboardGuard>;
}
