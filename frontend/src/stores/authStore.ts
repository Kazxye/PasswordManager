import { create } from "zustand";

interface AuthState {
    accessToken: string | null;
    encKey: Uint8Array | null;
    email: string | null;
    setSession: (accessToken: string, encKey: Uint8Array, email: string) => void;
    setAccessToken: (token: string) => void;
    logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
    accessToken: null,
    encKey: null,
    email: null,

    setSession: (accessToken, encKey, email) =>
        set({ accessToken, encKey, email }),

    setAccessToken: (token) =>
        set({ accessToken: token }),

    logout: () =>
        set({ accessToken: null, encKey: null, email: null }),
}));