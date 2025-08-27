'use client';

import React, { memo } from 'react';
import { cn } from '@/lib/utils';

interface PinInputProps {
  pinLength?: number;
  value: string;
}

const PinInputDisplay = memo(({ pinLength = 4, value }: PinInputProps) => {
  const values = value.split('');
  const items = Array.from({ length: pinLength }, (_, i) => values[i] || '');

  return (
    <div className="flex justify-center gap-3" aria-label="PIN input display">
      {items.map((char, index) => (
        <div
          key={index}
          className={cn(
            'flex h-12 w-12 items-center justify-center rounded-md border-2 text-2xl font-semibold transition-colors',
            char ? 'border-primary bg-primary/10' : 'border-input bg-background'
          )}
        >
          {char ? '•' : ''}
        </div>
      ))}
    </div>
  );
});
PinInputDisplay.displayName = 'PinInputDisplay';

export { PinInputDisplay };
