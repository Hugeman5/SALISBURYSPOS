import './globals.css';
import type { Metadata } from 'next';
import { Toaster } from '@/components/ui/toaster';


export const metadata: Metadata = { title: 'Salisburys POS', description: 'Back Office & POS' };


export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-neutral-50 text-slate-900 antialiased">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
