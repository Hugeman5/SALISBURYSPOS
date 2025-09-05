
import { useEffect, useMemo, useState } from 'react';
import { app } from '@/lib/firebase';
import {
  getFirestore, collection, onSnapshot, query, where, orderBy, DocumentData
} from 'firebase/firestore';
import type { Menu, MenuButton, MenuScreen, Item } from '@/types/menu-floor';
import { effectivePrice, isMenuAvailable } from '@/lib/menu';

export type LiveMenuContext = {
  deviceId: string;
  locationId: string;
  now?: Date; // for testing or time travel
};

export type LiveMenuData = {
  loading: boolean;
  error?: string;
  menu?: Menu;
  screens: MenuScreen[];
  buttons: MenuButton[];
  categories: { id: string; name: string; order: number; active: boolean; parentId?: string|null }[];
  items: (Item & { effPriceCents: number })[];
  itemsByCategory: Record<string, (Item & { effPriceCents: number })[]>; // key = categoryId or 'uncat'
};

export function useLiveMenu(ctx: LiveMenuContext): LiveMenuData {
  const db = getFirestore(app);
  const [menus, setMenus] = useState<Menu[]>([]);
  const [screens, setScreens] = useState<MenuScreen[]>([]);
  const [buttons, setButtons] = useState<MenuButton[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [rules, setRules] = useState<any[]>([]);
  const [availability, setAvailability] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);

  // Streams
  useEffect(() => {
    setLoading(true);
    const unsubs: (() => void)[] = [];
    try {
      unsubs.push(onSnapshot(query(collection(db, 'menus'), where('active', '==', true), orderBy('order', 'asc')), s => {
        setMenus(s.docs.map(d => ({ id:d.id, ...(d.data() as any) })));
      }));
      unsubs.push(onSnapshot(collection(db, 'menu_availability'), s => setAvailability(s.docs.map(d => ({ id:d.id, ...(d.data() as any) })))));
      unsubs.push(onSnapshot(collection(db, 'price_rules'), s => setRules(s.docs.map(d => ({ id:d.id, ...(d.data() as any) })))));
      unsubs.push(onSnapshot(query(collection(db, 'categories'), where('active', '==', true), orderBy('order', 'asc')), s => setCategories(s.docs.map(d => ({ id: d.id, ...(d.data() as DocumentData) })))));
      unsubs.push(onSnapshot(query(collection(db, 'items'), where('active', '==', true)), s => setItems(s.docs.map(d => ({ id:d.id, ...(d.data() as any) })))))    
    } catch (e: any) {
      setError(e?.message || String(e));
    }
    return () => { unsubs.forEach(u => u()); };
  }, [db]);

  // Pick the active Menu for this device/location/time
  const menu: Menu | undefined = useMemo(() => {
    if (menus.length === 0) return undefined;
    const day = (ctx.now ?? new Date()).getDay();
    const time = (ctx.now ?? new Date()).toTimeString().slice(0, 5);
    const availForMenu = (mId: string) => isMenuAvailable(mId, availability as any, { day, time, deviceId: ctx.deviceId, locationId: ctx.locationId });

    const candidates = menus.filter(m => {
      const deviceOk = !m.deviceIds || m.deviceIds.length === 0 || m.deviceIds.includes(ctx.deviceId);
      const availOk = availForMenu(m.id);
      return deviceOk && availOk && m.active !== false;
    });
    if (candidates.length === 0) return menus[0];

    const defaults = candidates.filter(m => (m as any).default === true);
    return (defaults[0] ?? candidates[0]);
  }, [menus, availability, ctx.deviceId, ctx.locationId, ctx.now]);

  // Stream screens/buttons for the chosen menu
  useEffect(() => {
    const unsubs: (() => void)[] = [];
    setScreens([]); setButtons([]);
    if (!menu) { setLoading(false); return () => {}; }

    unsubs.push(onSnapshot(query(collection(db, 'menu_screens'), where('menuId', '==', menu.id), orderBy('order', 'asc')), s => {
      setScreens(s.docs.map(d => ({ id:d.id, ...(d.data() as any) })));
    }));
    unsubs.push(onSnapshot(query(collection(db, 'menu_buttons'), where('menuId', '==', menu.id), orderBy('order', 'asc')), s => {
      setButtons(s.docs.map(d => ({ id:d.id, ...(d.data() as any) })));
      setLoading(false);
    }));
    return () => { unsubs.forEach(u => u()); };
  }, [db, menu?.id]);

  // Apply effective prices
  const itemsWithPrice = useMemo(() => {
    const now = ctx.now ?? new Date();
    return items.map((it) => ({ ...it, effPriceCents: effectivePrice(it, rules, { now, locationId: ctx.locationId }) }));
  }, [items, rules, ctx.locationId, ctx.now]);

  // Group by category
  const itemsByCategory = useMemo(() => {
    const map: Record<string, (Item & { effPriceCents: number })[]> = {};
    for (const it of itemsWithPrice) {
      const key = (it as any).categoryId || 'uncat';
      (map[key] ??= []).push(it);
    }
    // stable sort by name inside each
    Object.values(map).forEach(arr => arr.sort((a, b) => (a.name || '').localeCompare(b.name || '')));
    return map;
  }, [itemsWithPrice]);

  return { loading, error, menu, screens, buttons, categories, items: itemsWithPrice, itemsByCategory };
}
