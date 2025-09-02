import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import ClientBoot from '@/components/client-boot';

export const metadata: Metadata = {
  title: 'ZA-POS',
  description: 'A modern point-of-sale for South Africa',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="bg-neutral-50 text-slate-900 antialiased">
        <ClientBoot />
        {children}
        <Toaster />
      </body>
    </html>
  );
}
