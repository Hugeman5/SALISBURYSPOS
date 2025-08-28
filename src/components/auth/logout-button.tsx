
'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/stores/auth-store';
import { LogOut } from 'lucide-react';
import { Button } from '../ui/button';

export function LogoutButton({ className = '' }: { className?: string }) {
  const router = useRouter();
  const { logout, signingOut } = useAuth();

  const handle = async () => {
    await logout();
    router.replace('/login');
  };

  return (
    <Button
      variant="outline"
      onClick={handle}
      disabled={signingOut}
      className={className}
      title="Sign out"
    >
      <LogOut className="mr-2 h-4 w-4" />
      Logout
    </Button>
  );
}
