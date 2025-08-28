'use client';
import { Product } from '@/types/pos';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { fmtZAR } from '@/utils/money';

interface ProductGridProps {
  products: Product[];
  onAddToCart: (product: Product) => void;
  loading: boolean;
}

export function ProductGrid({ products, onAddToCart, loading }: ProductGridProps) {
  if (loading) {
    return (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {Array.from({ length: 10 }).map((_, i) => (
                <Card key={i} className="animate-pulse">
                    <CardContent className="p-4">
                        <div className="h-20 bg-muted rounded-md mb-2"></div>
                        <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                        <div className="h-4 bg-muted rounded w-1/2"></div>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
  }
  
  if (products.length === 0) {
    return <div className="text-center text-muted-foreground py-10">No products found.</div>
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 overflow-y-auto pr-2">
      {products.map((product) => (
        <Card
          key={product.id}
          onClick={() => onAddToCart(product)}
          className="cursor-pointer hover:border-primary transition-colors flex flex-col"
        >
          <CardHeader className="p-4 flex-grow">
            <CardTitle className="text-base leading-tight">{product.name}</CardTitle>
          </CardHeader>
          <CardFooter className="p-4 pt-0 flex justify-between items-center">
            <span className="font-semibold">{fmtZAR(product.price)}</span>
            <span className="text-xs text-muted-foreground">Stock: {product.stockQty}</span>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}
