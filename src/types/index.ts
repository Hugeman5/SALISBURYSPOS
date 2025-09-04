import { POSProduct } from './catalog';

export interface Product extends POSProduct {
  nameLower: string;
  skuUpper: string;
  price: number;
  createdAt: any; // Replace 'any' with a more specific type if possible
  updatedAt: any; // Replace 'any' with a more specific type if possible
  active: boolean;
  costCents?: number;
  categoryId?: string;
  taxRate?: number;
  plu?: string;
}

export type Category = {
  id: string;
  name: string;
  active: boolean;
  order: number;
};
