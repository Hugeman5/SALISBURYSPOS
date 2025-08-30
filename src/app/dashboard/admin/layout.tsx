
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
} from 'lucide-react';
import { usePathname } from 'next/navigation';
import { LogoutButton } from '@/components/auth/logout-button';
import { useAuth } from '@/stores/auth-store';
import Link from 'next/link';
import { RoleGate } from '@/components/auth-gate';

const menuItems = [
  { href: '/dashboard/admin', title: 'Dashboard', icon: Home },
  { href: '/dashboard/admin/orders', title: 'Orders', icon: Receipt },
  { href: '/dashboard/admin/products', title: 'Products', icon: Package },
  { href: '/dashboard/admin/inventory', title: 'Inventory', icon: LayoutGrid },
  {
    href: '/dashboard/admin/cash-register',
    title: 'Cash Register',
    icon: DollarSign,
  },
  { href: '/dashboard/admin/users', title: 'Users & Roles', icon: Users },
  { href: '/dashboard/admin/reports', title: 'Reports', icon: BarChart3 },
  { href: '/dashboard/admin/timeclock', title: 'Time Clock', icon: Clock },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const profile = useAuth((s) => s.profile);

  return (
    <RoleGate allow={['admin', 'manager']}>
      <SidebarProvider>
        <Sidebar>
          <SidebarHeader>
            <div className="flex items-center gap-2 p-2">
              <SidebarTrigger />
              <h1 className="text-xl font-semibold">Sals POS</h1>
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarMenu>
              {menuItems.map((item) => (
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
