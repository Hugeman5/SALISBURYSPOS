
'use client';

import React from 'react';
import { db } from '@/lib/firebase';
import { collection, doc, getDoc } from 'firebase/firestore';
import { useAuth } from '@/stores/auth-store';
import { format } from 'date-fns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { fmtZAR } from '@/utils/money';
import Link from 'next/link';
import { call } from '@/lib/functions/call';

type ZTotals = {
  countPaid: number;
  gross: number;
  vat: number;
  net: number;
  cash: number;
  card: number;
  other: number;
  discounts: number;
  returns: number;
};

export default function ReportsPage() {
  const role = useAuth((s) => s.role);
  const { toast } = useToast();
  const [date, setDate] = React.useState<string>(() => format(new Date(), 'yyyy-MM-dd'));
  const [loading, setLoading] = React.useState(false);
  const [totals, setTotals] = React.useState<ZTotals | null>(null);
  const [message, setMessage] = React.useState<string>('');

  const loadExisting = React.useCallback(async () => {
    setLoading(true);
    setMessage('');
    setTotals(null);
    try {
      const ref = doc(collection(db, 'z_closures'), date);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const d: any = snap.data();
        setTotals(d.totals || null);
      } else {
        setMessage('No Z-Report exists for this date.');
      }
    } catch (e: any) {
      setMessage(e.message || 'Failed to load report');
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
      setLoading(false);
    }
  }, [date, toast]);

  async function closeDay() {
    setLoading(true); setMessage('');
    try {
      const res = await call<any, any>('adminCloseDay', { date });
      if (res?.ok) {
        setTotals(res.totals);
        setMessage('Z-Report generated successfully.');
        toast({ title: 'Success', description: 'Day-end report has been generated.' });
      } else {
        const error = res?.error || 'Failed to close day';
        setMessage(error);
        toast({ variant: 'destructive', title: 'Error', description: error });
      }
    } catch (e: any) {
      setMessage(e?.message || String(e));
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
      setLoading(false);
    }
  }

  async function exportCsv() {
    setLoading(true); setMessage('');
    try {
      const res = await call<any, any>('adminExportZCsv', { date });
      if (res?.ok && res.csv) {
        const blob = new Blob([res.csv], { type: 'text/csv;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = res.filename || `z_${date}.csv`;
        a.click();
        URL.revokeObjectURL(a.href);
        setMessage('CSV downloaded.');
      } else {
        const error = res?.error || 'Export failed';
        setMessage(error);
        toast({ variant: 'destructive', title: 'Error', description: error });
      }
    } catch (e: any) {
      setMessage(e?.message || String(e));
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => { loadExisting(); }, [date, loadExisting]);

  const canClose = role === 'admin' || role === 'manager';

  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Daily Sales Reports (Z)</CardTitle>
          <CardDescription>Generate and view end-of-day sales summaries.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3 mb-6">
            <div className="space-y-1">
              <label htmlFor="report-date" className="text-sm font-medium">
                Report Date (SA)
              </label>
              <Input
                id="report-date"
                type="date"
                className="w-auto"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <Button
              onClick={loadExisting}
              disabled={loading}
            >
              Refresh
            </Button>
            {canClose && (
              <Button
                onClick={closeDay}
                disabled={!canClose || loading}
                variant="destructive"
                title={canClose ? 'Generate a new end-of-day report' : 'Only admin/manager can close the day'}
              >
                Close Day (Generate Z-Report)
              </Button>
            )}
            <Button
              onClick={exportCsv}
              disabled={loading || !totals}
              variant="secondary"
            >
              Export CSV
            </Button>
             <Button asChild variant="outline">
                <Link href="/dashboard/admin/cash-register">Cash Register</Link>
            </Button>
          </div>

          {message && <div className="text-sm text-muted-foreground p-4 border rounded-md bg-muted/50">{message}</div>}

          {totals ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {[
                ["Paid Orders", totals.countPaid],
                ["Gross Sales", fmtZAR(totals.gross)],
                ["VAT (15%)", fmtZAR(totals.vat)],
                ["Net Sales", fmtZAR(totals.net)],
                ["Cash Payments", fmtZAR(totals.cash)],
                ["Card Payments", fmtZAR(totals.card)],
                ["Other Payments", fmtZAR(totals.other)],
                ["Discounts", fmtZAR(totals.discounts)],
                ["Returns", fmtZAR(totals.returns)],
              ].map(([label, value]) => (
                <Card key={String(label)}>
                    <CardHeader>
                        <CardDescription>{String(label)}</CardDescription>
                        <CardTitle className="text-2xl">{String(value)}</CardTitle>
                    </CardHeader>
                </Card>
              ))}
            </div>
          ) : !loading && (
            <div className="text-center text-muted-foreground py-10">
                No report generated for the selected date.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
