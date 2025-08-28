
'use client';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

interface PinKeypadProps {
  pin: string;
  onPinChange: (pin: string) => void;
  onSubmit: () => void;
  busy?: boolean;
  hasError?: boolean;
}

export function PinKeypad({ pin, onPinChange, onSubmit, busy = false, hasError = false }: PinKeypadProps) {
  const push = (n: string) => {
    if (busy || pin.length >= 4) return;
    onPinChange(pin + n);
  };

  const clear = () => onPinChange('');
  const back = () => onPinChange(pin.slice(0, -1));

  const shakeVariants = {
    shake: {
      x: [0, -10, 10, -10, 10, 0],
      transition: { duration: 0.5 },
    },
    initial: {
      x: 0,
    },
  };

  return (
    <div className="max-w-xs mx-auto space-y-4">
      <motion.div
        className="flex justify-center gap-2"
        variants={shakeVariants}
        animate={hasError ? 'shake' : 'initial'}
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className={cn(
              'h-4 w-4 rounded-full border-2 transition-colors',
              pin.length > i ? 'bg-primary border-primary' : 'bg-background border-input'
            )}
          />
        ))}
      </motion.div>
      <div className="grid grid-cols-3 gap-2">
        {'123456789'.split('').map(d => (
          <Button key={d} onClick={() => push(d)} disabled={busy} variant="outline" size="lg" className="text-xl h-16">{d}</Button>
        ))}
        <Button onClick={back} disabled={busy} variant="outline" size="lg" className="text-xl h-16"><ArrowLeft className="h-6 w-6" /></Button>
        <Button onClick={() => push('0')} disabled={busy} variant="outline" size="lg" className="text-xl h-16">0</Button>
        <Button onClick={clear} disabled={busy} variant="outline" size="lg" className="h-16">Clear</Button>
      </div>
      <Button onClick={onSubmit} disabled={busy || pin.length < 4} className="w-full h-14 text-lg">
        <AnimatePresence>
        {busy ? (
             <motion.div
                key="loader"
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5 }}
              >
                <Loader2 className="h-6 w-6 animate-spin" />
             </motion.div>
        ) : (
             <motion.span
                key="text"
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5 }}
             >
                Login
             </motion.span>
        )}
        </AnimatePresence>
      </Button>
    </div>
  );
}
