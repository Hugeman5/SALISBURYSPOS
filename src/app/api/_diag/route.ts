export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const { getAdmin } = await import('@/lib/firebase-admin');
    const { adminDb } = getAdmin();
    const snap = await adminDb.collection('users').limit(1).get();
    return NextResponse.json({ ok: true, usersCountHint: snap.size });
  } catch (e: any) {
    console.error('diag fail:', e);
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}
