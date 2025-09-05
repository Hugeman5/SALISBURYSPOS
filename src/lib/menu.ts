
import { Item } from '@/types';
import { PriceRule, MenuAvailability } from '@/types/menu-floor';

export function effectivePrice(
    item: Item,
    rules: PriceRule[],
    context: { now: Date, locationId: string, insideOf?: {itemId:string, modifierGroupId:string}[] }
): number {

    const applicable = rules.filter(r => {
        if (!r.active) return false;
        if (r.locationIds && r.locationIds.length > 0 && !r.locationIds.includes(context.locationId)) return false;

        const itemMatch = r.itemIds?.includes(item.id) || r.categoryIds?.includes(item.categoryId || '');
        if (!itemMatch) return false;

        if (r.schedule) {
            const day = context.now.getDay();
            const time = context.now.toTimeString().slice(0, 5);
            const dayMatch = r.schedule.days.length === 0 || r.schedule.days.includes(day);
            if (!dayMatch) return false;
            const timeMatch = (!r.schedule.startTime || time >= r.schedule.startTime) && (!r.schedule.endTime || time <= r.schedule.endTime);
            if (!timeMatch) return false;
        }
        return true;
    });
    if (!applicable.length) return item.price.incCents;

    const bestPrice = applicable.reduce((acc, rule) => {
        if (!rule.priceCents) return acc;
        return Math.min(acc, rule.priceCents);
    }, item.price.incCents);

    return bestPrice;
}

export function isMenuAvailable(
    menuId: string,
    availability: MenuAvailability[],
    context: { day: number, time: string, deviceId?: string, locationId?: string }
): boolean {

    const applicable = availability.filter(a => {
        if (!a.active) return false;
        if (a.menuId !== menuId) return false;
        return true;
    });
    if (!applicable.length) return true;

    const now = new Date();
    const time = now.toTimeString().slice(0, 5);

    return applicable.some(a => {
        if (a.days && a.days.length > 0 && !a.days.includes(context.day)) return false;
        if (a.timeRanges && a.timeRanges.length > 0) {
            const inRange = a.timeRanges.some(r => {
                const afterStart = !r.startTime || time >= r.startTime;
                const beforeEnd = !r.endTime || time <= r.endTime;
                return afterStart && beforeEnd;
            });
            if (!inRange) return false;
        }
        if (a.deviceIds && a.deviceIds.length > 0 && context.deviceId && !a.deviceIds.includes(context.deviceId)) return false;
        if (a.locationIds && a.locationIds.length > 0 && context.locationId && !a.locationIds.includes(context.locationId)) return false;
        return true;
    });
}
