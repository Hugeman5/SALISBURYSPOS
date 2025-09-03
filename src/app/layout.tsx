import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Toaster } from '@/components/ui/toaster';
import ClientBoot from '@/components/client-boot';


const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = { title: 'ZA-POS', description: 'Back Office & POS' };


export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-neutral-50 text-slate-900 antialiased`}>
        <ClientBoot />
        {children}
        <Toaster />
      </body>
    </html>
  );
}
