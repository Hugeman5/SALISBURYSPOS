
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import bcrypt from 'bcryptjs';

async function ensureAuthUser(uid: string, displayName?: string) {
  try {
    await adminAuth.getUser(uid);
  } catch {
    // User does not exist in Firebase Auth, create them.
    await adminAuth.createUser({ uid, displayName: displayName || uid });
  }
}

export async function POST(req: Request) {
  try {
    const { id, pin } = await req.json().catch(() => ({}));
    if (!id || !pin) {
      return NextResponse.json({ error: 'Missing user ID or PIN' }, { status: 400 });
    }

    const userRef = adminDb.collection('users').doc(id);
    const secretRef = adminDb.collection('user_secrets').doc(id);
    const [userSnap, secretSnap] = await Promise.all([userRef.get(), secretRef.get()]);

    if (!userSnap.exists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    if (!secretSnap.exists) {
        return NextResponse.json({ error: 'PIN not set for user' }, { status: 401 });
    }

    const user = userSnap.data()!;
    const secret = secretSnap.data()!;

    if (!user.active) {
      return NextResponse.json({ error: 'User account is inactive' }, { status: 403 });
    }

    if (!secret.pinHash) {
        return NextResponse.json({ error: 'PIN not set for user' }, { status: 401 });
    }

    const ok = await bcrypt.compare(pin, secret.pinHash);
    if (!ok) {
      return NextResponse.json({ error: 'Invalid PIN' }, { status: 401 });
    }
    
    // Ensure Auth user exists for token creation
    await ensureAuthUser(id, user.name);

    const role = user.role || 'cashier';
    await adminAuth.setCustomUserClaims(id, { role });
    const token = await adminAuth.createCustomToken(id, { role });

    return NextResponse.json({ token, role, uid: id });
  } catch (e: any) {
    console.error('pin-login error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
