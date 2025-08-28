export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

export async function POST(req: Request) {
  try {
    const { id, pin } = await req.json().catch(() => ({}));
    if (!id || !pin) {
      return NextResponse.json({ error: 'Missing id or pin' }, { status: 400 });
    }

    const doc = await adminDb.collection('users').doc(id).get();
    if (!doc.exists) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const u = doc.data() as any;
    if (!u.active) return NextResponse.json({ error: 'User inactive' }, { status: 403 });
    if (String(u.pin) !== String(pin)) return NextResponse.json({ error: 'Invalid PIN' }, { status: 401 });

    // Mint a custom token; uid ties to your doc id
    const uid = `pos:${id}`;
    const token = await adminAuth.createCustomToken(uid, { role: u.role || 'cashier' });
    return NextResponse.json({ token, role: u.role || 'cashier' });
  } catch (e: any) {
    console.error('pin-login error:', e?.stack || e);
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 });
  }
}
