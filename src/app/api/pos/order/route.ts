export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import type { Product } from '@/types/pos';

// Basic input validation
function validateRequest(data: any) {
    if (!data.clientRequestId || !data.status || !data.registerId || !data.cashierId || !Array.isArray(data.items)) {
        return 'Missing required fields.';
    }
    if (data.status === 'final' && !data.payment) {
        return 'Payment is required to finalize an order.';
    }
    return null;
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const validationError = validateRequest(body);
        if (validationError) {
            return NextResponse.json({ error: validationError }, { status: 400 });
        }

        const { clientRequestId, status, registerId, cashierId, items: clientItems, payment } = body;

        // Idempotency check
        const idempotencyRef = adminDb.collection('idempotency_keys').doc(clientRequestId);
        const idempotencySnap = await idempotencyRef.get();
        if (idempotencySnap.exists) {
            return NextResponse.json(idempotencySnap.data(), { status: 200 });
        }

        const productIds = clientItems.map((item: any) => item.productId);
        if (productIds.length === 0) {
            return NextResponse.json({ error: 'Order must contain at least one item.' }, { status: 400 });
        }
        
        const productRefs = productIds.map((id: string) => adminDb.collection('products').doc(id));
        const productSnaps = await adminDb.getAll(...productRefs);
        
        const products = new Map<string, Product>();
        for (const doc of productSnaps) {
            if (doc.exists) {
                products.set(doc.id, { id: doc.id, ...doc.data() } as Product);
            }
        }

        let subtotal = 0;
        const orderItems: any[] = [];

        for (const clientItem of clientItems) {
            const product = products.get(clientItem.productId);
            if (!product) {
                return NextResponse.json({ error: `Product with ID ${clientItem.productId} not found.` }, { status: 400 });
            }
            if (status === 'final' && product.stockQty < clientItem.qty) {
                return NextResponse.json({ error: `Insufficient stock for ${product.name}. Available: ${product.stockQty}, Requested: ${clientItem.qty}` }, { status: 409 });
            }
            
            const unitPrice = product.price;
            const lineDiscount = clientItem.lineDiscount || 0;
            const lineTotal = (unitPrice * clientItem.qty) - lineDiscount;
            subtotal += lineTotal;
            
            orderItems.push({
                productId: product.id,
                name: product.name,
                sku: product.sku,
                unitPrice,
                qty: clientItem.qty,
                lineDiscount,
                lineTotal,
            });
        }
        
        const tax = Math.round(subtotal * (0.15 / 1.15)); // Assuming price is inclusive of VAT
        const total = subtotal;

        let orderNumber = 'S-000001';
        const counterRef = adminDb.collection('counters').doc('orders');

        const orderRef = adminDb.collection('orders').doc();

        await adminDb.runTransaction(async (transaction) => {
            const counterDoc = await transaction.get(counterRef);
            let nextNumber = 1;
            if (counterDoc.exists) {
                nextNumber = (counterDoc.data()?.lastNumber || 0) + 1;
            }
            orderNumber = `S-${String(nextNumber).padStart(6, '0')}`;
            transaction.set(counterRef, { lastNumber: nextNumber });

            const orderPayload: any = {
                number: orderNumber,
                status,
                registerId,
                cashierId,
                subtotal,
                tax,
                total,
                lineCount: orderItems.length,
                createdAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
            };
            
            if (status === 'final' && payment) {
                orderPayload.amountTendered = payment.amountTendered;
                orderPayload.changeDue = payment.amountTendered - total;
            }

            transaction.set(orderRef, orderPayload);

            for (const item of orderItems) {
                const itemRef = orderRef.collection('items').doc(item.productId);
                transaction.set(itemRef, item);
                
                if (status === 'final') {
                    const productRef = adminDb.collection('products').doc(item.productId);
                    transaction.update(productRef, {
                        stockQty: FieldValue.increment(-item.qty)
                    });
                }
            }
        });

        const result = { orderId: orderRef.id, number: orderNumber, total };
        await idempotencyRef.set(result);

        return NextResponse.json(result, { status: 201 });

    } catch (error: any) {
        console.error('Error creating order:', error);
        return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
    }
}
