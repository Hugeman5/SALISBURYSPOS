
'use client';

import * as React from 'react';
import { db } from '@/lib/firebase';
import { useAuth } from '@/stores/auth-store';
import {
  collectionGroup, query, where, getDocs, doc, getDoc,
} from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

type Punch = {
  id: string;
  uid: string;
  inAt: Date;
  outAt?: Date | null;
  durationSec?: number | null;
};

type UserSecret = { hourlyRateCents?: number | null };

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
function endOfToday(): Date {
  const d = new Date();
  d.setHours(24, 0, 0, 0);
  return d;
}
function formatZAR(cents: number) {
  try {
    return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format((cents || 0) / 100);
  } catch {
    return `R ${( (cents || 0) / 100).toFixed(2)}`;
  }
}

export default function StaffPayrollCard() {
  const role = useAuth((s) => s.role);
  const isBoss = role === 'admin' || role === 'manager';

  const [liveBurnPerHour, setLiveBurnPerHour] = React.useState(0);
  const [todaySpend, setTodaySpend] = React.useState(0);
  const [openCount, setOpenCount] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);

  const compute = React.useCallback(async () => {
    if (!isBoss) return;
    setErr(null);
    try {
      // 1) All open punches
      const openSnap = await getDocs(query(
        collectionGroup(db, 'sessions'),
        where('outAt', '==', null),
      ));
      const openRows: Punch[] = openSnap.docs.map((d) => {
        const x: any = d.data();
        return {
          id: d.id,
          uid: x.uid,
          inAt: x.inAt?.toDate?.() || new Date(),
          outAt: null,
          durationSec: null,
        };
      });
      setOpenCount(openRows.length);
      const uids = Array.from(new Set(openRows.map((r) => r.uid)));

      // 2) Fetch hourlyRate for each uid from userSecrets
      const rateByUid: Record<string, number> = {};
      await Promise.all(uids.map(async (u) => {
        try {
          const secretDoc = await getDoc(doc(db, 'userSecrets', u));
          const data = secretDoc.exists() ? (secretDoc.data() as UserSecret) : undefined;
          rateByUid[u] = Math.max(0, Number(data?.hourlyRateCents ?? 0));
        } catch {
          rateByUid[u] = 0;
        }
      }));

      // 3) Live burn per hour = sum(rate) for open shifts
      const live = openRows.reduce((acc, r) => acc + (rateByUid[r.uid] || 0), 0);
      setLiveBurnPerHour(live);

      // 4) Today’s spend (open + closed)
      const todaySnap = await getDocs(query(
        collectionGroup(db, 'sessions'),
        where('inAt', '>=', startOfToday()),
        where('inAt', '<', endOfToday()),
      ));
      
      const allToday: Punch[] = todaySnap.docs.map((d) => {
        const x: any = d.data();
        return {
          id: d.id,
          uid: x.uid,
          inAt: x.inAt?.toDate?.() || new Date(),
          outAt: x.outAt?.toDate?.() || null,
          durationSec: x.durationSec ?? null,
        };
      });

      const now = Date.now();
      let total = 0;
      for (const r of allToday) {
        const rate = rateByUid[r.uid] ?? 0;
        if (rate > 0) {
            const durSec = r.outAt
              ? (r.durationSec || Math.max(0, Math.round((r.outAt.getTime() - r.inAt.getTime()) / 1000)))
              : Math.max(0, Math.round((now - r.inAt.getTime()) / 1000));
            total += (durSec / 3600) * rate;
        }
      }
      setTodaySpend(total);

    } catch (e: any) {
        setErr(e.message || 'Failed to compute payroll data');
    } finally {
        setLoading(false);
    }
  }, [isBoss]);

  React.useEffect(() => {
    if (!isBoss) return;
    let active = true;
    const tick = async () => {
      if (!active) return;
      await compute();
    };
    tick(); // initial call
    const id = setInterval(tick, 15000); // refresh every 15s
    return () => { active = false; clearInterval(id); };
  }, [compute, isBoss]);

  if (!isBoss) return null;
  
  if (loading) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Staff Payroll (Live)</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Skeleton className="h-20" />
                <Skeleton className="h-20" />
                <Skeleton className="h-20" />
            </CardContent>
        </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
            <CardTitle>Staff Payroll (Live)</CardTitle>
            <div className="text-xs text-muted-foreground">{loading ? 'updating…' : 'live'}</div>
        </div>
        <CardDescription>
            Based on hourly rates and today’s time clock entries. Updates every 15s.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {err && <div className="text-xs text-destructive mb-2">Error: {err}</div>}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
                <CardDescription>Open shifts</CardDescription>
                <CardTitle className="text-2xl">{openCount}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
                <CardDescription>Live burn rate</CardDescription>
                <CardTitle className="text-2xl">{formatZAR(liveBurnPerHour)} / hr</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
                <CardDescription>Today’s spend</CardDescription>
                <CardTitle className="text-2xl">{formatZAR(todaySpend)}</CardTitle>
            </CardHeader>
          </Card>
        </div>
      </CardContent>
    </Card>
  );
}
