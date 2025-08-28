npm i bcryptjs
mkdir -p src/app/api/auth/pin-login
cat > src/app/api/auth/pin-login/route.ts <<'TS'
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import bcrypt from 'bcryptjs';

export async function POST(req: Request) {
  try {
    const { id, pin } = await req.json();
    if (typeof id !== 'string' || typeof pin !== 'string' || pin.length !== 4) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const snap = await adminDb.collection('users').doc(id).get();
    if (!snap.exists) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    const data = snap.data() as any;

    if (data?.active !== true) {
      return NextResponse.json({ error: 'User inactive' }, { status: 403 });
    }

    const hash: string | undefined = data?.pinHash;
    let ok = false;
    if (hash?.startsWith('$2')) {
      ok = await bcrypt.compare(pin, hash);
    } else if (typeof data?.pin === 'string' || typeof data?.pin === 'number') {
      ok = String(data.pin) === pin; // fallback for dev seeds
    }

    if (!ok) return NextResponse.json({ error: 'Invalid PIN' }, { status: 401 });

    // Ensure an Auth user exists with UID == Firestore doc id
    const uid = id;
    try {
      await adminAuth.getUser(uid);
    } catch (err: any) {
      if (err?.errorInfo?.code === 'auth/user-not-found') {
        await adminAuth.createUser({ uid, displayName: data?.name ?? id, disabled: false });
      } else {
        throw err;
      }
    }

    const role = data?.role ?? 'employee';
    await adminAuth.setCustomUserClaims(uid, { role });

    const token = await adminAuth.createCustomToken(uid);
    return NextResponse.json({ token });
  } catch (e: any) {
    console.error('pin-login error:', e);
    return NextResponse.json({ error: e?.message ?? 'Internal error' }, { status: 500 });
  }
}
TS
