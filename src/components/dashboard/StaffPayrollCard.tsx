
'use client';

import * as React from 'react';
import { db } from '@/lib/firebase';
import { useAuth } from '@/stores/auth-store';
import {
  collectionGroup, query, where, getDocs, doc, getDoc,
} from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { User } from '@/types';
import { fmtZAR } from '@/utils/money';

type Punch = {
  uid: string;
  inAt: Date;
  outAt?: Date | null;
  durationSec?: number | null;
};

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
      // 1) Get all open punches (clocked-in staff)
      const openSnap = await getDocs(query(
        collectionGroup(db, 'sessions'),
        where('outAt', '==', null),
      ));
      const openPunches: Punch[] = openSnap.docs.map((d) => ({ ...d.data(), uid: d.ref.parent.parent!.id } as Punch));
      setOpenCount(openPunches.length);
      
      const uids = Array.from(new Set(openPunches.map((p) => p.uid)));

      // 2) Fetch user details for hourly rates
      const userRates = new Map<string, number>();
      if (uids.length > 0) {
        const usersSnap = await getDocs(query(collection(db, 'users'), where('__name__', 'in', uids)));
        usersSnap.forEach(doc => {
            const userData = doc.data() as User;
            userRates.set(doc.id, userData.hourlyRateCents || 0);
        });
      }
      
      // 3) Calculate live burn rate
      const liveBurn = openPunches.reduce((acc, p) => acc + (userRates.get(p.uid) || 0), 0);
      setLiveBurnPerHour(liveBurn);

      // 4) Calculate today's total spend
      const todaySnap = await getDocs(query(
        collectionGroup(db, 'sessions'),
        where('inAt', '>=', startOfToday()),
        where('inAt', '<', endOfToday()),
      ));

      const now = Date.now();
      let totalSpend = 0;
      todaySnap.forEach(d => {
        const punch = d.data() as Punch;
        const rate = userRates.get(punch.uid) || 0;
        if (rate > 0) {
            const durSec = punch.outAt
              ? (punch.durationSec || Math.max(0, Math.round((punch.outAt.getTime() - punch.inAt.getTime()) / 1000)))
              : Math.max(0, Math.round((now - punch.inAt.getTime()) / 1000));
            totalSpend += (durSec / 3600) * rate;
        }
      });
      setTodaySpend(totalSpend);

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
                <CardTitle className="text-2xl">{fmtZAR(liveBurnPerHour)} / hr</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
                <CardDescription>Today’s spend</CardDescription>
                <CardTitle className="text-2xl">{fmtZAR(todaySpend)}</CardTitle>
            </CardHeader>
          </Card>
        </div>
      </CardContent>
    </Card>
  );
}
