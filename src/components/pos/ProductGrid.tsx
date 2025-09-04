'use client';

import { useMemo } from 'react';
import { Card, CardHeader, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { POSProduct } from '@/types/catalog';

function fmtZAR(cents: number) {
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' })
    .format((cents || 0) / 100);
}

function getPriceCents(p: POSProduct): number {
  if (typeof p.effPriceCents === 'number') return p.effPriceCents;
  if (typeof p.priceCents === 'number') return p.priceCents;
  return 0;
}

export default function ProductGrid({
  products,
  onProductClick,
  loading = false,
}: {
  products: POSProduct[];
  onProductClick: (p: POSProduct) => void;
  loading?: boolean;
}) {
  const list = useMemo(() => products ?? [], [products]);

  if (loading) {
    return (
      <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-28 rounded border bg-neutral-50 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
      {list.map((product) => {
        const price = getPriceCents(product);
        const outOfStock =
          !!product.trackStock && (product.stockOnHand ?? 0) <= 0;

        return (
          <Card key={product.id} className="relative h-28 flex flex-col border hover:shadow-sm">
            {outOfStock && (
              <Badge variant="destructive" className="absolute top-2 right-2">
                Out
              </Badge>
            )}

            <CardHeader className="p-3 pb-1">
              <div className="text-xs text-slate-600">
                {product.sku || product.plu || '\u00A0'}
              </div>
              <div className="font-semibold truncate">{product.name}</div>
            </CardHeader>

            <CardFooter className="p-3 pt-0 mt-auto flex justify-between items-center">
              <span className="font-semibold">{fmtZAR(price)}</span>
              <Button size="sm" variant="outline" onClick={() => onProductClick(product)}>
                Add
              </Button>
            </CardFooter>
          </Card>
        );
      })}
    </div>
  );
}
