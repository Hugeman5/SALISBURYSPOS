import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { db, FieldValue } from './utils.js';
import { requireRole, ADMIN_ROLES } from './roles.js';

// This is a placeholder for a more robust CSV parser
const parseCsvSimple = (csv: string) => {
    const lines = csv.split('\n').filter(l => l.trim());
    const header = lines.shift()?.split(',') || [];
    return lines.map(line => {
        const values = line.split(',');
        return header.reduce((obj, nextKey, index) => {
            obj[nextKey.trim()] = values[index]?.trim();
            return obj;
        }, {} as Record<string, string>);
    });
};

export const adminUpsertMenu = onCall({ cors: true, region: 'us-central1' }, async (req) => {
    requireRole(req, ADMIN_ROLES);
    const { menu } = req.data;
    if (!menu || !menu.id) throw new HttpsError('invalid-argument', 'Menu with ID is required.');
    const ref = db.collection('menus').doc(menu.id);
    await ref.set({ ...menu, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return { ok: true };
});

export const adminUpsertMenuEntities = onCall({ cors: true, region: 'us-central1' }, async (req) => {
    requireRole(req, ADMIN_ROLES);
    const { screens, buttons } = req.data;
    const batch = db.batch();
    const now = FieldValue.serverTimestamp();

    if (screens) {
        screens.forEach((s: any) => {
            const ref = s.id ? db.collection('menu_screens').doc(s.id) : db.collection('menu_screens').doc();
            batch.set(ref, { ...s, id: ref.id, updatedAt: now }, { merge: true });
        });
    }
    if (buttons) {
        buttons.forEach((b: any) => {
            const ref = b.id ? db.collection('menu_buttons').doc(b.id) : db.collection('menu_buttons').doc();
            batch.set(ref, { ...b, id: ref.id, updatedAt: now }, { merge: true });
        });
    }
    await batch.commit();
    return { ok: true };
});

export const adminSetMenuAvailability = onCall({ cors: true, region: 'us-central1' }, async (req) => {
    requireRole(req, ADMIN_ROLES);
    const { menuId, rules } = req.data;
    if (!menuId || !Array.isArray(rules)) throw new HttpsError('invalid-argument', 'Menu ID and rules array are required.');
    
    // This replaces all rules for a given menu
    const batch = db.batch();
    const existingRulesSnap = await db.collection('menu_availability').where('menuId', '==', menuId).get();
    existingRulesSnap.docs.forEach(doc => batch.delete(doc.ref));

    rules.forEach(rule => {
        const ref = db.collection('menu_availability').doc();
        batch.set(ref, { ...rule, menuId, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
    });
    
    await batch.commit();
    return { ok: true };
});

export const adminImportMenuCsv = onCall({ cors: true, region: 'us-central1' }, async (req) => {
    requireRole(req, ADMIN_ROLES);
    const { csv } = req.data;
    if (!csv) throw new HttpsError('invalid-argument', 'CSV data is required.');
    // CSV logic would be complex here, involving mapping to screens, buttons, items etc.
    // This is a placeholder for that logic.
    console.log("Parsing CSV for menu import:", csv);
    return { ok: true, message: 'Import functionality not fully implemented.' };
});

export const adminExportMenuCsv = onCall({ cors: true, region: 'us-central1' }, async (req) => {
    requireRole(req, ADMIN_ROLES);
    // Logic to fetch all menu related data and format as CSV
    return { ok: true, filename: `menu-${Date.now()}.csv`, csv: "type,id,name\nitem,1,Coffee" };
});

export const adminUpsertPriceRules = onCall({ cors: true, region: 'us-central1' }, async (req) => {
    requireRole(req, ADMIN_ROLES);
    const { rules } = req.data;
    if (!Array.isArray(rules)) throw new HttpsError('invalid-argument', 'Rules must be an array.');
    
    const batch = db.batch();
    rules.forEach(rule => {
        const ref = rule.id ? db.collection('price_rules').doc(rule.id) : db.collection('price_rules').doc();
        batch.set(ref, { ...rule, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    });
    
    await batch.commit();
    return { ok: true };
});
