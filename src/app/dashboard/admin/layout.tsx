
'use client';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
  SidebarFooter,
} from '@/components/ui/sidebar';
import {
  Users,
  Package,
  LayoutGrid,
  Receipt,
  BarChart3,
  DollarSign,
  Clock,
  Home,
  ShoppingCart,
} from 'lucide-react';
import { usePathname } from 'next/navigation';
import { LogoutButton } from '@/components/auth/logout-button';
import { useAuth } from '@/stores/auth-store';
import Link from 'next/link';
import { RoleGate } from '@/components/auth-gate';

const menuItems = [
  { href: '/dashboard/admin', title: 'Dashboard', icon: Home, roles: ['admin', 'manager'] },
  { href: '/pos/sale', title: 'Point of Sale', icon: ShoppingCart, roles: ['admin', 'manager', 'cashier', 'waiter', 'kitchen'] },
  { href: '/dashboard/admin/orders', title: 'Orders', icon: Receipt, roles: ['admin', 'manager'] },
  { href: '/dashboard/admin/products', title: 'Products', icon: Package, roles: ['admin', 'manager'] },
  { href: '/dashboard/admin/inventory', title: 'Inventory', icon: LayoutGrid, roles: ['admin', 'manager'] },
  {
    href: '/dashboard/admin/cash-register',
    title: 'Cash Register',
    icon: DollarSign,
    roles: ['admin', 'manager', 'cashier'],
  },
  { href: '/dashboard/admin/users', title: 'Users & Roles', icon: Users, roles: ['admin', 'manager'] },
  { href: '/dashboard/admin/reports', title: 'Reports', icon: BarChart3, roles: ['admin', 'manager'] },
  { href: '/dashboard/admin/timeclock', title: 'Time Clock', icon: Clock, roles: ['admin', 'manager', 'cashier', 'waiter', 'kitchen'] },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { profile, role } = useAuth();

  const accessibleMenuItems = menuItems.filter(item => role && item.roles.includes(role));

  return (
    <RoleGate allow={['admin', 'manager', 'cashier', 'waiter', 'kitchen']}>
      <SidebarProvider>
        <Sidebar>
          <SidebarHeader>
            <div className="flex items-center gap-2 p-2">
              <SidebarTrigger />
              <h1 className="text-xl font-semibold">ZA-POS</h1>
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarMenu>
              {accessibleMenuItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.href}
                    tooltip={item.title}
                  >
                    <Link href={item.href}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarContent>
          <SidebarFooter className="p-4 flex-col gap-4">
            <div className="text-sm">
              <p className="font-semibold">{profile?.name}</p>
              <p className="text-muted-foreground capitalize">{profile?.role}</p>
            </div>
            <LogoutButton />
          </SidebarFooter>
        </Sidebar>
        <SidebarInset>{children}</SidebarInset>
      </SidebarProvider>
    </RoleGate>
  );
}
