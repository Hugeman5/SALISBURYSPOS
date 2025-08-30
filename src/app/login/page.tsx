'use client';
import { useEffect, useRef, useState } from 'react';
import { useAuth, attachAuthListenerOnce } from '@/stores/auth-store';
import { getFirestore, collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { app } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import { Role } from '@/types';

type User = { id: string; name: string; role: Role; active: boolean };

export default function LoginPage() {
  attachAuthListenerOnce();
  const router = useRouter();
  const { loginWithPin, loading, lastError, profile } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [pin, setPin] = useState('');
  const debounceTimer = useRef<any>(null);

  // Live user tiles from Firestore (public read)
  useEffect(() => {
    const db = getFirestore(app);
    const q = query(collection(db, 'users'), where('active', '==', true), orderBy('name'));
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
      setUsers(list);
    });
    return () => unsub();
  }, []);
  
  useEffect(() => {
    if(profile) {
        const target = profile.role === 'admin' || profile.role === 'manager' ? '/dashboard/admin' : '/pos';
        router.replace(target);
    }
  },[profile, router]);

  // Debounced auto-submit when PIN length hits 4
  useEffect(() => {
    if (!selectedId) return;
    if (pin.length !== 4) return;
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(async () => {
      const ok = await loginWithPin(selectedId, pin);
      if (!ok) setPin(''); // reset pin on failure
    }, 250);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin, selectedId, loginWithPin]);

  const disabled = loading || !selectedId;
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
          </div>
        </div>

        {/* PIN pad */}
        <div>
          <h2 className="text-xl font-medium mb-3">
            Enter PIN {selectedUser ? `for ${selectedUser.name}` : ''}
          </h2>
          <div className="mb-2 h-5 text-sm text-destructive">
            {lastError ? `Error: ${lastError}` : ' '}
          </div>

          <div className="mb-4">
            <input
              type="password"
              value={pin}
              readOnly
              placeholder="••••"
              className="text-3xl tracking-widest px-3 py-2 border rounded w-40 text-center bg-muted"
              disabled={disabled}
            />
          </div>

          <div className="grid grid-cols-3 gap-3 w-64">
            {'123456789'.split('').map(n => (
              <button key={n}
                className="py-3 rounded border bg-background hover:bg-muted active:bg-muted/80 disabled:opacity-50"
                onClick={() => setPin(p => (p + n).slice(0,4))}
                disabled={disabled}
              >{n}</button>
            ))}
            <button className="py-3 rounded border bg-background hover:bg-muted active:bg-muted/80 disabled:opacity-50" onClick={() => setPin('')} disabled={disabled}>C</button>
            <button className="py-3 rounded border bg-background hover:bg-muted active:bg-muted/80 disabled:opacity-50" onClick={() => setPin(p => (p + '0').slice(0,4))} disabled={disabled}>0</button>
            <button className="py-3 rounded border bg-background hover:bg-muted active:bg-muted/80 disabled:opacity-50" onClick={() => setPin(p => p.slice(0,-1))} disabled={disabled}>⌫</button>
          </div>
        </div>
      </div>
    </div>
  );
}
