
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const uid = searchParams.get('uid');

    if (!uid) {
      return NextResponse.json({ 
        ok: true, 
        message: "Provide a 'uid' query parameter to check a specific user. Example: /api/diag/user?uid=admin" 
      });
    }
    
    const userDoc = await adminDb.collection('users').doc(uid).get();
    const secretDoc = await adminDb.collection('user_secrets').doc(uid).get();

    const user = userDoc.exists ? userDoc.data() : null;
    const secret = secretDoc.exists ? secretDoc.data() : null;

    const pinHash = (secret as any)?.pinHash;

    return NextResponse.json({
      ok: true,
      uid: uid,
      checks: {
        userProfileFound: userDoc.exists,
        userIsActive: !!user?.active,
        userSecretFound: secretDoc.exists,
        pinHashIsSet: !!pinHash && typeof pinHash === 'string' && pinHash.length > 20,
      },
      userData: user,
      secretData: secret ? { hasPinHash: !!pinHash } : null,
    });

  } catch (e: any) {
    console.error(`[diag/user] Error`, e);
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}
