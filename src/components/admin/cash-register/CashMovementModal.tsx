
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import type { RegisterSession } from '@/types';
import type { Profile } from '@/stores/auth-store';
import { Loader2 } from 'lucide-react';
import { call } from '@/lib/functions/call';

const formSchema = z.object({
  amount: z.coerce.number().positive('Amount must be positive.'),
  reason: z.string().min(3, 'A reason is required.'),
});

interface CashMovementModalProps {
  type: 'payin' | 'payout';
  session: RegisterSession;
  onClose: () => void;
  profile: Profile | null;
}

export function CashMovementModal({ type, session, onClose, profile }: CashMovementModalProps) {
  const { toast } = useToast();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { amount: undefined, reason: '' },
  });

  const { isSubmitting } = form.formState;

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!profile) return;
    try {
      await call('postCashMovement', {
        sessionId: session.id,
        type,
        amount: values.amount * 100, // convert to cents
        reason: values.reason,
      });
      toast({ title: 'Success', description: `Cash ${type === 'payin' ? 'paid in' : 'paid out'} successfully.` });
      onClose();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    }
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="capitalize">Record Cash {type}</DialogTitle>
          <DialogDescription>
            This movement will be recorded in the current active session.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount (ZAR)</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="50.00" {...field} autoFocus/>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reason</FormLabel>
                  <FormControl>
                    <Input placeholder={type === 'payin' ? 'e.g. Extra float' : 'e.g. Office supplies'} {...field} />
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
                    Submit
                </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
