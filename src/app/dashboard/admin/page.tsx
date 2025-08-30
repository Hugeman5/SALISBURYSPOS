
'use client';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import StaffPayrollCard from '@/components/dashboard/StaffPayrollCard';

export default function AdminHome() {
  return (
    <main className="p-6">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <p className="text-muted-foreground">Welcome</p>
        </div>
      </div>
      
      <div className="mb-6">
        <StaffPayrollCard />
      </div>

    </main>
  );
}
