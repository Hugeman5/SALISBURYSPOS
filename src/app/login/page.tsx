'use client';

import { useEffect, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/stores/auth-store';
import { useRouter } from 'next/navigation';
import { PinKeypad } from '@/components/pin-keypad';

type User = { id: string; name: string; role: string; active: boolean };

export default function LoginPage() {
  const router = useRouter();
  const loginWithPin = useAuth(s => s.loginWithPin);
  const role = useAuth(s => s.role);
  const profile = useAuth(s => s.profile);
  const loading = useAuth(s => s.loading);

  const [users, setUsers] = useState<User[]>([]);
  const [selected, setSelected] = useState<User | null>(null);
  const [err, setErr] = useState<string | null>(null);

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
        : role === 'cashier'
          ? '/pos'
          : role === 'waiter'
            ? '/pos'
            : '/pos';
      router.push(target);
    }
  }, [profile, role, router]);

  return (
    <main style={{ padding: 24 }}>
      <h1>Login</h1>
      {err && <p style={{ color:'crimson' }}>{err}</p>}

      {!selected ? (
        <>
          <p>Select a user:</p>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:12 }}>
            {users.map(u => (
              <button key={u.id} onClick={()=>setSelected(u)} style={{ textAlign:'left', padding:12, border:'1px solid #ddd', borderRadius:10 }}>
                <div style={{ fontSize:18, fontWeight:600 }}>{u.name}</div>
                <div style={{ color:'#666' }}>{u.role}</div>
              </button>
            ))}
          </div>
        </>
      ) : (
        <div style={{ maxWidth: 360 }}>
          <p>Enter PIN for <strong>{selected.name}</strong></p>
          <PinKeypad
            busy={loading}
            onSubmit={async (pin) => {
              setErr(null);
              const ok = await loginWithPin(selected.id, pin);
              if (!ok) setErr('Invalid PIN or server error');
            }}
          />
          <button onClick={()=>setSelected(null)} style={{ marginTop:10 }}>Choose different user</button>
          {err && <p style={{ color:'crimson' }}>{err}</p>}
        </div>
      )}
    </main>
  );
}
