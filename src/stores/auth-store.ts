
'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { signInWithCustomToken, signOut, onAuthStateChanged, type User as FbUser } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

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
  hydrated: boolean;
  signingOut: boolean;
  loginWithPin: (idOrUid: string, pin: string) => Promise<boolean>;
  logout: () => Promise<void>;
  setFromFirebase: (fb: FbUser | null) => void;
};

let controller: AbortController | null = null;

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      profile: null,
      role: null,
      loading: false,
      hydrated: false,
      signingOut: false,

      async loginWithPin(idOrUid: string, pin: string) {
        if (get().loading) return false;
        set({ loading: true });
        try { controller?.abort(); } catch {}
        controller = new AbortController();

        try {
          const res = await fetch('/api/auth/pin-login', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ uid: idOrUid, pin }),
            signal: controller.signal,
          });
      
          if (!res.ok) {
            let msg = `${res.status}`;
            try { const j = await res.json(); msg = j.error || msg; } catch {}
            console.error('PIN login failed:', msg);
            return false;
          }
      
          const { token } = await res.json(); 
          const cred = await signInWithCustomToken(auth, token);
      
          await cred.user.getIdTokenResult(true);

          return true;
        } catch (e: any) {
           if (e.name === 'AbortError') {
             console.log('PIN login fetch aborted.');
             return false;
           }
          console.error('loginWithPin error:', e);
          return false;
        } finally {
          set({ loading: false });
        }
      },

      async logout() {
        if (get().signingOut) return;
        set({ signingOut: true });
        try {
          await signOut(auth);
        } catch (e) {
          console.error('logout error:', e);
        } finally {
          set({ profile: null, role: null, signingOut: false });
        }
      },

      async setFromFirebase(fb) {
        if (!fb) { 
            set({ profile: null, role: null }); 
            return; 
        }

        const idTokenResult = await fb.getIdTokenResult(true);
        const roleClaim = (idTokenResult.claims.role as Role) || null;
        set({ role: roleClaim });
        
        const userRef = doc(db, 'users', fb.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
            const userData = userSnap.data();
            set({
                profile: {
                    id: fb.uid,
                    name: userData.name || fb.displayName || 'User',
                    role: (roleClaim || userData.role || 'cashier') as Role,
                    active: userData.active ?? false,
                }
            })
        } else {
            set({ profile: { id: fb.uid, name: fb.displayName || 'User', role: (roleClaim || 'cashier') as Role, active: true } });
        }
      }
    }),
    {
      name: 'salisburyspos-auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ profile: s.profile, role: s.role }),
      onRehydrateStorage: () => (state) => {
        if (state) state.hydrated = false;
      }
    }
  )
);

let authListenerAttached = false;
export function attachAuthListenerOnce() {
  if (typeof window === 'undefined' || authListenerAttached) return;
  authListenerAttached = true;
  
  onAuthStateChanged(auth, async (user) => {
    const { setFromFirebase } = useAuth.getState();
    await setFromFirebase(user);
    useAuth.setState({ hydrated: true });
  });
}
