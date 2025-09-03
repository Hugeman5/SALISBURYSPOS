'use strict';
import { onCall } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';

// A more robust function to handle various menu entities.
export const adminUpsertMenuEntities = onCall(async (req) => {
  const ctx = req.auth;
  if (!ctx) throw new Error('UNAUTH');
  const role = (ctx.token as { role?: string })?.role;
  if (!['admin', 'manager'].includes(role ?? '')) throw new Error('FORBIDDEN');
  
  const { entity, data } = req.data;
  if (!entity || !data) throw new Error('BAD_REQUEST');
  
  const db = getFirestore();
  const now = new Date().toISOString();

  const getCollectionName = (entityType: string) => {
      switch(entityType) {
          case 'menu': return 'menus';
          case 'screen': return 'menu_screens';
          case 'button': return 'menu_buttons';
          case 'item': return 'items';
          case 'modifier_group': return 'modifier_groups';
          case 'combo': return 'combos';
          default: throw new Error('INVALID_ENTITY_TYPE');
      }
  }

  const collectionName = getCollectionName(entity);
  const id = data.id || db.collection(collectionName).doc().id;

  const docData = {
      ...data,
      id, // ensure id is written to the document
      updatedAt: now,
      createdAt: data.createdAt || now,
  };
  
  // Basic validation example
  if (entity === 'modifier_group' && data.min > data.max) {
      throw new Error('MIN_EXCEEDS_MAX');
  }

  await db.doc(`${collectionName}/${id}`).set(docData, { merge: true });
  return { ok: true, id };
});
