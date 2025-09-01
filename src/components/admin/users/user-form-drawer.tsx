
'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import type { User, Role } from '@/types';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetClose,
} from '@/components/ui/sheet';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { upsertUser } from '@/lib/functions/users';

const roles: Role[] = ['admin', 'manager', 'cashier', 'waiter', 'kitchen'];

const userFormSchema = z.object({
  id: z.string().min(1, 'ID is required.'),
  name: z.string().min(1, 'Name is required.').max(64, 'Name cannot exceed 64 characters.'),
  role: z.enum(roles),
  active: z.boolean(),
  hourlyRateZar: z.string().refine(val => !isNaN(parseFloat(val)) && parseFloat(val) >= 0, {
    message: "Hourly rate must be a non-negative number.",
  }),
});

// For new users, the ID is not known yet and must match a specific format.
const newUserFormSchema = userFormSchema.extend({
    id: z.string().regex(/^[a-z0-9-]{3,24}$/, 'ID must be 3-24 lowercase letters, numbers, or hyphens.'),
});

export type UserFormValues = z.infer<typeof userFormSchema>;

interface UserFormDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: UserFormValues) => Promise<void>;
  user: User | null;
  currentUserRole?: Role | null;
}

export function UserFormDrawer({ isOpen, onClose, onSave, user, currentUserRole }: UserFormDrawerProps) {
  const isEditing = !!user;

  const form = useForm<UserFormValues>({
    resolver: zodResolver(isEditing ? userFormSchema : newUserFormSchema),
    defaultValues: {
        id: '',
        name: '',
        role: 'cashier',
        active: true,
        hourlyRateZar: '0',
    }
  });

  useEffect(() => {
    if (isOpen) {
        if (user) {
          form.reset({
            id: user.id,
            name: user.name,
            role: user.role,
            active: user.active,
            hourlyRateZar: user.hourlyRateCents ? (user.hourlyRateCents / 100).toFixed(2) : '0',
          });
        } else {
          form.reset({
            id: '',
            name: '',
            role: 'cashier',
            active: true,
            hourlyRateZar: '0',
          });
        }
    }
  }, [user, form, isOpen]);

  const onSubmit = (data: UserFormValues) => {
    onSave(data);
  };
  
  const canEditRole = currentUserRole === 'admin';

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-[480px]">
        <SheetHeader>
          <SheetTitle>{user ? 'Edit User' : 'Add New User'}</SheetTitle>
          <SheetDescription>
            {user ? `Update the details for ${user.name}.` : 'Create a new staff member account. Remember to set a PIN to enable login.'}
          </SheetDescription>
        </SheetHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-6">
            <FormField
              control={form.control}
              name="id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>User ID</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. john-doe" {...field} disabled={isEditing} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. John Doe" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role</FormLabel>
                   <Select onValueChange={field.onChange} defaultValue={field.value} disabled={!canEditRole}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a role" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {roles.map((role) => (
                        <SelectItem key={role} value={role} className="capitalize">{role}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!canEditRole && <p className="text-xs text-muted-foreground pt-1">Only an Admin can change roles.</p>}
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
              control={form.control}
              name="hourlyRateZar"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Hourly Rate (ZAR)</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" placeholder="e.g., 120.50" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="active"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                        <FormLabel>Active Status</FormLabel>
                        <p className="text-xs text-muted-foreground">
                            Inactive users cannot log in.
                        </p>
                    </div>
                     <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                </FormItem>
              )}
            />
            <SheetFooter>
              <SheetClose asChild>
                <Button type="button" variant="outline">Cancel</Button>
              </SheetClose>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                Save Changes
              </Button>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
