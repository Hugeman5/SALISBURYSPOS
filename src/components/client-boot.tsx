'use client';

import { useEffect } from 'react';
import { attachAuthListenerOnce } from '@/stores/auth-store';

export default function ClientBoot() {
  useEffect(() => {
    attachAuthListenerOnce();
  }, []);
  return null;
}
