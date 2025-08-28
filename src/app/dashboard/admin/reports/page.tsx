
'use client';
import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, orderBy, where, Timestamp } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { fmtZAR } from '@/utils/money';

type Row = { date: string; total: number; count: number };

export default function ReportsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { (async () => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoTimestamp = Timestamp.fromDate(thirtyDaysAgo);

    const q = query(
      collection(db, 'orders'), 
      where('createdAt', '>=', thirtyDaysAgoTimestamp),
      orderBy('createdAt','desc')
    );
    
    const snap = await getDocs(q);
    const byDate = new Map<string, { total:number; count:number }>();
    
    snap.forEach(d => {
      const o = d.data() as any;
      if (!o.createdAt?.toDate) return;
      const ts = o.createdAt.toDate();
      const key = ts.toISOString().slice(0,10); // YYYY-MM-DD
      const cur = byDate.get(key) ?? { total: 0, count: 0 };
      byDate.set(key, { total: cur.total + Number(o.totals.totalInc || 0), count: cur.count + 1 });
    });
    
    const list = Array.from(byDate.entries())
      .sort((a,b)=>a[0]<b[0]?1:-1)
      .map(([date, v]) => ({ date, total: v.total, count: v.count }));
      
    setRows(list);
    setLoading(false);
  })(); }, []);

  if (loading) return (
    <div className="p-6">
      <div className="animate-pulse">
        <div className="h-8 bg-muted rounded w-1/3 mb-4"></div>
        <div className="space-y-2">
          <div className="h-10 bg-muted rounded w-full"></div>
          <div className="h-10 bg-muted rounded w-full"></div>
          <div className="h-10 bg-muted rounded w-full"></div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-6 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Daily Sales Report</CardTitle>
          <CardDescription>Showing aggregated sales data for the last 30 days.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Orders</TableHead>
                <TableHead className="text-right">Total Sales</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(r => (
                <TableRow key={r.date}>
                  <TableCell className="font-medium">{r.date}</TableCell>
                  <TableCell className="text-right">{r.count}</TableCell>
                  <TableCell className="text-right font-mono">{fmtZAR(r.total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
