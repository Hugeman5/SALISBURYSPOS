'use client';
import { useAuthStore } from '@/stores/auth-store';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { LogOut, UserCircle } from 'lucide-react';

export default function PosPage() {
    const { user, role, token, clearAuth } = useAuthStore();
    const router = useRouter();

    useEffect(() => {
        // This effect runs on the client after hydration
        const currentToken = useAuthStore.getState().token;
        if (!currentToken) {
            router.replace('/login');
        }
    }, [router]);

    const handleLogout = () => {
        clearAuth();
        // router.push will be handled by the useEffect
    };

    if (!token || !user) {
        // Render a loading state or null while waiting for client-side check
        return (
            <div className="flex h-screen items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="flex flex-col min-h-screen bg-background">
            <header className="flex items-center justify-between p-4 border-b">
                <h1 className="text-xl font-bold text-primary">Salisburys POS</h1>
                <div className="flex items-center gap-4">
                    <div className="text-right">
                        <p className="font-semibold">{user.name}</p>
                        <p className="text-sm text-muted-foreground capitalize">{role}</p>
                    </div>
                    <UserCircle className="h-8 w-8"/>
                    <Button variant="ghost" size="icon" onClick={handleLogout}>
                        <LogOut className="h-5 w-5" />
                    </Button>
                </div>
            </header>
            <main className="flex-1 p-8 flex items-center justify-center">
                <Card className="w-full max-w-md text-center">
                    <CardHeader>
                        <CardTitle>POS Dashboard</CardTitle>
                        <CardDescription>Main interface coming soon.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p>You are logged in as <span className="font-bold">{user.name}</span> ({role}).</p>
                    </CardContent>
                </Card>
            </main>
        </div>
    );
}
