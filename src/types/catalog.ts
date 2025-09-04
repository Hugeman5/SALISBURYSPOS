export type POSProduct = {
  id: string;
  name: string;
  priceCents?: number;
  effPriceCents?: number;
  trackStock?: boolean;
  stockOnHand?: number | null;
  sku?: string;
  plu?: string;
};
