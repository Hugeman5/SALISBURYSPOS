
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const uid = searchParams.get('uid');

    if (!uid) {
        const snap = await adminDb.collection('users').limit(1).get();
        return NextResponse.json({ ok: true, usersCountHint: snap.size });
    }
    
    const userDoc = await adminDb.collection('users').doc(uid).get();
    const secretDoc = await adminDb.collection('userSecrets').doc(uid).get();

    const user = userDoc.exists ? userDoc.data() : null;
    const secret = secretDoc.exists ? secretDoc.data() : null;

    return NextResponse.json({
      ok: true,
      uid: uid,
      userExists: userDoc.exists,
      secretExists: secretDoc.exists,
      active: user?.active ?? null,
      hasPin: !!(secret && (secret as any).pinHash),
      role: user?.role ?? null,
    });

  } catch (e: any) {
    console.error('diag fail:', e);
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}
