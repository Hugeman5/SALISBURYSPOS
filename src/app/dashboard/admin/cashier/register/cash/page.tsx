
'use client';
import { useEffect, useState } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { app } from '@/lib/firebase';
import { getFirestore, collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';

const presets = [
  { value: 'drop', label: 'Cash drop to safe' },
  { value: 'payout', label: 'Supplier payout / petty cash' },
  { value: 'topup', label: 'Float top-up' },
  { value: 'tip', label: 'Tips paid out' },
  { value: 'correction', label: 'Correction' },
  { value: 'other', label: 'Other' },
] as const;

type Preset = typeof presets[number]['value'];

export default function CashMovementPage(){
  const [uid, setUid] = useState<string>('');
  const [sessionId, setSessionId] = useState<string>('');
  const [amount, setAmount] = useState<string>(''); // rands
  const [direction, setDirection] = useState<'in'|'out'>('out');
  const [reason, setReason] = useState<Preset>('payout');
  const [note, setNote] = useState('');
  const [recent, setRecent] = useState<any[]>([]);

  const db = getFirestore(app);
  const fn = httpsCallable(getFunctions(app), 'postCashMovement');

  useEffect(()=>{
    const auth = getAuth(app);
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) return;
      setUid(user.uid);
      // find open session for this user
      const q = query(
        collection(db, 'register_sessions'),
        where('userId','==',user.uid),
        where('status','==','open'),
        orderBy('openedAt','desc'),
        limit(1)
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        const sid = snap.docs[0].id;
        setSessionId(sid);
        // load recent movements (if any)
        const q2 = query(
          collection(db, 'cash_movements'),
          where('sessionId','==',sid),
          orderBy('createdAt','desc'),
          limit(5)
        );
        const s2 = await getDocs(q2);
        setRecent(s2.docs.map(d=>({ id:d.id, ...d.data() })));
      }
    });
    return () => unsub();
  },[db]);

  async function submit(){
    if (!sessionId) return alert('No open register session.');
    const amt = Number(amount);
    if (!amt || amt <= 0) return alert('Enter a valid amount.');
    const amountCents = Math.round(amt * 100);
    const r:any = await fn({ sessionId, amountCents, direction, reason, note });
    if (r.data?.ok) {
      alert('Cash movement recorded');
      setAmount(''); setNote('');
    }
  }

  return (
    <div className="p-6 max-w-xl">
      <h1 className="text-2xl font-semibold mb-4">Register Cash Movement</h1>
      <div className="space-y-3">
        <p className="text-sm text-gray-600">Session: {sessionId || '—'}</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="block">Amount (R)
            <input inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)} className="border p-2 rounded w-full" placeholder="e.g. 150.00"/>
          </label>
          <label className="block">Direction
            <select value={direction} onChange={e=>setDirection(e.target.value as any)} className="border p-2 rounded w-full">
              <option value="out">OUT (pay out / drop)</option>
              <option value="in">IN (top-up / cash in)</option>
            </select>
          </label>
        </div>
        <label className="block">Reason
          <select value={reason} onChange={e=>setReason(e.target.value as any)} className="border p-2 rounded w-full">
            {presets.map(p=> <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </label>
        <label className="block">Note (optional)
          <input value={note} onChange={e=>setNote(e.target.value)} className="border p-2 rounded w-full" placeholder="Supplier name, receipt ref, etc."/>
        </label>
        <button onClick={submit} className="px-4 py-2 rounded bg-black text-white">Save Movement</button>
      </div>

      {recent.length>0 && (
        <div className="mt-6">
          <h2 className="font-semibold mb-2">Recent</h2>
          <ul className="space-y-2">
            {recent.map(m => (
              <li key={m.id} className="text-sm text-gray-700">
                {new Date(m.createdAt).toLocaleString()} — {m.direction.toUpperCase()} R{(m.amountCents/100).toFixed(2)} ({m.reason}) {m.note ? '– '+m.note : ''}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
