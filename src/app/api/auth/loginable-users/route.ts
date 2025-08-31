
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function GET() {
  try {
    const usersSnap = await adminDb.collection('users').where('active','==',true).get();
    const results: Array<{id:string; name:string; role:string}> = [];

    const checks = usersSnap.docs.map(async d => {
      const id = d.id;
      const s = await adminDb.collection('user_secrets').doc(id).get();
      if (s.exists && s.data()?.pinHash) {
        const { name, role } = d.data() as any;
        results.push({ id, name, role });
      }
    });
    await Promise.all(checks);

    // Stable ordering
    results.sort((a,b) => a.name.localeCompare(b.name));
    return NextResponse.json({ ok: true, users: results });
  } catch (e:any) {
    console.error('loginable-users error:', e);
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}
