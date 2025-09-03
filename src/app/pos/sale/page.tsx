
'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/stores/auth-store';
import { RoleGate } from '@/components/auth-gate';
import type { Product, Category } from '@/types';
import { useCartStore } from '@/stores/cart-store';
import { ProductGrid } from '@/components/pos/ProductGrid';
import { CartPanel } from '@/components/pos/CartPanel';
import { Input } from '@/components/ui/input';
import { Search, ChevronLeft } from 'lucide-react';
import { LogoutButton } from '@/components/auth/logout-button';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useDebounce } from '@/hooks/use-debounce';

export default function SalePage() {
  const profile = useAuth((s) => s.profile);
  const { addToCart } = useCartStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 250);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    
    const catQuery = query(collection(db, 'menu_categories'), orderBy('order'));
    const prodQuery = query(
      collection(db, 'menu_items'),
      where('active', '==', true),
      orderBy('name')
    );

    const unsubCategories = onSnapshot(catQuery, (catSnap) => {
      const categoriesData = catSnap.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() } as Category)
      );
      setCategories([{ id: 'all', name: 'All Products', active: true, order: -1 }, ...categoriesData]);
      if (!activeCategoryId) {
        setActiveCategoryId('all');
      }
    });

    const unsubProducts = onSnapshot(prodQuery, (prodSnap) => {
      const productsData = prodSnap.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() } as Product)
      );
      setProducts(productsData);
      setLoading(false);
    });

    return () => {
      unsubCategories();
      unsubProducts();
    };
  }, [activeCategoryId]);

  const filteredProducts = useMemo(() => {
    let filtered = products;

    if (activeCategoryId && activeCategoryId !== 'all') {
      filtered = filtered.filter((p) => p.categoryId === activeCategoryId);
    }

    if (debouncedSearchTerm) {
      const lowercasedTerm = debouncedSearchTerm.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(lowercasedTerm) ||
          (p.sku || '').toLowerCase().includes(lowercasedTerm)
      );
    }

    return filtered;
  }, [products, debouncedSearchTerm, activeCategoryId]);

  if (!profile) return null; 

  return (
    <RoleGate allow={['admin', 'manager', 'cashier', 'waiter', 'kitchen']}>
      <div className="flex h-screen bg-muted/40">
        <div className="flex flex-col w-3/5 p-4 space-y-4">
          <header className="flex gap-2 items-center">
            <Link href="/dashboard/admin" passHref>
              <Button variant="outline" size="icon" asChild>
                <a><ChevronLeft className="h-4 w-4" /></a>
              </Button>
            </Link>
            <div className="relative flex-grow">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search products by name or SKU... (Ctrl+K)"
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <LogoutButton />
          </header>

          <div className="border-b">
            <div className="flex items-center gap-2 overflow-x-auto pb-2">
              {categories.map((cat) => (
                <Button
                  key={cat.id}
                  variant={activeCategoryId === cat.id ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setActiveCategoryId(cat.id)}
                  className="shrink-0"
                >
                  {cat.name}
                </Button>
              ))}
            </div>
          </div>

          <main className="flex-grow overflow-hidden">
            <ProductGrid
              products={filteredProducts}
              onAddToCart={addToCart}
              loading={loading}
            />
          </main>
        </div>
        <aside className="w-2/5 border-l bg-background">
          <CartPanel cashierId={profile.id} cashierName={profile.name} />
        </aside>
      </div>
    </RoleGate>
  );
}
