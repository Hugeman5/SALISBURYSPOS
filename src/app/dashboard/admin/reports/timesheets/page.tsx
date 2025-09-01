'use client';
import { useState } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { format, subDays } from 'date-fns';


export default function Timesheets(){
  const { toast } = useToast();
  const [start, setStart] = useState(format(subDays(new Date(), 7), 'yyyy-MM-dd\'T\'HH:mm'));
  const [end, setEnd] = useState(format(new Date(), 'yyyy-MM-dd\'T\'HH:mm'));
  const [locationId, setLocationId] = useState('');
  const [loading, setLoading] = useState(false);
  const fn = httpsCallable(getFunctions(app), 'adminExportTimeCsv');

  const handleDateChange = (setter: (val: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const localDate = e.target.value;
    const isoString = new Date(localDate).toISOString();
    setter(isoString);
  };
  
  const getLocalDate = (iso: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    return format(d, "yyyy-MM-dd'T'HH:mm");
  };

  async function run(){
    setLoading(true);
    try {
        const r: any = await fn({ start, end, locationId: locationId || undefined });
        if(r.data.ok) {
            const blob = new Blob([r.data.csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = r.data.filename; a.click();
            URL.revokeObjectURL(url);
            toast({ title: 'Export successful', description: 'CSV file has been downloaded.' });
        } else {
            throw new Error(r.data.error || "Failed to generate CSV.");
        }
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Export Failed', description: e.message });
    } finally {
        setLoading(false);
    }
  }

  return (
    <div className="p-6">
        <Card>
            <CardHeader>
                <CardTitle>Timesheets Export</CardTitle>
                <CardDescription>Export staff timesheets between a date range as a CSV file.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 gap-4 max-w-sm">
                    <div className="space-y-2">
                        <label htmlFor='start'>Start (ISO)</label>
                        <Input id="start" type="datetime-local" value={getLocalDate(start)} onChange={handleDateChange(setStart)}/>
                    </div>
                    <div className="space-y-2">
                        <label htmlFor='end'>End (ISO)</label>
                        <Input id="end" type="datetime-local" value={getLocalDate(end)} onChange={handleDateChange(setEnd)}/>
                    </div>
                    <div className="space-y-2">
                        <label htmlFor='location'>Location (optional)</label>
                        <Input id="location" value={locationId} onChange={e=>setLocationId(e.target.value)}/>
                    </div>
                    <Button onClick={run} disabled={loading}>
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                        Export CSV
                    </Button>
                </div>
            </CardContent>
        </Card>
    </div>
  );
}
