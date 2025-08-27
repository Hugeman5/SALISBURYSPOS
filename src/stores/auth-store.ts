import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

type User = { id: string; name: string };

type AuthState = {
  token: string | null;
  role: string | null;
  user: User | null;
  setAuth: (data: { token: string; role: string; user: User }) => void;
  clearAuth: () => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      role: null,
      user: null,
      setAuth: (data) => set({ token: data.token, role: data.role, user: data.user }),
      clearAuth: () => set({ token: null, role: null, user: null }),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
