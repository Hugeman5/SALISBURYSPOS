
'use client';
import { useEffect, useState, useMemo } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot, limit, where } from 'firebase/firestore';
import { useAuth } from '@/stores/auth-store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { PlusCircle } from 'lucide-react';
import { fmtZAR } from '@/utils/money';
import { format } from 'date-fns';
import type { Register, RegisterSession, CashMovement } from '@/types';
import { OpenRegisterModal } from '@/components/admin/cash-register/OpenRegisterModal';
import { CashMovementModal } from '@/components/admin/cash-register/CashMovementModal';
import { call } from '@/lib/functions/call';
import { useToast } from '@/hooks/use-toast';

export default function CashRegisterPage() {
    const { profile } = useAuth();
    const { toast } = useToast();
    const [registers, setRegisters] = useState<Register[]>([]);
    const [sessions, setSessions] = useState<RegisterSession[]>([]);
    const [movements, setMovements] = useState<CashMovement[]>([]);
    const [loading, setLoading] = useState(true);
    
    const [openModal, setOpenModal] = useState(false);
    const [moveModal, setMoveModal] = useState<"payin" | "payout" | null>(null);

    const openSession = useMemo(() => sessions.find(s => s.status === 'open'), [sessions]);

    useEffect(() => {
        setLoading(true);
        // A real app might have a 'registers' collection, but for now we'll fake one for the modal.
        setRegisters([{ id: 'REG-1', name: 'Main Register', active: true }]);

        const qSessions = query(collection(db, 'register_sessions'), orderBy('openedAt', 'desc'), limit(10));
        const unsubSessions = onSnapshot(qSessions, (snap) => {
            setSessions(snap.docs.map(d => ({ id: d.id, ...d.data() } as RegisterSession)));
            setLoading(false);
        });
        
        return () => {
            unsubSessions();
        };
    }, []);

    useEffect(() => {
      let unsubMovements = () => {};
      if (openSession) {
        const qMovements = query(
          collection(db, `register_sessions/${openSession.id}/cash_movements`),
          orderBy('createdAt', 'desc')
        );
        unsubMovements = onSnapshot(qMovements, (snap) => {
          setMovements(snap.docs.map(d => ({ id: d.id, ...d.data() } as CashMovement)));
        });
      } else {
        setMovements([]);
      }
      return () => unsubMovements();
    }, [openSession]);
    
    const handleCloseSession = async () => {
        if (!openSession) return;
        const countedStr = prompt("Enter the final cash amount counted in the drawer (e.g., 1234.50):");
        if (countedStr === null) return; // User cancelled
        const counted = parseFloat(countedStr);
        if (isNaN(counted)) {
            toast({ variant: "destructive", title: "Invalid amount entered." });
            return;
        }
        try {
            const result = await call('manageRegisterSession', { action: 'close', sessionId: openSession.id, countedCash: counted * 100 });
            toast({ 
                title: "Register session closed",
                description: `Variance (Over/Short): ${fmtZAR(result.overShort)}`
            });
        } catch (error: any) {
            toast({ variant: "destructive", title: "Failed to close session", description: error.message });
        }
    };

    return (
        <div className="p-6 space-y-6">
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-start">
                        <div>
                            <CardTitle>Cash Register</CardTitle>
                            <CardDescription>Manage cash drawer sessions and movements.</CardDescription>
                        </div>
                        <div className="flex gap-2">
                           {openSession ? (
                                <>
                                    <Button variant="outline" onClick={() => setMoveModal('payin')}>Pay In</Button>
                                    <Button variant="outline" onClick={() => setMoveModal('payout')}>Pay Out</Button>
                                    <Button variant="destructive" onClick={handleCloseSession}>Close Session</Button>
                                </>
                           ) : (
                                <Button onClick={() => setOpenModal(true)}>
                                    <PlusCircle className="mr-2 h-4 w-4" />
                                    Open New Session
                                </Button>
                           )}
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {openSession && (
                         <Card className="mb-6 bg-green-900/20 border-green-700">
                            <CardHeader>
                                <CardTitle>Current Open Session</CardTitle>
                                <CardDescription>Opened by {openSession.openedBy.name} at {format(openSession.openedAt.toDate(), 'PPpp')}</CardDescription>
                            </CardHeader>
                            <CardContent className="grid md:grid-cols-3 gap-4">
                                <div>
                                    <p className="text-sm text-muted-foreground">Opening Float</p>
                                    <p className="text-lg font-bold">{fmtZAR(openSession.openingFloat)}</p>
                                </div>
                                 <div>
                                    <p className="text-sm text-muted-foreground">Expected in Drawer</p>
                                    <p className="text-lg font-bold">{fmtZAR(openSession.expectedCash)}</p>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                    
                    <div className="grid md:grid-cols-2 gap-6">
                        <Card>
                            <CardHeader><CardTitle>Recent Cash Movements</CardTitle></CardHeader>
                            <CardContent>
                                {movements.length > 0 ? (
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Time</TableHead>
                                                <TableHead>Type</TableHead>
                                                <TableHead className="text-right">Amount</TableHead>
                                                <TableHead>Reason</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {movements.map(m => (
                                                <TableRow key={m.id}>
                                                    <TableCell>{format(m.createdAt.toDate(), 'p')}</TableCell>
                                                    <TableCell><Badge variant={m.type === 'payin' ? 'default' : 'secondary'}>{m.type}</Badge></TableCell>
                                                    <TableCell className={`text-right font-mono ${m.amount > 0 ? 'text-green-500' : 'text-red-500'}`}>{fmtZAR(m.amount)}</TableCell>
                                                    <TableCell>{m.reason}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                ) : (
                                    <p className="text-muted-foreground text-center py-4">No movements in the current session.</p>
                                )}
                            </CardContent>
                        </Card>
                        <Card>
                             <CardHeader><CardTitle>Session History</CardTitle></CardHeader>
                             <CardContent>
                                {sessions.length > 0 ? (
                                     <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Date</TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead className="text-right">Variance</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {sessions.map(s => (
                                                 <TableRow key={s.id}>
                                                    <TableCell>{format(s.openedAt.toDate(), 'PP')}</TableCell>
                                                    <TableCell><Badge variant={s.status === 'open' ? 'default' : 'outline'}>{s.status}</Badge></TableCell>
                                                    <TableCell className="text-right font-mono">
                                                        {s.status === 'closed' ? fmtZAR(s.overShort ?? 0) : '—'}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                     </Table>
                                ) : (
                                    <p className="text-muted-foreground text-center py-4">No session history.</p>
                                )}
                             </CardContent>
                        </Card>
                    </div>
                </CardContent>
            </Card>
            <OpenRegisterModal 
                isOpen={openModal} 
                onClose={() => setOpenModal(false)}
                registers={registers}
                profile={profile}
            />
            {openSession && moveModal && (
                <CashMovementModal
                    type={moveModal}
                    session={openSession}
                    onClose={() => setMoveModal(null)}
                    profile={profile}
                />
            )}
        </div>
    );
}
