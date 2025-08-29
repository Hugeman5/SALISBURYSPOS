
'use client';
import { useEffect, useState, useCallback } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { fmtZAR } from '@/utils/money';
import { format, startOfDay, endOfDay } from 'date-fns';
import { Calendar as CalendarIcon, Download } from 'lucide-react';
import { cn } from '@/lib/utils';

type SalesSummary = {
  ordersCount: number;
  grossTotalIncl: number;
  subTotalExcl: number;
  vatTotal: number;
  paymentsByMethod: {
    cash: number;
    card: number;
  };
  avgOrderValue: number;
};

export default function ReportsPage() {
  const [summary, setSummary] = useState<SalesSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState<Date>(new Date());
  const [error, setError] = useState<string | null>(null);

  const functions = getFunctions();
  const getSalesSummary = httpsCallable(functions, 'getSalesSummary');
  const adminExportOrders = httpsCallable(functions, 'adminExportOrders');

  const loadSummary = useCallback(async (selectedDate: Date) => {
    setLoading(true);
    setError(null);
    try {
      const fromISO = startOfDay(selectedDate).toISOString();
      const toISO = endOfDay(selectedDate).toISOString();
      const result = await getSalesSummary({ fromISO, toISO });
      setSummary(result.data as SalesSummary);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to load sales summary.');
    } finally {
      setLoading(false);
    }
  }, [getSalesSummary]);

  useEffect(() => {
    loadSummary(date);
  }, [date, loadSummary]);
  
  const handleExport = async () => {
    try {
        const fromISO = startOfDay(date).toISOString();
        const toISO = endOfDay(date).toISOString();
        const result: any = await adminExportOrders({ fromISO, toISO });

        const { filename, mime, dataBase64 } = result.data;
        const byteCharacters = atob(dataBase64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: mime });

        const link = document.createElement('a');
        link.href = window.URL.createObjectURL(blob);
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (err: any) {
        console.error(err);
        setError(err.message || 'Failed to export orders.');
    }
  };


  return (
    <div className="p-6 space-y-4">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle>Daily Sales Report</CardTitle>
              <CardDescription>Review sales performance for a selected day.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
                <Popover>
                    <PopoverTrigger asChild>
                    <Button
                        variant={"outline"}
                        className={cn(
                        "w-[280px] justify-start text-left font-normal",
                        !date && "text-muted-foreground"
                        )}
                    >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {date ? format(date, "PPP") : <span>Pick a date</span>}
                    </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                    <Calendar
                        mode="single"
                        selected={date}
                        onSelect={(d) => setDate(d || new Date())}
                        initialFocus
                    />
                    </PopoverContent>
                </Popover>
                <Button onClick={handleExport} variant="outline">
                    <Download className="mr-2 h-4 w-4" />
                    Export CSV
                </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
             <div className="space-y-4 animate-pulse">
                <div className="h-8 bg-muted rounded w-1/4"></div>
                <div className="h-24 bg-muted rounded w-full"></div>
                <div className="h-16 bg-muted rounded w-full"></div>
            </div>
          ) : error ? (
            <div className="text-destructive text-center py-10">{error}</div>
          ) : !summary || summary.ordersCount === 0 ? (
             <div className="text-center text-muted-foreground py-10">No sales recorded for this date.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardHeader><CardTitle>Totals</CardTitle></CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            <div className="flex justify-between"><span>Gross Sales (inc VAT)</span> <span className="font-mono">{fmtZAR(summary.grossTotalIncl)}</span></div>
                            <div className="flex justify-between text-muted-foreground"><span>Net Sales (ex VAT)</span> <span className="font-mono">{fmtZAR(summary.subTotalExcl)}</span></div>
                            <div className="flex justify-between text-muted-foreground"><span>VAT (15%)</span> <span className="font-mono">{fmtZAR(summary.vatTotal)}</span></div>
                        </div>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader><CardTitle>Order Metrics</CardTitle></CardHeader>
                    <CardContent>
                         <div className="space-y-2">
                            <div className="flex justify-between"><span>Total Orders</span> <span className="font-mono">{summary.ordersCount}</span></div>
                            <div className="flex justify-between"><span>Avg. Order Value</span> <span className="font-mono">{fmtZAR(summary.avgOrderValue)}</span></div>
                        </div>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader><CardTitle>Payment Methods</CardTitle></CardHeader>
                    <CardContent>
                         <div className="space-y-2">
                            <div className="flex justify-between"><span>Cash</span> <span className="font-mono">{fmtZAR(summary.paymentsByMethod.cash)}</span></div>
                            <div className="flex justify-between"><span>Card</span> <span className="font-mono">{fmtZAR(summary.paymentsByMethod.card)}</span></div>
                        </div>
                    </CardContent>
                </Card>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
