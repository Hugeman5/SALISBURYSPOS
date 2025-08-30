
'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/stores/auth-store';
import { RoleGate } from '@/components/auth-gate';
import type { Product } from '@/types';
import { useCartStore } from '@/stores/cart-store';
import { ProductGrid } from '@/components/pos/ProductGrid';
import { CartPanel } from '@/components/pos/CartPanel';
import { Input } from '@/components/ui/input';
import { Search, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { LogoutButton } from '@/components/auth/logout-button';

export default function SalePage() {
  const profile = useAuth(s => s.profile);
  const { cart, addToCart, clearCart } = useCartStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const q = query(
        collection(db, 'products'),
        where('active', '==', true),
        orderBy('nameLower'),
        limit(250)
      );
      const snapshot = await getDocs(q);
      const productsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
      setProducts(productsData);
    } catch (error) {
      console.error("Error fetching products:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const filteredProducts = useMemo(() => {
    if (!searchTerm) {
      return products;
    }
    const lowercasedTerm = searchTerm.toLowerCase();
    return products.filter(p =>
      p.name.toLowerCase().includes(lowercasedTerm) ||
      p.sku.toLowerCase().includes(lowercasedTerm)
    );
  }, [products, searchTerm]);

  if (!profile) return null; // RoleGate will handle redirect

  return (
    <RoleGate allow={['admin', 'manager', 'cashier']}>
      <div className="flex h-screen bg-muted/40">
        <div className="flex flex-col w-3/5 p-4 space-y-4">
          <header className="flex gap-2">
            <div className="relative flex-grow">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search products by name or SKU..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
             <Button asChild variant="outline" size="lg">
              <Link href="/dashboard/admin/cash-register">
                <DollarSign className="mr-2 h-4 w-4" />
                Cash Management
              </Link>
            </Button>
            <LogoutButton />
          </header>
          <main className="flex-grow overflow-hidden">
            <ProductGrid products={filteredProducts} onAddToCart={addToCart} loading={loading} />
          </main>
        </div>
        <aside className="w-2/5 border-l bg-background">
          <CartPanel cashierId={profile.id} cashierName={profile.name}/>
        </aside>
      </div>
    </RoleGate>
  );
}
