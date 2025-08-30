
'use client';

import React from 'react';
import { useAuth } from '@/stores/auth-store';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { format } from 'date-fns';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { fmtZAR } from '@/utils/money';
import { call } from '@/lib/functions/call';

type Punch = {
  id: string;
  inAt: Date;
  outAt?: Date | null;
  durationSec?: number | null;
  costCents?: number | null;
};

export default function TimeClockPage() {
  const { role, profile } = useAuth();
  const { toast } = useToast();

  const uid = profile?.id || '';
  
  const [loading, setLoading] = React.useState(false);
  const [isIn, setIsIn] = React.useState<boolean>(false);
  const [punches, setPunches] = React.useState<Punch[]>([]);
  const [initialLoading, setInitialLoading] = React.useState(true);

  const refreshState = React.useCallback(async () => {
    if (!uid) return;
    const q = query(
      collection(db, `time_clock/${uid}/sessions`),
      where('outAt', '==', null),
      orderBy('inAt', 'desc'),
      limit(1),
    );
    const snap = await getDocs(q);
    setIsIn(!snap.empty);
  }, [uid]);

  const loadToday = React.useCallback(async () => {
    if (!uid) return;
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(24, 0, 0, 0);
    
    const q = query(
      collection(db, `time_clock/${uid}/sessions`),
      where('inAt', '>=', start),
      where('inAt', '<', end),
      orderBy('inAt', 'desc'),
      limit(20),
    );
    const snap = await getDocs(q);
    const rows: Punch[] = snap.docs.map(doc => {
      const x: any = doc.data();
      return {
        id: doc.id,
        inAt: x.inAt?.toDate?.() || new Date(),
        outAt: x.outAt?.toDate?.() || null,
        durationSec: x.durationSec ?? null,
        costCents: x.costCents ?? null,
      };
    });
    setPunches(rows);
  }, [uid]);

  const doClockIn = async () => {
    setLoading(true);
    try {
      const res = await call<any, any>('clockIn', {});
      if (res?.ok) {
        await refreshState();
        await loadToday();
        toast({ title: res.already ? "Already clocked in." : "Clocked in successfully." });
      } else {
        toast({ variant: 'destructive', title: "Clock-in failed", description: res.error });
      }
    } catch (e: any) {
      toast({ variant: 'destructive', title: "Error", description: e?.message || String(e) });
    } finally {
      setLoading(false);
    }
  };

  const doClockOut = async () => {
    setLoading(true);
    try {
      const res = await call<any, any>('clockOut', {});
      if (res?.ok) {
        await refreshState();
        await loadToday();
        toast({ title: "Clocked out successfully." });
      } else {
        toast({ variant: 'destructive', title: "Clock-out failed", description: res.error });
      }
    } catch (e: any) {
      toast({ variant: 'destructive', title: "Error", description: e?.message || String(e) });
    } finally {
      setLoading(false);
    }
  };

  const exportCsv = async () => {
    setLoading(true);
    try {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date();
      end.setHours(24, 0, 0, 0);
      const res = await call<any, any>('adminExportTimeCsv', { startMs: start.getTime(), endMs: end.getTime() });
      if (res?.ok && res.csv) {
        const blob = new Blob([res.csv], { type: 'text/csv;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = res.filename || `time_${format(start, 'yyyy-MM-dd')}.csv`;
        a.click();
        URL.revokeObjectURL(a.href);
        toast({ title: "CSV downloaded." });
      } else {
        toast({ variant: 'destructive', title: "Export failed", description: res.error });
      }
    } catch (e: any) {
      toast({ variant: 'destructive', title: "Error", description: e?.message || String(e) });
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    setInitialLoading(true);
    refreshState().then(loadToday).catch(console.error).finally(() => setInitialLoading(false));
  }, [uid, refreshState, loadToday]);

  const canExport = role === 'admin' || role === 'manager';

  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Time Clock</CardTitle>
          <CardDescription>Clock in and out for your shift.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3 items-end mb-6">
            <Button
              className="bg-green-600 hover:bg-green-700"
              disabled={loading || isIn === true}
              onClick={doClockIn}
            >
              {loading && !isIn && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Clock In
            </Button>
            <Button
              variant="destructive"
              disabled={loading || isIn === false}
              onClick={doClockOut}
            >
              {loading && isIn && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Clock Out
            </Button>
            {canExport && (
              <Button
                variant="secondary"
                onClick={exportCsv}
                disabled={loading}
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Export Today (CSV)
              </Button>
            )}
          </div>
          
          <Card>
            <CardHeader>
                <CardTitle>Today's Shifts</CardTitle>
            </CardHeader>
            <CardContent>
              {initialLoading ? (
                <p>Loading punches...</p>
              ) : punches.length === 0 ? (
                <p className="text-muted-foreground">No shifts recorded for today.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>In</TableHead>
                      <TableHead>Out</TableHead>
                      <TableHead>Hours</TableHead>
                      <TableHead className="text-right">Cost</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {punches.map(p => (
                      <TableRow key={p.id}>
                        <TableCell>{format(p.inAt, "HH:mm")}</TableCell>
                        <TableCell>{p.outAt ? format(p.outAt, "HH:mm") : "-"}</TableCell>
                        <TableCell>{p.outAt ? ((p.durationSec || 0)/3600).toFixed(2) : "-"}</TableCell>
                        <TableCell className="text-right">{p.outAt ? fmtZAR(p.costCents || 0) : "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

        </CardContent>
      </Card>
    </div>
  );
}
