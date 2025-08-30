
'use client';
import { ReactNode, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { attachAuthListenerOnce } from '@/stores/auth-store';

function DashboardGuard({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const router = useRouter();
  
  attachAuthListenerOnce();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) {
        router.replace('/login');
      } else {
        setReady(true);
      }
    });
    return () => unsub();
  }, [router]);


  if (!ready) {
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
