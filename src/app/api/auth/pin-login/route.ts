export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

async function safeJson(req: Request) {
  try { return await req.json(); } catch { return null; }
}

async function ensureAuthUser(uid: string, displayName?: string, disabled?: boolean) {
  try {
    return await adminAuth.getUser(uid);
  } catch (e: any) {
    if (e?.errorInfo?.code === 'auth/user-not-found') {
      return await adminAuth.createUser({ uid, displayName, disabled });
    }
    throw e;
  }
}

export async function POST(req: Request) {
  const body = await safeJson(req);
  if (!body || typeof body.id !== 'string' || typeof body.pin !== 'string') {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const { id, pin } = body as { id: string; pin: string };

  try {
    const docRef = adminDb.collection('users').doc(id);
    const snap = await docRef.get();
    if (!snap.exists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const data = snap.data() as any;
    if (data?.active === false) {
      return NextResponse.json({ error: 'User inactive' }, { status: 403 });
    }

    let ok = false;

    // Prefer hashed PIN if present
    if (data?.pinHash) {
      const { compareSync } = await import('bcryptjs'); // ESM-friendly import
      ok = !!compareSync(pin, data.pinHash);
    } else if (typeof data?.pin === 'string') {
      ok = data.pin === pin;
    }

    if (!ok) {
      return NextResponse.json({ error: 'Invalid PIN' }, { status: 401 });
    }

    const role: string = data?.role ?? 'cashier';
    const name: string = data?.name ?? id;

    // Ensure Auth user exists (with same UID as Firestore doc id)
    await ensureAuthUser(id, name, data?.active === false);

    // Make sure role is attached as a custom claim
    await adminAuth.setCustomUserClaims(id, { role });

    // Issue custom token
    const token = await adminAuth.createCustomToken(id, { role });
    return NextResponse.json({ token }, { status: 200 });
  } catch (e: any) {
    console.error('pin-login crash:', e);
    return NextResponse.json(
      { error: e?.message ?? 'Internal error' },
      { status: 500 }
    );
  }
}
