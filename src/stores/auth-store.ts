'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { signInWithCustomToken, signOut, onAuthStateChanged, type User as FbUser } from 'firebase/auth';
import { auth } from '@/lib/firebase';

type Role = 'admin'|'manager'|'cashier'|'waiter'|'kitchen';

export type Profile = {
  id: string;
  name: string;
  role: Role;
  active: boolean;
};

type AuthState = {
  profile: Profile | null;
  role: Role | null;
  loading: boolean;
  lastError: string | null;
  loginWithPin: (idOrUid: string, pin: string) => Promise<boolean>;
  logout: () => Promise<void>;
  setFromFirebase: (fb: FbUser | null) => void;
};

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      profile: null,
      role: null,
      loading: false,
      lastError: null,

      async loginWithPin(idOrUid: string, pin: string) {
        if (get().loading) return false; // prevent concurrent requests
        set({ loading: true, lastError: null });

        try {
          const res = await fetch('/api/auth/pin-login', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ id: idOrUid, pin })
          });

          if (!res.ok) {
            let msg = `${res.status}`;
            try { const j = await res.json(); msg = j.error || msg; } catch {}
            set({ lastError: msg });
            console.error('PIN login failed:', msg);
            return false;
          }

          const { token, role } = await res.json();
          await signInWithCustomToken(auth, token);
          set({ role: (role as Role) || 'cashier' });
          return true;
        } catch (e) {
          const msg = String((e as any)?.message ?? e);
          set({ lastError: msg });
          console.error('loginWithPin error:', e);
          return false;
        } finally {
          set({ loading: false });
        }
      },

      async logout() {
        try {
          await signOut(auth);
        } finally {
          set({ profile: null, role: null });
        }
      },

      async setFromFirebase(fb) {
        if (!fb) { 
            set({ profile: null, role: null }); 
            return; 
        }

        const idTokenResult = await fb.getIdTokenResult(true);
        const roleClaim = (idTokenResult.claims.role as Role) || null;
        
        set({
            role: roleClaim,
            profile: {
                id: fb.uid,
                name: fb.displayName || 'User',
                role: (roleClaim || 'cashier') as Role,
                active: true, // If they have a token, they must have been active at login
            }
        });
      }
    }),
    {
      name: 'salisburyspos-auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ profile: s.profile, role: s.role })
    }
  )
);

let authListenerAttached = false;
export function attachAuthListenerOnce() {
  if (typeof window === 'undefined' || authListenerAttached) return;
  authListenerAttached = true;
  
  const { setFromFirebase } = useAuth.getState();
  onAuthStateChanged(auth, (user) => setFromFirebase(user));
}
