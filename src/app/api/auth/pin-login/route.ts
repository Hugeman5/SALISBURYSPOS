
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

async function resolveUid(uid?: string, id?: string): Promise<string | null> {
    if (uid) return uid;
    if (id) {
        // First, check if the id is a direct UID
        const userById = await adminDb.collection('users').doc(id).get();
        if (userById.exists) return id;
    }
    return null;
}


export async function POST(req: Request) {
  try {
    const { uid: reqUid, id: reqId, pin } = await req.json().catch(() => ({} as any));
    if (!pin) {
      return NextResponse.json({ error: 'Missing pin' }, { status: 400 });
    }

    const uid = await resolveUid(reqUid, reqId);
    if (!uid) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userRef = adminDb.collection('users').doc(uid);
    const secretRef = adminDb.collection('userSecrets').doc(uid);
    const [userSnap, secretSnap] = await Promise.all([userRef.get(), secretRef.get()]);

    if (!userSnap.exists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    if (!secretSnap.exists) {
        return NextResponse.json({ error: 'PIN not set for user' }, { status: 401 });
    }

    const user = userSnap.data() as any;
    const secret = secretSnap.data() as any;

    if (!user.active) {
      return NextResponse.json({ error: 'User inactive' }, { status: 403 });
    }

    if (!secret.pinHash) {
        return NextResponse.json({ error: 'PIN not set for user' }, { status: 401 });
    }

    const ok = await bcrypt.compare(pin, secret.pinHash);
    if (!ok) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }
    
    // Ensure Auth user exists for token creation
    await ensureAuthUser(uid, user.name);

    const role = (user.role as string) || 'cashier';
    await adminAuth.setCustomUserClaims(uid, { role });
    const token = await adminAuth.createCustomToken(uid, { role });

    return NextResponse.json({ token, role, uid });
  } catch (e: any) {
    console.error('pin-login error:', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
