'use client';

import { collection, addDoc, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useEffect, useState } from 'react';
import { RoleGate } from '@/components/auth-gate';

type Role = 'admin'|'manager'|'cashier'|'waiter'|'kitchen';
type User = { id?: string; name: string; role: Role; active: boolean; pin?: string };

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<User>({ name:'', role:'cashier', active:true, pin:'' });

  async function load() {
    const q = query(collection(db, 'users'), orderBy('name'));
    const snap = await getDocs(q);
    setUsers(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
  }
  useEffect(() => { load().catch(console.error); }, []);

  async function createUser() {
    if (!form.name || !form.pin || form.pin.length !== 4) {
      alert('Name and 4-digit PIN required'); return;
    }
    setBusy(true);
    try {
      const payload = { name: form.name, role: form.role, active: true, pin: String(form.pin) };
      await addDoc(collection(db, 'users'), payload);
      setForm({ name:'', role:'cashier', active:true, pin:'' });
      await load();
    } finally { setBusy(false); }
  }

  return (
    <RoleGate allow={['admin','manager']}>
      <main style={{ padding:24 }}>
        <h1>Users & Roles</h1>

        <section style={{ margin:'12px 0', padding:16, border:'1px solid #eee', borderRadius:10 }}>
          <h3>Create user</h3>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
            <input placeholder="Name" value={form.name} onChange={e=>setForm(f=>({ ...f, name:e.target.value }))} />
            <select value={form.role} onChange={e=>setForm(f=>({ ...f, role: e.target.value as Role }))}>
              <option value="admin">admin</option><option value="manager">manager</option>
              <option value="cashier">cashier</option><option value="waiter">waiter</option><option value="kitchen">kitchen</option>
            </select>
            <input placeholder="4-digit PIN" value={form.pin} onChange={e=>setForm(f=>({ ...f, pin:e.target.value.replace(/\\D/g,'').slice(0,4) }))} />
            <button onClick={createUser} disabled={busy}>Create</button>
          </div>
        </section>

        <section>
          <h3>Active users</h3>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead><tr><th align="left">Name</th><th align="left">Role</th><th align="left">Active</th></tr></thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} style={{ borderTop:'1px solid #eee' }}>
                  <td>{u.name}</td><td>{u.role}</td><td>{String((u as any).active)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </main>
    </RoleGate>
  );
}
