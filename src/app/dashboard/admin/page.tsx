'use client';
import { RoleGate } from '@/components/auth-gate';
import { useAuth } from '@/stores/auth-store';

const cards = [
  { href: '/dashboard/admin/users', title: 'Users & Roles', desc: 'Manage staff, roles & PINs' },
  { href: '/dashboard/admin/products', title: 'Products', desc: 'Manage products and prices' },
  { href: '/dashboard/admin/timeclock', title: 'Time Clock', desc: 'Clock in/out & shifts' },
  { href: '/dashboard/admin/menu', title: 'Menu & Recipes', desc: 'Recipes, costs, prices (VAT 15%)' },
  { href: '/dashboard/admin/tables', title: 'Table Plan', desc: 'Floorplan & table states' },
  { href: '/dashboard/admin/orders', title: 'Orders', desc: 'Tickets, payments, ZAR totals' },
  { href: '/dashboard/admin/kds', title: 'Kitchen Display', desc: 'Bumps & routes' },
  { href: '/dashboard/admin/accounting', title: 'Accounting', desc: 'Exports, VAT, day-end' },
  { href: '/dashboard/admin/settings', title: 'Settings', desc: 'Business, VAT, printers' }
];

export default function AdminHome() {
  const profile = useAuth(s => s.profile);
  return (
    <RoleGate allow={['admin','manager']}>
      <main style={{ padding:24 }}>
        <h1>Admin Dashboard</h1>
        <p>Welcome, {profile?.name}</p>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))', gap:16 }}>
          {cards.map(c => (
            <a key={c.href} href={c.href} style={{ padding:16, border:'1px solid #ddd', borderRadius:12, textDecoration:'none', color:'inherit' }}>
              <div style={{ fontSize:18, fontWeight:700 }}>{c.title}</div>
              <div style={{ color:'#666' }}>{c.desc}</div>
            </a>
          ))}
        </div>
      </main>
    </RoleGate>
  );
}
