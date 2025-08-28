export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function GET() {
  try {
    const snap = await adminDb.collection('users').limit(1).get();
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'Not Found';
    return NextResponse.json({ ok: true, usersCountHint: snap.size, projectId });
  } catch (e: any) {
    console.error('diag fail:', e);
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}
