
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import type { Register } from '@/types';
import type { Profile } from '@/stores/auth-store';
import { Loader2 } from 'lucide-react';
import { call } from '@/lib/functions/call';

const formSchema = z.object({
  registerId: z.string().min(1, 'Please select a register.'),
  openingFloat: z.coerce.number().min(0, 'Float must be a non-negative number.'),
});

interface OpenRegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  registers: Register[];
  profile: Profile | null;
}

export function OpenRegisterModal({ isOpen, onClose, registers, profile }: OpenRegisterModalProps) {
  const { toast } = useToast();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { registerId: '', openingFloat: 0 },
  });

  const { isSubmitting } = form.formState;

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!profile) return;
    try {
      await call('manageRegisterSession', {
        action: 'open',
        registerId: values.registerId,
        openingFloat: values.openingFloat * 100, // convert to cents
      });
      toast({ title: 'Success', description: 'New register session has been opened.' });
      onClose();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error opening session', description: error.message });
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Open New Register Session</DialogTitle>
          <DialogDescription>
            Start a new session by selecting a register and entering the opening float amount.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="registerId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Register</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a register to open" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {registers.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="openingFloat"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Opening Float (ZAR)</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="2000.00" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             <DialogFooter>
                <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
                    Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                    Open Session
                </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
