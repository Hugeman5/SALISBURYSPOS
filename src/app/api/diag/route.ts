
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const snap = await adminDb.collection('users').limit(1).get();
    return NextResponse.json({ 
        ok: true, 
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        usersCountHint: snap.size 
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}
