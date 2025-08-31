
'use client';
import { redirect } from 'next/navigation';

export default function PosPage() {
  // This page is a guard; all POS roles are redirected here from login.
  // We then immediately redirect to the actual sale screen.
  // This structure allows for future expansion of the POS dashboard.
  redirect('/pos/sale');
}
