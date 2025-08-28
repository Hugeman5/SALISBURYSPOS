export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase-admin';

type Role = 'admin'|'manager'|'cashier'|'waiter'|'kitchen';

export async function POST(req: Request) {
  try {
    const { id, pin } = await req.json();

    if (!id || !pin || String(pin).length !== 4) {
      return NextResponse.json({ error: 'Missing id or pin' }, { status: 400 });
    }

    // 1) Read Firestore ONLY
    const snap = await adminDb.collection('users').doc(String(id)).get();
    if (!snap.exists) {
      return NextResponse.json({ error: 'Invalid PIN or user' }, { status: 401 });
    }

    const data = snap.data() as { pin: string; active?: boolean; role?: Role };
    if (data?.active === false) {
      return NextResponse.json({ error: 'User is inactive' }, { status: 403 });
    }
    if (!data?.pin || String(data.pin) !== String(pin)) {
      return NextResponse.json({ error: 'Invalid PIN or user' }, { status: 401 });
    }

    const role = (data.role ?? 'cashier') as Role;

    // 2) Create custom token **locally** with embedded role claim.
    // (No Identity Toolkit call required for createCustomToken when using a JSON key)
    const token = await adminAuth.createCustomToken(String(id), { role });

    return NextResponse.json({ token }); // client will read role from ID token claims
  } catch (e: any) {
    console.error('pin-login failed:', e?.message || e);
    return NextResponse.json({ error: String(e?.message ?? e) }, { status: 500 });
  }
}
