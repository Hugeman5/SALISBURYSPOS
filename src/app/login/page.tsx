
'use client';
import { useEffect, useRef, useState } from 'react';
import { useAuth, attachAuthListenerOnce } from '@/stores/auth-store';
import { useRouter } from 'next/navigation';
import { Role } from '@/types';
import { PinKeypad } from '@/components/pin-keypad';

type LoginableUser = { id: string; name: string; role: Role };

export default function LoginPage() {
  attachAuthListenerOnce();
  const router = useRouter();
  const { loginWithPin, loading, lastError, profile } = useAuth();
  const [users, setUsers] = useState<LoginableUser[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [pin, setPin] = useState('');
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  // Redirect if already logged in
  useEffect(() => {
    if(profile) {
        const target = profile.role === 'admin' || profile.role === 'manager' ? '/dashboard/admin' : '/pos';
        router.replace(target);
    }
  },[profile, router]);

  // Fetch users who have a PIN set from the secure API endpoint
  useEffect(() => {
    async function fetchUsers() {
        try {
            const res = await fetch('/api/auth/loginable-users');
            if (!res.ok) throw new Error('Failed to fetch users');
            const { users: fetchedUsers } = await res.json();
            setUsers(fetchedUsers || []);
        } catch (error) {
            console.error(error);
        }
    }
    fetchUsers();
  }, []);

  // Debounced auto-submit when PIN length hits 4
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    if (pin.length === 4 && selectedId) {
      debounceTimer.current = setTimeout(async () => {
        const ok = await loginWithPin(selectedId, pin);
        if (!ok) {
          setTimeout(() => setPin(''), 500); // Clear PIN on failure after shake animation
        }
      }, 250);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin, selectedId]);


  const handleLogin = async () => {
    if (!selectedId || pin.length < 4) return;
    const ok = await loginWithPin(selectedId, pin);
    if (!ok) {
      setTimeout(() => setPin(''), 500); // Clear PIN on failure after shake animation
    }
  };

  const selectedUser = users.find(u => u.id === selectedId);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-muted/40">
      <div className="w-full max-w-5xl grid md:grid-cols-2 gap-8 bg-background p-8 rounded-lg shadow-lg">
        {/* Staff list */}
        <div>
          <h1 className="text-2xl font-semibold mb-4">Select User</h1>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {users.map(u => (
              <button
                key={u.id}
                className={`p-3 rounded-lg border text-left transition-colors ${selectedId===u.id ? 'border-primary ring-2 ring-primary bg-primary/10' : 'border-border hover:bg-muted'}`}
                onClick={() => { setSelectedId(u.id); setPin(''); }}
                disabled={loading}
              >
                <div className="font-medium">{u.name || u.id}</div>
                <div className="text-xs text-muted-foreground capitalize">{u.role}</div>
              </button>
            ))}
             {users.length === 0 && <p className="text-muted-foreground col-span-3">No users with PINs found.</p>}
          </div>
        </div>

        {/* PIN pad */}
        <div className="flex flex-col items-center">
            {selectedId ? (
                <>
                    <h2 className="text-xl font-medium mb-3">
                        Enter PIN for {selectedUser?.name}
                    </h2>
                     <div className="min-h-[20px] mb-2 text-sm text-destructive" aria-live="polite">
                        {lastError}
                    </div>
                    <PinKeypad
                        pin={pin}
                        onPinChange={setPin}
                        onSubmit={handleLogin}
                        busy={loading}
                        hasError={!!lastError}
                    />
                </>
            ) : (
                <div className="flex items-center justify-center h-full">
                    <p className="text-muted-foreground">Select a user to begin</p>
                </div>
            )}
        </div>
      </div>
    </div>
  );
}
