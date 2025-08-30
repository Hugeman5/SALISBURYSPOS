
'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { signInWithCustomToken, signOut, onAuthStateChanged, type User as FbUser } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import type { Role, User } from '@/types';


export type Profile = Pick<User, 'id' | 'name' | 'role' | 'active'>;

type AuthState = {
  profile: Profile | null;
  role: Role | null;
  loading: boolean;
  lastError: string | null;
  hydrated: boolean;
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
      hydrated: false,

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
            let msg = `${res.statusText}`;
            try { const j = await res.json(); msg = j.error || msg; } catch {}
            set({ lastError: msg });
            console.error('PIN login failed:', msg);
            return false;
          }

          const { token, role } = await res.json();
          const userCredential = await signInWithCustomToken(auth, token);
          
          // After sign in, getFromFirebase will be triggered by onAuthStateChanged
          // but we can set the role immediately for faster routing.
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
        
        // Fetch the user document from Firestore to get the latest profile info
        const userDoc = await getDoc(doc(db, "users", fb.uid));
        if (userDoc.exists()) {
            const userData = userDoc.data() as User;
            set({
                role: userData.role,
                profile: {
                    id: fb.uid,
                    name: userData.name,
                    role: userData.role,
                    active: userData.active,
                }
            });
        } else {
             // Fallback if firestore doc is missing, though this shouldn't happen
            set({
                role: roleClaim,
                profile: {
                    id: fb.uid,
                    name: fb.displayName || 'User',
                    role: (roleClaim || 'cashier') as Role,
                    active: true, 
                }
            });
        }
      }
    }),
    {
      name: 'salisburyspos-auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ profile: s.profile, role: s.role }),
       onRehydrateStorage: () => (state) => {
        if (state) state.hydrated = true;
      },
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
