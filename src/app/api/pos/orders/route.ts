export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse, type NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { Order } from '@/types/pos';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const limitParam = searchParams.get('limit');
        const status = searchParams.get('status');
        
        const limit = limitParam ? parseInt(limitParam, 10) : 50;

        let query = adminDb.collection('orders').orderBy('createdAt', 'desc').limit(limit);
        
        if (status && ['draft', 'final', 'void'].includes(status)) {
            query = query.where('status', '==', status);
        }

        const snapshot = await query.get();

        const orders: Order[] = snapshot.docs.map(doc => ({
            id: doc.id,
            ...(doc.data() as Omit<Order, 'id'>)
        }));

        return NextResponse.json(orders);

    } catch (error: any) {
        console.error('Error fetching orders:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
