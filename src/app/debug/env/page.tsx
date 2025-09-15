'use client';

import React from 'react';
import { app } from '@/lib/firebase';

export default function EnvDebugPage() {
  const key = process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.slice(0, 6) ?? 'undef';
  return (
    <div style={{ padding: 24, fontFamily: 'ui-sans-serif, system-ui' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700 }}>Env Debug</h1>
      <p>API key starts with: <b>{key}</b></p>
      <p>App name: <b>{app.name}</b></p>
      <p>If key is <code>undef</code>, envs aren&apos;t reaching the client.</p>
    </div>
  );
}
