'use client';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { firebaseConfig } from './env';

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export async function getAnalyticsSafe() {
  if (typeof window === 'undefined') return null;
  try {
    const { isSupported, getAnalytics } = await import('firebase/analytics');
    return (await isSupported()) ? getAnalytics(app) : null;
  } catch {
    return null;
  }
}
