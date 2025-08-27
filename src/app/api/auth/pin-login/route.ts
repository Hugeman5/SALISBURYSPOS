export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

type ReqBody = { id?: string; pin?: string };
const jerr = (status: number, msg: string) => NextResponse.json({ ok: false, error: msg }, { status });

export async function POST(req: Request) {
  try {
    const body: ReqBody = await req.json().catch(() => ({}));
    const { id, pin } = body;
    if (!id || !pin || pin.length !== 4) return jerr(400, 'Missing id or 4-digit pin');

    const { getAdmin } = await import('@/lib/firebase-admin');
    const { adminAuth, adminDb } = getAdmin();

    const ref = adminDb.collection('users').doc(String(id));
    const snap = await ref.get();
    if (!snap.exists) return jerr(404, 'User not found');

    const u = snap.data() as any;
    if (u?.active !== true) return jerr(403, 'User is inactive');
    if (typeof u.pin !== 'string') return jerr(500, 'PIN not set for user');
    if (u.pin !== pin) return jerr(401, 'Invalid PIN');

    const role = (u.role as string) || 'cashier';
    const token = await adminAuth.createCustomToken(ref.id, { role });
    return NextResponse.json({ ok: true, token, role });
  } catch (e: any) {
    const msg = e?.message || String(e);
    console.error('pin-login crash:', e);
    if (msg.includes('ADMIN_CREDENTIALS_MISSING')) return jerr(500, 'Admin credentials missing.');
    if (msg.includes('ENOENT') && msg.includes('serviceAccount.json')) return jerr(500, 'serviceAccount.json not found at path.');
    return jerr(500, msg);
  }
}
