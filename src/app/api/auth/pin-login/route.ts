
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import bcrypt from 'bcryptjs';

async function ensureAuthUser(uid: string, displayName?: string) {
  try {
    await adminAuth.getUser(uid);
  } catch {
    await adminAuth.createUser({ uid, displayName: displayName || uid });
  }
}

export async function POST(req: Request) {
  try {
    const { id, pin } = await req.json().catch(() => ({} as any));
    if (!id || !pin) {
      return NextResponse.json({ error: 'Missing id or pin' }, { status: 400 });
    }

    const userRef = adminDb.collection('users').doc(id);
    const secretRef = adminDb.collection('userSecrets').doc(id);
    const [userSnap, secretSnap] = await Promise.all([userRef.get(), secretRef.get()]);

    if (!userSnap.exists || !secretSnap.exists) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const user = userSnap.data() as any;
    const secret = secretSnap.data() as any;

    if (!user.active) {
      return NextResponse.json({ error: 'User inactive' }, { status: 403 });
    }

    const ok = await bcrypt.compare(pin, secret.pinHash);
    if (!ok) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }
    
    // Ensure Auth user exists for token creation
    await ensureAuthUser(id, user.name);

    const role = (user.role as string) || 'cashier';
    await adminAuth.setCustomUserClaims(id, { role });
    const token = await adminAuth.createCustomToken(id, { role });

    return NextResponse.json({ token, role });
  } catch (e: any) {
    console.error('pin-login error:', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
