export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(request: Request) {
    try {
        const { orderId, reason } = await request.json();

        if (!orderId) {
            return NextResponse.json({ error: 'Order ID is required.' }, { status: 400 });
        }

        const orderRef = adminDb.collection('orders').doc(orderId);
        
        await adminDb.runTransaction(async (transaction) => {
            const orderSnap = await transaction.get(orderRef);
            if (!orderSnap.exists) {
                throw new Error('Order not found.');
            }

            const orderData = orderSnap.data();
            if (orderData?.status !== 'final') {
                throw new Error('Only finalized orders can be voided.');
            }
            
            const itemsSnap = await transaction.get(orderRef.collection('items'));
            
            for (const itemDoc of itemsSnap.docs) {
                const itemData = itemDoc.data();
                const productRef = adminDb.collection('products').doc(itemData.productId);
                transaction.update(productRef, {
                    stockQty: FieldValue.increment(itemData.qty)
                });
            }
            
            transaction.update(orderRef, {
                status: 'void',
                updatedAt: FieldValue.serverTimestamp(),
                voidReason: reason || 'No reason specified',
            });
        });

        return NextResponse.json({ success: true, message: `Order ${orderId} has been voided.` });

    } catch (error: any) {
        console.error('Error voiding order:', error);
        return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
    }
}
