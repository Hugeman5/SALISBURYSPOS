'use client';
import { useEffect, useState, useCallback } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { signInWithCustomToken } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { db, auth } from '@/lib/firebase';
import { useAuthStore } from '@/stores/auth-store';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { PinInputDisplay } from '@/components/pin-input-display';
import { User, Keypad, Loader2 } from 'lucide-react';

type UserProfile = { id: string; name: string; role: string; active: boolean };

export default function Login() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { setAuth, token } = useAuthStore();
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    if (token) {
      router.replace('/pos');
    }
  }, [token, router]);

  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      try {
        const q = query(collection(db, 'users'), where('active', '==', true));
        const snap = await getDocs(q);
        const activeUsers = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
        setUsers(activeUsers);
      } catch (e) {
        console.error("Failed to fetch users:", e);
        setError("Could not load users. Please check your connection.");
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, []);
  
  const handleLogin = useCallback(async (currentPin: string) => {
    if (!selectedUser || currentPin.length !== 4) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/pin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selectedUser.id, pin: currentPin }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');
      
      const userCredential = await signInWithCustomToken(auth, data.token);
      if (userCredential.user) {
        setAuth({ token: data.token, role: data.role, user: { id: selectedUser.id, name: selectedUser.name } });
        setSelectedUser(null);
        setPin('');
        router.push('/pos');
      } else {
        throw new Error("Firebase sign-in failed.");
      }
    } catch (err: any) {
      setError(err.message);
      toast({
        variant: "destructive",
        title: "Login Failed",
        description: err.message,
      });
      setPin('');
    } finally {
      setLoading(false);
    }
  }, [selectedUser, setAuth, router, toast]);

  const handlePinInput = (digit: string) => {
    if (loading || pin.length >= 4) return;
    const newPin = pin + digit;
    setPin(newPin);
    if (newPin.length === 4) {
      handleLogin(newPin);
    }
  };

  const handleBackspace = () => {
    if (loading) return;
    setError(null);
    setPin(p => p.slice(0, -1));
  };
  
  const handleDialogClose = () => {
    if(loading) return;
    setSelectedUser(null);
    setPin('');
    setError(null);
  }

  const PinPad = () => (
    <div className="grid grid-cols-3 gap-2 mt-6">
      {'123456789'.split('').map(digit => (
        <Button key={digit} variant="outline" size="lg" className="h-16 text-2xl" onClick={() => handlePinInput(digit)} disabled={loading}>
          {digit}
        </Button>
      ))}
      <div/>
      <Button variant="outline" size="lg" className="h-16 text-2xl" onClick={() => handlePinInput('0')} disabled={loading}>0</Button>
      <Button variant="outline" size="lg" className="h-16" onClick={handleBackspace} disabled={loading || pin.length === 0}>
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z"></path><line x1="18" y1="9" x2="12" y2="15"></line><line x1="12" y1="9" x2="18" y2="15"></line></svg>
      </Button>
    </div>
  );

  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-4xl">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold text-primary">Salisburys POS</CardTitle>
          <CardDescription>Select your profile to sign in</CardDescription>
        </CardHeader>
        <CardContent>
          {loading && users.length === 0 ? (
             <div className="flex justify-center items-center p-10">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
             </div>
          ) : error && users.length === 0 ? (
            <p className="text-center text-destructive">{error}</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {users.map(user => (
                <button key={user.id} onClick={() => setSelectedUser(user)} className="group flex flex-col items-center justify-center p-4 border rounded-lg hover:bg-card/80 hover:border-primary transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background">
                  <div className="p-4 bg-secondary rounded-full mb-2">
                     <User className="h-10 w-10 text-secondary-foreground" />
                  </div>
                  <span className="font-semibold text-center">{user.name}</span>
                  <span className="text-sm text-muted-foreground capitalize">{user.role}</span>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      <Dialog open={!!selectedUser} onOpenChange={(open) => !open && handleDialogClose()}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader className="text-center">
            <DialogTitle className="text-2xl">Welcome, {selectedUser?.name}</DialogTitle>
            <p className="text-muted-foreground">Enter your 4-digit PIN</p>
          </DialogHeader>
          <div className="py-4">
            <PinInputDisplay value={pin} />
             {error && <p className="text-destructive text-center text-sm mt-3">{error}</p>}
             {loading && <div className="flex justify-center mt-3"><Loader2 className="h-5 w-5 animate-spin" /></div>}
            <PinPad />
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
