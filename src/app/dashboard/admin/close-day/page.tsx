'use client';
import { useState } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

export default function CloseDayPage(){
  const { toast } = useToast();
  const [locationId, setLocationId] = useState('main');
  const [date, setDate] = useState(new Date().toISOString().slice(0,10));
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const fn = httpsCallable(getFunctions(app), 'adminCloseDay');

  async function run(){
    setLoading(true);
    setResult(null);
    try {
      const r: any = await fn({ locationId, date });
      setResult(r.data);
      toast({ title: "Z-Closure Generated", description: `Report ID: ${r.data.id}` });
    } catch (e:any) {
      toast({ variant: 'destructive', title: 'Operation Failed', description: e.message || 'An unknown error occurred' });
    } finally { setLoading(false); }
  }

  return (
    <div className="p-6">
       <Card>
        <CardHeader>
            <CardTitle>Close Day</CardTitle>
            <CardDescription>Aggregate all sessions for a date & location to generate a Z-Closure report.</CardDescription>
        </CardHeader>
        <CardContent>
             <div className="space-y-4 max-w-sm">
                <div className="space-y-2">
                    <label htmlFor="locationId" className="text-sm font-medium">Location ID</label>
                    <Input id="locationId" value={locationId} onChange={e=>setLocationId(e.target.value)}/>
                </div>
                 <div className="space-y-2">
                    <label htmlFor="date" className="text-sm font-medium">Date</label>
                    <Input id="date" type="date" value={date} onChange={e=>setDate(e.target.value)}/>
                </div>
                <Button disabled={loading} onClick={run}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                    {loading? 'Working…':'Generate Z-Closure'}
                </Button>
            </div>
            {result && (
                <div className="mt-6">
                    <h3 className="font-semibold">Result</h3>
                    <pre className="mt-2 bg-muted p-4 rounded text-sm overflow-auto">{JSON.stringify(result, null, 2)}</pre>
                </div>
            )}
        </CardContent>
       </Card>
    </div>
  );
}
