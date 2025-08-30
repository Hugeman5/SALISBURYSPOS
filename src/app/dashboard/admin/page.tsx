
'use client';
import { RoleGate } from '@/components/auth-gate';
import { useAuth } from '@/stores/auth-store';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Users, Package, Clock, Utensils, LayoutGrid, Receipt, ChefHat, Book, Settings, BarChart3, DollarSign } from 'lucide-react';
import StaffPayrollCard from '@/components/dashboard/StaffPayrollCard';

const cards = [
  { href: '/dashboard/admin/users', title: 'Users & Roles', desc: 'Manage staff, roles & PINs', icon: Users },
  { href: '/dashboard/admin/products', title: 'Products', desc: 'Manage products and prices', icon: Package },
  { href: '/dashboard/admin/inventory', title: 'Inventory', desc: 'Track stock levels', icon: LayoutGrid },
  { href: '/dashboard/admin/orders', title: 'Orders', desc: 'View tickets, payments, totals', icon: Receipt },
  { href: '/dashboard/admin/reports', title: 'Reports', desc: 'Daily sales and analytics', icon: BarChart3 },
  { href: '/dashboard/admin/cash-register', title: 'Cash Register', desc: 'Manage cash drawer and floats', icon: DollarSign },
  { href: '/dashboard/admin/timeclock', title: 'Time Clock', desc: 'Clock in/out & shifts', icon: Clock },
  { href: '/dashboard/admin/menu', title: 'Menu & Recipes', desc: 'Recipes, costs, prices (VAT 15%)', icon: Utensils, disabled: true },
  { href: '/dashboard/admin/tables', title: 'Table Plan', desc: 'Floorplan & table states', icon: LayoutGrid, disabled: true },
  { href: '/dashboard/admin/kds', title: 'Kitchen Display', desc: 'Bumps & routes', icon: ChefHat, disabled: true },
  { href: '/dashboard/admin/accounting', title: 'Accounting', desc: 'Exports, VAT, day-end', icon: Book, disabled: true },
  { href: '/dashboard/admin/settings', title: 'Settings', desc: 'Business, VAT, printers', icon: Settings, disabled: true }
];

export default function AdminHome() {
  const profile = useAuth(s => s.profile);
  return (
    <main className="p-6">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <p className="text-muted-foreground">Welcome, {profile?.name}</p>
        </div>
      </div>
      
      <div className="mb-6">
        <StaffPayrollCard />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Management Areas</CardTitle>
          <CardDescription>Select a section to manage.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {cards.map(c => {
              const cardContent = (
                <Card className={`hover:bg-muted/50 transition-colors h-full ${c.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
                  <CardHeader className="flex flex-row items-center gap-4">
                    <c.icon className="w-8 h-8 text-primary" />
                    <div>
                      <CardTitle>{c.title}</CardTitle>
                      <CardDescription>{c.desc}</CardDescription>
                    </div>
                  </CardHeader>
                </Card>
              );

              return c.disabled ? (
                <div key={c.href} aria-disabled="true">
                  {cardContent}
                </div>
              ) : (
                <Link href={c.href} key={c.href}>
                  {cardContent}
                </Link>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
