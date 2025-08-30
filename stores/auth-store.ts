
'use client';
import { create } from 'zustand';
import { onAuthStateChanged, signInWithCustomToken, signOut, getIdTokenResult, type User as FbUser } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import type { Role } from '@/types';

export type Profile = {
  id: string;
  name: string;
  role: Role;
};

interface AuthState {
  profile: Profile | null;
  role: Role | null;
  loading: boolean;
  hydrated: boolean;
  lastError: string | null;
  setProfile: (user: Profile | null) => void;
  setRole: (role: Role | null) => void;
  loginWithPin: (id: string, pin: string) => Promise<boolean>;
  logout: () => Promise<void>;
}

export const useAuth = create<AuthState>((set, get) => ({
  profile: null,
  role: null,
  loading: false,
  hydrated: false,
  lastError: null,
  setProfile: (profile) => set({ profile }),
  setRole: (role) => set({ role }),
  
  loginWithPin: async (id, pin) => {
    if (get().loading) return false;
    set({ loading: true, lastError: null });
    try {
      const res = await fetch('/api/auth/pin-login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id, pin })
      });

      if (!res.ok) {
        let msg = `Request failed with status ${res.status}`;
        try { 
          const j = await res.json(); 
          msg = j.error || msg; 
        } catch {}
        set({ lastError: msg });
        console.error('PIN login failed:', msg);
        return false;
      }

      const { token, role: roleFromApi } = await res.json();
      await signInWithCustomToken(auth, token);

      let role: Role | undefined = roleFromApi;
      if (!role) {
        const u = auth.currentUser;
        if (u) {
          const t = await getIdTokenResult(u, true);
          role = (t.claims?.role as Role) || 'cashier';
        }
      }
      set({ role: role || 'cashier' });
      return true;
    } catch (e: any) {
      console.error('loginWithPin error:', e);
      set({ lastError: 'An unexpected error occurred.' });
      return false;
    } finally {
      set({ loading: false });
    }
  },

  logout: async () => {
    set({ loading: true });
    await signOut(auth);
    set({ profile: null, role: null, loading: false });
  },
}));

let listenerAttached = false;

const setFromFirebase = async (fbUser: FbUser | null) => {
  if (fbUser) {
    const [profileSnap, tokenResult] = await Promise.all([
      getDoc(doc(db, "users", fbUser.uid)),
      getIdTokenResult(fbUser, true),
    ]);
    const role = (tokenResult.claims?.role as Role) || 'cashier';

    if (profileSnap.exists()) {
      const data = profileSnap.data();
      useAuth.setState({
        profile: { id: fbUser.uid, name: data.name, role },
        role,
        hydrated: true,
      });
    } else {
      // User exists in Auth, but not Firestore. Sign out.
      await signOut(auth);
      useAuth.setState({ profile: null, role: null, hydrated: true });
    }
  } else {
    // No user
    useAuth.setState({ profile: null, role: null, hydrated: true });
  }
};

export function attachAuthListenerOnce() {
  if (listenerAttached) return;
  onAuthStateChanged(auth, setFromFirebase);
  listenerAttached = true;
}
