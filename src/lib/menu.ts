import { Item, PriceRule, MenuAvailability } from '@/app/lib/src/types/menu-floor';

// Helper function to check if a price rule applies to an item
export function priceRuleAppliesToItem(rule: PriceRule, item: Item): boolean {
  // Check if rule applies to specific items
  if (rule.appliesTo.itemIds && rule.appliesTo.itemIds.includes(item.id)) {
    return true;
  }
  
  // Check if rule applies to item's category
  if (rule.appliesTo.categoryIds && item.categoryId && rule.appliesTo.categoryIds.includes(item.categoryId)) {
    return true;
  }
  
  return false;
}

// Helper function to check if a price rule is currently active based on schedule
export function isPriceRuleActive(rule: PriceRule): boolean {
  if (!rule.schedule) return true;
  
  const now = new Date();
  const currentDay = now.getDay();
  const currentTime = now.toTimeString().slice(0, 5); // HH:MM format
  
  // Check if current day is in schedule
  if (rule.schedule.days && !rule.schedule.days.includes(currentDay)) {
    return false;
  }
  
  // Check time range if specified
  if (rule.schedule.from && rule.schedule.to) {
    return currentTime >= rule.schedule.from && currentTime <= rule.schedule.to;
  }
  
  return true;
}

// Helper function to calculate item price with price rules
export function calculateItemPrice(item: Item, priceRules: PriceRule[]): number {
  let price = item.priceCents;
  
  // Apply applicable price rules
  for (const rule of priceRules) {
    if (rule.active && priceRuleAppliesToItem(rule, item) && isPriceRuleActive(rule)) {
      switch (rule.type) {
        case 'percent_discount':
          price = Math.round(price * (1 - rule.value / 100));
          break;
        case 'percent_surcharge':
          price = Math.round(price * (1 + rule.value / 100));
          break;
        case 'absolute_adjust':
          price = Math.round(price + rule.value);
          break;
      }
    }
  }
  
  return Math.max(0, price); // Ensure price doesn't go negative
}

// Helper function to check if menu availability is active
export function isMenuAvailabilityActive(availability: MenuAvailability): boolean {
  if (!availability.schedule) return true;
  
  const now = new Date();
  const currentDay = now.getDay();
  const currentTime = now.toTimeString().slice(0, 5); // HH:MM format
  
  // Check if current day is in schedule
  if (availability.schedule.days && !availability.schedule.days.includes(currentDay)) {
    return false;
  }
  
  // Check time ranges if specified
  if (availability.schedule.from && availability.schedule.to) {
    return currentTime >= availability.schedule.from && currentTime <= availability.schedule.to;
  }
  
  return true;
}

// Helper function to check if menu is available for specific devices and locations
export function isMenuAvailableForContext(
  availability: MenuAvailability,
  deviceId?: string,
  locationId?: string
): boolean {
  if (!isMenuAvailabilityActive(availability)) {
    return false;
  }
  
  // Check device availability
  if (deviceId && availability.devices && !availability.devices.includes(deviceId)) {
    return false;
  }
  
  // Check location availability
  if (locationId && availability.locations && !availability.locations.includes(locationId)) {
    return false;
  }
  
  return true;
}
