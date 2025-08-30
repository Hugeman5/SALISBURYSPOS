
'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/stores/auth-store';
import { RoleGate } from '@/components/auth-gate';
import type { Product, Category } from '@/types';
import { useCartStore } from '@/stores/cart-store';
import { ProductGrid } from '@/components/pos/ProductGrid';
import { CartPanel } from '@/components/pos/CartPanel';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { LogoutButton } from '@/components/auth/logout-button';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function SalePage() {
  const profile = useAuth((s) => s.profile);
  const { addToCart } = useCartStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const catQuery = query(collection(db, 'categories'), orderBy('name'));
      const prodQuery = query(
        collection(db, 'products'),
        where('active', '==', true),
        orderBy('nameLower')
      );

      const [catSnap, prodSnap] = await Promise.all([
        getDocs(catQuery),
        getDocs(prodQuery),
      ]);

      const categoriesData = catSnap.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() } as Category)
      );
      const productsData = prodSnap.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() } as Product)
      );

      setCategories(categoriesData);
      setProducts(productsData);
    } catch (error) {
      console.error('Error fetching products or categories:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredProducts = useMemo(() => {
    let filtered = products;

    if (activeCategoryId) {
      filtered = filtered.filter((p) => p.categoryId === activeCategoryId);
    }

    if (searchTerm) {
      const lowercasedTerm = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(lowercasedTerm) ||
          p.sku.toLowerCase().includes(lowercasedTerm)
      );
    }

    return filtered;
  }, [products, searchTerm, activeCategoryId]);

  if (!profile) return null; // RoleGate will handle redirect

  return (
    <RoleGate allow={['admin', 'manager', 'cashier']}>
      <div className="flex h-screen bg-muted/40">
        <div className="flex flex-col w-3/5 p-4 space-y-4">
          <header className="flex gap-2 items-center">
            <Link href="/dashboard/admin">
              <Button variant="outline" size="icon">
                <svg
                  className="h-4 w-4"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
              </Button>
            </Link>
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
            <LogoutButton />
          </header>

          <div className="border-b">
            <div className="flex items-center gap-2 overflow-x-auto pb-2">
              <Button
                variant={!activeCategoryId ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setActiveCategoryId(null)}
              >
                All Products
              </Button>
              {categories.map((cat) => (
                <Button
                  key={cat.id}
                  variant={activeCategoryId === cat.id ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setActiveCategoryId(cat.id)}
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
