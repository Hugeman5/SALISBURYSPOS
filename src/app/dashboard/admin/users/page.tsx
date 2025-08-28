'use client';

import { useEffect, useState } from 'react';
import { collection, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

type Role = 'admin'|'manager'|'cashier'|'waiter'|'kitchen';
type Staff = { id: string; name: string; role: Role; active: boolean; pin?: string };

export default function UsersPage() {
  const [rows, setRows] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const snap = await getDocs(collection(db, 'users'));
      setRows(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
      setLoading(false);
    })();
  }, []);

  async function toggleActive(u: Staff) {
    await updateDoc(doc(db, 'users', u.id), { active: !u.active });
    setRows(rows.map(r => r.id === u.id ? { ...r, active: !r.active } : r));
  }

  if (loading) return <div className="p-6">Loading users…</div>;

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Staff</h1>
      <table className="min-w-full text-sm">
        <thead className="text-left">
          <tr><th className="p-2">Name</th><th className="p-2">Role</th><th className="p-2">Active</th><th className="p-2">Actions</th></tr>
        </thead>
        <tbody>
        {rows.map(u => (
          <tr key={u.id} className="border-t border-muted">
            <td className="p-2">{u.name}</td>
            <td className="p-2">{u.role}</td>
            <td className="p-2">{u.active ? 'Yes' : 'No'}</td>
            <td className="p-2">
              <button className="underline" onClick={() => toggleActive(u)}>
                {u.active ? 'Deactivate' : 'Activate'}
              </button>
            </td>
          </tr>
        ))}
        </tbody>
      </table>
    </div>
  );
}
