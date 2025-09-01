
import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/server/firebaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const db = getAdminDb();
    const usersSnap = await db.collection('users').where('active','==',true).orderBy('name').get();
    const secretsSnap = await db.collection('user_secrets').get();

    const usersWithPins = new Set();
    secretsSnap.forEach(doc => {
        if (doc.data()?.pinHash) {
            usersWithPins.add(doc.id);
        }
    });
    
    const results: Array<{id:string; name:string; role:string}> = [];

    for (const doc of usersSnap.docs) {
      if (usersWithPins.has(doc.id)) {
        const data = doc.data();
        results.push({ id: doc.id, name: data.name, role: data.role });
      }
    }

    return NextResponse.json({ ok: true, users: results });
  } catch (e:any) {
    console.error('loginable-users error:', e);
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}
