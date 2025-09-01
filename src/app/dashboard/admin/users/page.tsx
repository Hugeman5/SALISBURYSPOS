
'use client';

import { useEffect, useState, useMemo } from 'react';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { User, Role } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { MoreHorizontal, UserPlus, Search } from 'lucide-react';
import { useAuth } from '@/stores/auth-store';
import { Input } from '@/components/ui/input';
import { UserFormDrawer } from '@/components/admin/users/user-form-drawer';
import { SetPinModal } from '@/components/admin/users/set-pin-modal';
import { useToast } from '@/hooks/use-toast';
import { fmtZAR } from '@/utils/money';
import { deleteUser } from '@/lib/functions/users';

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [pinModalUser, setPinModalUser] = useState<User | null>(null);
  
  const { toast } = useToast();
  const { role: currentUserRole } = useAuth();
  const canDelete = currentUserRole === 'admin';
  const canEdit = currentUserRole === 'admin' || currentUserRole === 'manager';

  useEffect(() => {
    // Realtime list of users for Admin UI
    const q = query(
        collection(db, 'users'), 
        where("active","==",true), 
        orderBy("role"), 
        orderBy("name")
    );
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const usersData: User[] = [];
      querySnapshot.forEach((doc) => {
        usersData.push({ id: doc.id, ...doc.data() } as User);
      });
      setUsers(usersData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching users: ", error);
      toast({ variant: 'destructive', title: 'Error', description: 'Could not load user data.' });
      setLoading(false);
    });

    return () => unsubscribe();
  }, [toast]);

  const handleDeleteUser = async (user: User) => {
    if (!canDelete) return;
    if (confirm(`Are you sure you want to set user "${user.name}" to inactive? They will no longer be able to log in.`)) {
      try {
        await deleteUser({ id: user.id });
        toast({ title: 'User set to inactive' });
      } catch (error: any) {
        toast({ variant: 'destructive', title: 'Update failed', description: error.message });
      }
    }
  };

  const handleSaveSuccess = () => {
    setDrawerOpen(false);
    setEditingUser(null);
  }

  const openDrawerForEdit = (user: User) => {
    setEditingUser(user);
    setDrawerOpen(true);
  };

  const openDrawerForNew = () => {
    setEditingUser(null);
    setDrawerOpen(true);
  };

  const filteredUsers = useMemo(() => {
    return users.filter(user =>
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.role.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [users, searchTerm]);

  const roleVariant = (role: Role) => {
    switch (role) {
      case 'admin': return 'destructive';
      case 'manager': return 'default';
      case 'cashier': return 'secondary';
      default: return 'outline';
    }
  };

  return (
    <>
      <div className="p-6 space-y-4">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Staff Management</CardTitle>
                <CardDescription>Add, edit, and manage user accounts and roles.</CardDescription>
              </div>
              {canEdit && (
                <Button onClick={openDrawerForNew}>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Add User
                </Button>
              )}
            </div>
            <div className="relative pt-4">
              <Search className="absolute left-2.5 top-6 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or role..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Hourly Rate</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={5} className="text-center h-24">Loading users...</TableCell></TableRow>
                ) : filteredUsers.length > 0 ? (
                  filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.name}</TableCell>
                      <TableCell>
                        <Badge variant={roleVariant(user.role)} className="capitalize">{user.role}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.active ? 'default' : 'outline'}>
                          {user.active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {typeof user.hourlyRateCents === 'number' ? fmtZAR(user.hourlyRateCents) : 'N/A'}
                      </TableCell>
                      <TableCell className="text-right">
                        {canEdit && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0">
                                <span className="sr-only">Open menu</span>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openDrawerForEdit(user)}>Edit Details</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setPinModalUser(user)}>Set PIN</DropdownMenuItem>
                              {canDelete && user.active && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteUser(user)}>Deactivate User</DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow><TableCell colSpan={5} className="text-center h-24">No users found.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
      <UserFormDrawer
        isOpen={drawerOpen}
        onClose={() => { setDrawerOpen(false); setEditingUser(null); }}
        onSaveSuccess={handleSaveSuccess}
        user={editingUser}
        currentUserRole={currentUserRole}
      />
      {pinModalUser && (
        <SetPinModal
          user={pinModalUser}
          onClose={() => setPinModalUser(null)}
        />
      )}
    </>
  );
}
