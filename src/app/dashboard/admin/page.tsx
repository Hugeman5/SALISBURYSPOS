
'use client';
import { RoleGate } from '@/components/auth-gate';
import { useAuth } from '@/stores/auth-store';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Users, Package, Clock, Utensils, LayoutGrid, Receipt, ChefHat, Book, Settings, BarChart3 } from 'lucide-react';
import { LogoutButton } from '@/components/auth/logout-button';

const cards = [
  { href: '/dashboard/admin/users', title: 'Users & Roles', desc: 'Manage staff, roles & PINs', icon: Users },
  { href: '/dashboard/admin/products', title: 'Products', desc: 'Manage products and prices', icon: Package },
  { href: '/dashboard/admin/inventory', title: 'Inventory', desc: 'Track stock levels', icon: LayoutGrid },
  { href: '/dashboard/admin/orders', title: 'Orders', desc: 'Tickets, payments, ZAR totals', icon: Receipt },
  { href: '/dashboard/admin/reports', title: 'Reports', desc: 'Daily sales and analytics', icon: BarChart3 },
  { href: '/dashboard/admin/timeclock', title: 'Time Clock', desc: 'Clock in/out & shifts', icon: Clock },
  { href: '/dashboard/admin/menu', title: 'Menu & Recipes', desc: 'Recipes, costs, prices (VAT 15%)', icon: Utensils },
  { href: '/dashboard/admin/tables', title: 'Table Plan', desc: 'Floorplan & table states', icon: LayoutGrid },
  { href: '/dashboard/admin/kds', title: 'Kitchen Display', desc: 'Bumps & routes', icon: ChefHat },
  { href: '/dashboard/admin/accounting', title: 'Accounting', desc: 'Exports, VAT, day-end', icon: Book },
  { href: '/dashboard/admin/settings', title: 'Settings', desc: 'Business, VAT, printers', icon: Settings }
];

export default function AdminHome() {
  const profile = useAuth(s => s.profile);
  return (
    <RoleGate allow={['admin','manager']}>
      <main className="p-6">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-3xl font-bold">Admin Dashboard</h1>
            <p className="text-muted-foreground">Welcome, {profile?.name}</p>
          </div>
          <LogoutButton />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {cards.map(c => (
             <Link href={c.href} key={c.href}>
              <Card className="hover:bg-muted/50 transition-colors h-full">
                <CardHeader className="flex flex-row items-center gap-4">
                  <c.icon className="w-8 h-8 text-primary" />
                  <div>
                    <CardTitle>{c.title}</CardTitle>
                    <CardDescription>{c.desc}</CardDescription>
                  </div>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </main>
    </RoleGate>
  );
}
