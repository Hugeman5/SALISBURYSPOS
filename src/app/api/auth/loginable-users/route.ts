
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function GET() {
  try {
    const usersSnap = await adminDb.collection('users').where('active','==',true).orderBy('name').get();
    
    const results: Array<{id:string; name:string; role:string}> = [];

    for (const doc of usersSnap.docs) {
      const data = doc.data();
      // A user is loginable if they have a pinHash set.
      if (data.pinHash) {
        results.push({ id: doc.id, name: data.name, role: data.role });
      }
    }

    return NextResponse.json({ ok: true, users: results });
  } catch (e:any) {
    console.error('loginable-users error:', e);
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}
