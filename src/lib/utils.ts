import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { POSProduct } from '../types/catalog';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function fmtZAR(cents: number) {
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' })
    .format((cents || 0) / 100);
}

export function getPriceCents(p: POSProduct): number {
  if (typeof p.effPriceCents === 'number') return p.effPriceCents;
  if (typeof p.priceCents === 'number') return p.priceCents;
  return 0;
}
