'use client';
import { useState, useEffect, useMemo } from 'react';
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/stores/auth-store';
import { RoleGate } from '@/components/auth-gate';
import type { Product } from '@/types';
import type { CartLineItem } from '@/types/pos';
import { ProductGrid } from '@/components/pos/ProductGrid';
import { CartPanel } from '@/components/pos/CartPanel';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

export default function SalePage() {
  const profile = useAuth(s => s.profile);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<CartLineItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const q = query(
          collection(db, 'products'),
          where('trackStock', '==', true), // Only show items we can sell
          orderBy('name'),
          limit(100)
        );
        const snapshot = await getDocs(q);
        const productsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
        setProducts(productsData);
      } catch (error) {
        console.error("Error fetching products:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, []);

  const handleAddToCart = (product: Product) => {
    setCart(prevCart => {
      const existingItem = prevCart.find(item => item.productId === product.id);
      if (existingItem) {
        return prevCart.map(item =>
          item.productId === product.id
            ? { ...item, qty: item.qty + 1 }
            : item
        );
      } else {
        return [
          ...prevCart,
          {
            productId: product.id,
            name: product.name,
            qty: 1,
            priceInclCents: product.price.incCents,
            vatRate: product.price.taxRate,
            stockOnHand: product.stockOnHand ?? 0,
          },
        ];
      }
    });
  };

  const filteredProducts = useMemo(() => {
    if (!searchTerm) {
      return products;
    }
    return products.filter(p =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [products, searchTerm]);

  if (!profile) return null; // RoleGate will handle redirect

  return (
    <RoleGate allow={['admin', 'manager', 'cashier']}>
      <div className="flex h-screen bg-muted/40">
        <div className="flex flex-col w-3/5 p-4 space-y-4">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search products by name or SKU..."
              className="pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <ProductGrid products={filteredProducts} onAddToCart={handleAddToCart} loading={loading} />
        </div>
        <div className="w-2/5 border-l bg-background">
          <CartPanel cart={cart} setCart={setCart} cashierId={profile.id} />
        </div>
      </div>
    </RoleGate>
  );
}
