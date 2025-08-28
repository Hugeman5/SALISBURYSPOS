
'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/stores/auth-store';
import { useRouter } from 'next/navigation';
import { PinKeypad } from '@/components/pin-keypad';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LogIn } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AnimatePresence, motion } from 'framer-motion';

type User = { id: string; name: string; role: string; active: boolean };

export default function LoginPage() {
  const router = useRouter();
  const loginWithPin = useAuth(s => s.loginWithPin);
  const role = useAuth(s => s.role);
  const profile = useAuth(s => s.profile);
  const loading = useAuth(s => s.loading);

  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [pin, setPin] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const lastSubmittedPin = useRef<string | null>(null);

  useEffect(() => {
    (async () => {
      const q = query(collection(db, 'users'), where('active', '==', true));
      const snap = await getDocs(q);
      setUsers(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
    })().catch(e => { console.error(e); setErr('Failed to fetch users'); });
  }, []);

  useEffect(() => {
    if (profile && role) {
      const target = role === 'admin' || role === 'manager'
        ? '/dashboard/admin'
        : '/pos';
      router.push(target);
    }
  }, [profile, role, router]);

  const handleLogin = useCallback(async (currentPin: string) => {
    if (loading || !selectedUser) return;
    lastSubmittedPin.current = currentPin;
    setErr(null);
    const ok = await loginWithPin(selectedUser.id, currentPin);
    if (!ok) {
        setErr('Invalid PIN or server error');
        // The keypad will handle the visual feedback (shake)
        setTimeout(() => setPin(''), 1000);
    }
  }, [loading, loginWithPin, selectedUser]);

  useEffect(() => {
    if (pin.length !== 4) return;
    if (loading) return;
    if (lastSubmittedPin.current === pin) return;

    const handler = setTimeout(() => {
        handleLogin(pin);
    }, 250);

    return () => clearTimeout(handler);
  }, [pin, loading, handleLogin]);


  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
            <div className="flex justify-center items-center gap-2 mb-2">
              <LogIn className="h-8 w-8 text-primary" />
              <h1 className="text-3xl font-bold">SALISBURYSPOS</h1>
            </div>
             <p className="text-muted-foreground text-sm">
                Blazing Fast Point of Sale
            </p>
        </CardHeader>
        <CardContent>
          {!selectedUser ? (
            <div className="space-y-4">
              <p className="text-center text-muted-foreground">Select a user to begin</p>
              <div className="grid grid-cols-2 gap-4">
                {users.map(u => (
                  <Button key={u.id} variant="outline" className="h-auto p-4 flex flex-col items-start" onClick={() => setSelectedUser(u)}>
                    <span className="font-semibold text-base">{u.name}</span>
                    <span className="text-muted-foreground text-sm capitalize">{u.role}</span>
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
               <p className="text-center text-muted-foreground">Enter PIN for <span className="font-semibold text-foreground">{selectedUser.name}</span></p>
              <PinKeypad
                pin={pin}
                onPinChange={setPin}
                busy={loading}
                onSubmit={() => handleLogin(pin)}
                hasError={!!err}
              />
              <Button variant="link" className="w-full" onClick={() => { setSelectedUser(null); setPin(''); setErr(null); }}>Select different user</Button>
            </div>
          )}
          <div className="min-h-[40px] mt-4" aria-live="polite">
            <AnimatePresence>
            {err && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                >
                    <Alert variant="destructive">
                        <AlertDescription>{err}</AlertDescription>
                    </Alert>
                </motion.div>
            )}
            </AnimatePresence>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
