
import {onCall} from "firebase-functions/v2/https";
import {getFirestore} from "firebase-admin/firestore";

type Entity = "category" | "item" | "modifier_group";
interface Payload {
  entity: Entity;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapModifierItem = (x: any) => ({
  id: x.id || `${Date.now()}_${Math.random()}`,
  name: x.name,
  priceDeltaCents: Math.round(x.priceDeltaCents || 0),
  active: x.active ?? true,
});

export const adminUpsertMenu = onCall<Payload>(async (req)=>{
  const ctx = req.auth;
  if (!ctx) throw new Error("UNAUTH");

  const role = (ctx.token as {role?: string})?.role;
  if (!["admin", "manager"].includes(role ?? "")) throw new Error("FORBIDDEN");

  const {entity, data} = req.data;
  if (!entity || !data) throw new Error("BAD_REQUEST");
  const db = getFirestore();
  const now = new Date().toISOString();

  if (entity === "category") {
    const id = data.id || db.collection("menu_categories").doc().id;
    await db.doc(`menu_categories/${id}`).set({
      id, name: data.name, color: data.color || null,
      order: data.order ?? 0, active: data.active ?? true,
      createdAt: data.createdAt || now, updatedAt: now,
    }, {merge: true});
    return {ok: true, id};
  }

  if (entity === "item") {
    const id = data.id || db.collection("menu_items").doc().id;
    await db.doc(`menu_items/${id}`).set({
      id, name: data.name, sku: data.sku || null, plu: data.plu || null,
      categoryId: data.categoryId,
      priceCents: Math.round(data.priceCents||0),
      taxRate: data.taxRate ?? 15, active: data.active ?? true,
      imageUrl: data.imageUrl || null, tags: data.tags || [],
      modifierGroupIds: data.modifierGroupIds || [],
      availability: data.availability || null,
      createdAt: data.createdAt || now, updatedAt: now,
    }, {merge: true});
    return {ok: true, id};
  }

  if (entity === "modifier_group") {
    const id = data.id || db.collection("modifier_groups").doc().id;
    const items = (data.items || []).map(mapModifierItem);
    await db.doc(`modifier_groups/${id}`).set({
      id, name: data.name, min: data.min ?? 0, max: data.max ?? 0,
      items, active: data.active ?? true,
      createdAt: data.createdAt || now, updatedAt: now,
    }, {merge: true});
    return {ok: true, id};
  }

  throw new Error("BAD_ENTITY");
});
