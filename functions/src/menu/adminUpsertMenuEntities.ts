
'use strict';
import { onCall } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';

export const adminUpsertMenuEntities = onCall(async (req) => {
  const ctx = req.auth;
  if (!ctx) throw new Error('UNAUTH');
  const role = (ctx.token as { role?: string })?.role;
  if (!['admin', 'manager'].includes(role ?? '')) throw new Error('FORBIDDEN');
  
  const { entity, data } = req.data;
  if (!entity || !data) throw new Error('BAD_REQUEST');
  const db = getFirestore();
  const now = new Date().toISOString();

  const upsert = async (collection: string, docData: any) => {
    const id = docData.id || db.collection(collection).doc().id;
    await db.doc(`${collection}/${id}`).set({
      ...docData,
      id,
      createdAt: docData.createdAt || now,
      updatedAt: now,
    }, { merge: true });
    return { ok: true, id };
  };

  switch (entity) {
    case 'category':
        return upsert('menu_categories', {
            name: data.name,
            color: data.color || null,
            order: data.order ?? 0,
            active: data.active ?? true,
        });
    case 'item':
      return upsert('items', {
        name: data.name,
        sku: data.sku || null,
        plu: data.plu || null,
        categoryId: data.categoryId,
        priceCents: Math.round(data.priceCents || 0),
        taxRate: data.taxRate ?? 15,
        active: data.active ?? true,
        imageUrl: data.imageUrl || null,
        tags: data.tags || [],
        modifierGroupIds: data.modifierGroupIds || [],
      });
    case 'modifier_group':
       const items = (data.items || []).map((x: any) => ({
        id: x.id || `${Date.now()}_${Math.random()}`,
        name: x.name,
        priceDeltaCents: Math.round(x.priceDeltaCents || 0),
        active: x.active ?? true,
      }));
      return upsert('modifier_groups', {
        name: data.name,
        min: data.min ?? 0,
        max: data.max ?? 1,
        items: items,
        active: data.active ?? true,
      });
    default:
      throw new Error('BAD_ENTITY');
  }
});
