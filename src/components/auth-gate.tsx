
'use client';
import { ReactNode, useEffect } from 'react';
import { useAuth } from '@/stores/auth-store';
import { useRouter, usePathname } from 'next/navigation';
import type { Role } from '@/types';
import { Loader2 } from 'lucide-react';

function FullPageLoader({ message }: { message: string }) {
    return (
        <div className="flex h-screen w-full flex-col items-center justify-center text-muted-foreground gap-4">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p>{message}</p>
        </div>
    );
}

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
    return <FullPageLoader message="Checking session…" />;
  }

  return <>{children}</>;
}

export function RoleGate({ allow, children }: { allow: Role[], children: ReactNode }) {
  const role = useAuth(s => s.role);
  const hydrated = useAuth(s => s.hydrated);
  const pathname = usePathname();

  if (!hydrated) {
      return <FullPageLoader message="Verifying permissions…" />;
  }
  
  if (!role || !allow.includes(role)) {
    return (
        <div className="flex h-screen w-full flex-col items-center justify-center text-destructive gap-4">
            <p>Access Denied</p>
            <p className="text-sm text-muted-foreground">You do not have permission to view this page ({pathname}).</p>
        </div>
    );
  }

  return <>{children}</>;
}
