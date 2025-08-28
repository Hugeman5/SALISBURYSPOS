export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase-admin';
import * as bcrypt from 'bcryptjs';
import { FieldValue } from 'firebase-admin/firestore';

async function ensureAuthUser(uid: string, displayName?: string) {
  try {
    await adminAuth.getUser(uid);
  } catch {
    await adminAuth.createUser({ uid, displayName: displayName || uid });
  }
}

export async function POST(request: Request) {
  try {
    const { id, pin } = await request.json();
    if (!id || !pin) return NextResponse.json({ error: 'Missing id or pin' }, { status: 400 });

    const ref = adminDb.collection('users').doc(id);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ error: 'User not found' }, { status: 401 });

    const u = snap.data() as any;
    if (u.active === false) return NextResponse.json({ error: 'User is inactive' }, { status: 401 });

    const role = (u.role as string) || 'cashier';
    const pinHash: string | undefined = u.pinHash;

    let ok = false;
    if (pinHash) {
      ok = await bcrypt.compare(pin, pinHash);
    } else if (u.pin) {
      // Legacy plaintext: accept once, then migrate to hash
      ok = String(u.pin) === String(pin);
      if (ok) {
        const newHash = await bcrypt.hash(String(pin), 10);
        await ref.set({ pin: FieldValue.delete(), pinHash: newHash }, { merge: true });
      }
    }

    if (!ok) return NextResponse.json({ error: 'Invalid PIN' }, { status: 401 });

    // Ensure Auth user + set custom claims (persisted)
    await ensureAuthUser(id, u.name);
    await adminAuth.setCustomUserClaims(id, { role });
    // Also embed role in the custom token for immediate availability
    const token = await adminAuth.createCustomToken(id, { role });

    return NextResponse.json({ token, role });
  } catch (e: any) {
    console.error('pin-login error:', e);
    const msg = e?.message || 'Internal error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
