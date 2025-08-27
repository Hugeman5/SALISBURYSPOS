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
  loginWithPin: (id: string, pin: string) => Promise<boolean>;
  logout: () => Promise<void>;
  setFromFirebase: (fb: FbUser | null) => void;
};

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      profile: null,
      role: null,
      loading: false,

      async loginWithPin(id: string, pin: string) {
        set({ loading: true });
        try {
          const res = await fetch('/api/auth/pin-login', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ id, pin })
          });

          // The API always answers JSON; if not ok, bail
          if (!res.ok) {
            let msg = `${res.status}`;
            try { const j = await res.json(); msg = j.error || msg; } catch {}
            console.error('PIN login failed:', msg);
            return false;
          }

          const { token, role } = await res.json();
          await signInWithCustomToken(auth, token);
          set({ role: role as Role });
          return true;
        } catch (e) {
          console.error('loginWithPin error:', e);
          return false;
        } finally {
          set({ loading: false });
        }
      },

      async logout() {
        await signOut(auth);
        set({ profile: null, role: null });
      },

      setFromFirebase(fb) {
        if (!fb) { set({ profile: null }); return; }
        // You can fetch Firestore user doc later and set a richer profile.
        set({ profile: { id: fb.uid, name: fb.displayName || 'User', role: (get().role || 'cashier') as Role, active: true } });
      }
    }),
    {
      name: 'salisburyspos-auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ profile: s.profile, role: s.role })
    }
  )
);

// Bootstraps listener (call once on a client root)
export function attachAuthListenerOnce() {
  if (typeof window === 'undefined') return;
  let attached = (window as any).__salisburysposAuthAttached;
  if (attached) return;
  (window as any).__salisburysposAuthAttached = true;
  const { setFromFirebase } = useAuth.getState();
  onAuthStateChanged(auth, (u) => setFromFirebase(u));
}
