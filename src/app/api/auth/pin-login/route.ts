
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import bcrypt from 'bcryptjs';

async function ensureAuthUser(uid: string, displayName?: string) {
  try {
    await adminAuth.getUser(uid);
    console.log(`[pin-login] Auth user ${uid} already exists.`);
  } catch {
    console.log(`[pin-login] Auth user ${uid} not found, creating...`);
    await adminAuth.createUser({ uid, displayName: displayName || uid });
    console.log(`[pin-login] Auth user ${uid} created.`);
  }
}

export async function POST(req: Request) {
  try {
    const { id, pin } = await req.json().catch(() => ({}));
    console.log(`[pin-login] Attempting login for user id: ${id}`);

    if (!id || !pin) {
      console.error('[pin-login] Missing user ID or PIN in request.');
      return NextResponse.json({ error: 'Missing user ID or PIN' }, { status: 400 });
    }

    const userRef = adminDb.collection('users').doc(id);
    const secretRef = adminDb.collection('user_secrets').doc(id);
    
    console.log(`[pin-login] Fetching docs: users/${id} and user_secrets/${id}`);
    const [userSnap, secretSnap] = await Promise.all([userRef.get(), secretRef.get()]);

    if (!userSnap.exists) {
      console.warn(`[pin-login] User document not found for id: ${id}`);
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    const user = userSnap.data()!;
    console.log(`[pin-login] Found user: ${user.name}, active: ${user.active}`);

    if (!user.active) {
      console.warn(`[pin-login] User account is inactive for id: ${id}`);
      return NextResponse.json({ error: 'User account is inactive' }, { status: 403 });
    }
    
    if (!secretSnap.exists) {
        console.warn(`[pin-login] Secret document not found for id: ${id}`);
        return NextResponse.json({ error: 'PIN not set for user' }, { status: 401 });
    }
    const secret = secretSnap.data()!;

    if (!secret.pinHash) {
        console.warn(`[pin-login] 'pinHash' field missing in secret document for id: ${id}`);
        return NextResponse.json({ error: 'PIN not set for user' }, { status: 401 });
    }
    console.log(`[pin-login] Found pinHash for user ${id}. Comparing with provided PIN.`);

    const ok = await bcrypt.compare(pin, secret.pinHash);
    if (!ok) {
      console.warn(`[pin-login] Invalid PIN for user id: ${id}`);
      return NextResponse.json({ error: 'Invalid PIN' }, { status: 401 });
    }
    
    console.log(`[pin-login] PIN verified for ${id}. Ensuring Auth user and creating token.`);
    await ensureAuthUser(id, user.name);

    const role = user.role || 'cashier';
    await adminAuth.setCustomUserClaims(id, { role });
    const token = await adminAuth.createCustomToken(id, { role });
    console.log(`[pin-login] Token created successfully for ${id} with role ${role}.`);

    return NextResponse.json({ token, role, uid: id });
  } catch (e: any) {
    console.error('[pin-login] Internal server error:', e);
    return NextResponse.json({ error: 'Internal server error', details: e.message }, { status: 500 });
  }
}
