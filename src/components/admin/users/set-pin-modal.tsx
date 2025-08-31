
'use client';

import { useState } from 'react';
import type { User } from '@/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { PinKeypad } from '@/components/pin-keypad';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { call } from '@/lib/functions/call';

interface SetPinModalProps {
  user: User;
  onClose: () => void;
}

export function SetPinModal({ user, onClose }: SetPinModalProps) {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [step, setStep] = useState<'enter' | 'confirm'>('enter');
  const [isProcessing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  
  const handlePinChange = (newPin: string) => {
    setError(null);
    if (step === 'enter') {
      setPin(newPin);
      if (newPin.length === 4) {
        setTimeout(() => setStep('confirm'), 200);
      }
    } else {
      setConfirmPin(newPin);
    }
  };

  const handleSetPin = async () => {
    if (pin.length !== 4) {
      setError('PIN must be 4 digits.');
      return;
    }
    if (pin !== confirmPin) {
      setError('PINs do not match. Please try again.');
      setTimeout(() => {
        setPin('');
        setConfirmPin('');
        setStep('enter');
        setError(null);
      }, 1500);
      return;
    }
    
    setProcessing(true);
    try {
      await call('adminSetUserPin', { id: user.id, pin });
      toast({
        title: 'PIN Updated Successfully',
        description: `PIN for ${user.name} has been set.`,
      });
      onClose();
    } catch (e: any) {
      console.error('Set PIN failed:', e);
      toast({
        variant: 'destructive',
        title: 'Failed to Set PIN',
        description: e.message || 'An unexpected error occurred.',
      });
    } finally {
        setProcessing(false);
    }
  };
  
  const reset = () => {
    setPin('');
    setConfirmPin('');
    setStep('enter');
    setError(null);
  };

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Set PIN for: {user.name} ({user.role})</DialogTitle>
          <DialogDescription>
            {step === 'enter' ? 'Enter a new 4-digit PIN.' : 'Confirm the new PIN.'}
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
            <PinKeypad
                pin={step === 'enter' ? pin : confirmPin}
                onPinChange={handlePinChange}
                busy={isProcessing}
                hasError={!!error}
                onSubmit={() => {}}
                submitLabel='Set PIN'
            />
            <div className="min-h-[20px] pt-4 text-center text-sm text-destructive" aria-live="polite">
                {error}
            </div>
        </div>
        <DialogFooter>
            <Button variant="outline" onClick={reset} disabled={isProcessing}>Reset</Button>
            <Button 
                onClick={handleSetPin} 
                disabled={isProcessing || confirmPin.length < 4}
            >
                {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Set PIN
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
